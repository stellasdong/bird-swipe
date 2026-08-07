"""Spreadsheet load / validate / save-as-you-go with resume.

M1 supports CSV (the Macaulay export format). XLSX comes in M2.

Save model: after every label the *entire* file is rewritten to a temp file and
atomically renamed over the output path, so a crash mid-write can't corrupt it.
By default the output is a **copy** next to the input (``<name>.labeled.csv``);
the original is never touched unless the caller passes it as the output path.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

# Minimum columns we rely on. Missing any of these is a hard error.
REQUIRED_COLUMNS = [
    "ML Catalog Number",
    "Format",
    "Common Name",
    "Scientific Name",
    "Asset Tags",
]
CATALOG_KEY = "ML Catalog Number"

# Columns bird-swipe appends. Order preserved when new to a file.
LABEL_COLUMNS = ["nest_label", "human_structure", "reviewed", "reviewed_at", "reviewer"]

REVIEWED = "TRUE"


class ValidationError(Exception):
    """Raised when a file doesn't look like a Macaulay export."""


class Validation:
    def __init__(self, errors: list[str], warnings: list[str]):
        self.errors = errors
        self.warnings = warnings

    @property
    def ok(self) -> bool:
        return not self.errors


def validate_fieldnames(fieldnames: list[str] | None) -> Validation:
    errors: list[str] = []
    warnings: list[str] = []
    if not fieldnames:
        return Validation(["File has no header row."], [])
    if fieldnames[0] != CATALOG_KEY:
        errors.append(f"First column must be {CATALOG_KEY!r}, got {fieldnames[0]!r}.")
    for col in REQUIRED_COLUMNS:
        if col not in fieldnames:
            errors.append(f"Missing required column: {col!r}.")
    # A genuine Macaulay export is wide; warn (don't fail) if it looks trimmed.
    data_cols = [c for c in fieldnames if c not in LABEL_COLUMNS]
    if len(data_cols) < 10:
        warnings.append(
            f"Only {len(data_cols)} data columns found; expected a full Macaulay export (~46)."
        )
    return Validation(errors, warnings)


def default_output_path(input_path: Path) -> Path:
    """The copy we write to by default, leaving the original untouched."""
    p = Path(input_path)
    return p.with_name(f"{p.stem}.labeled{p.suffix or '.csv'}")


def _is_xlsx(path: Path) -> bool:
    return path.suffix.lower() in (".xlsx", ".xlsm")


def _read_csv(path: Path) -> tuple[list[dict], list[str]]:
    # utf-8-sig strips a BOM if Macaulay/Excel added one.
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = [dict(r) for r in reader]
        fieldnames = list(reader.fieldnames or [])
    return rows, fieldnames


def _read_xlsx(path: Path) -> tuple[list[dict], list[str]]:
    from openpyxl import load_workbook

    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = next(it, None)
        if header is None:
            return [], []
        fieldnames = [str(h) if h is not None else "" for h in header]
        rows = []
        for r in it:
            if r is None or all(c is None for c in r):
                continue  # skip blank rows
            rows.append({name: ("" if i >= len(r) or r[i] is None else str(r[i]))
                         for i, name in enumerate(fieldnames)})
        return rows, fieldnames
    finally:
        wb.close()


def _read_table(path: Path) -> tuple[list[dict], list[str]]:
    return _read_xlsx(path) if _is_xlsx(path) else _read_csv(path)


class Catalog:
    """Rows of a Macaulay export plus bird-swipe's labels, saved to ``output_path``."""

    def __init__(self, rows: list[dict], fieldnames: list[str], output_path: Path):
        self.rows = rows
        self.fieldnames = fieldnames
        self.output_path = Path(output_path)
        self._ensure_label_columns()

    # --- construction -----------------------------------------------------
    @classmethod
    def open(
        cls,
        input_path: str | Path,
        output_path: str | Path | None = None,
        *,
        resume: bool = True,
    ) -> tuple["Catalog", Validation]:
        """Open ``input_path``; write labels to ``output_path`` (a copy by default).

        On resume, if the output copy already exists we load *from it* so prior
        labels are preserved. Otherwise we load the pristine input and seed the
        copy on disk immediately.
        """
        input_path = Path(input_path)
        out = Path(output_path) if output_path else default_output_path(input_path)

        source = out if (resume and out.exists()) else input_path
        rows, fieldnames = _read_table(source)
        validation = validate_fieldnames(fieldnames)
        if not validation.ok:
            raise ValidationError("; ".join(validation.errors))

        cat = cls(rows, fieldnames, out)
        if not out.exists():
            cat.save()  # seed the copy so the original stays pristine
        return cat, validation

    def _ensure_label_columns(self) -> None:
        for col in LABEL_COLUMNS:
            if col not in self.fieldnames:
                self.fieldnames.append(col)
        for row in self.rows:
            for col in LABEL_COLUMNS:
                row.setdefault(col, "")

    # --- persistence ------------------------------------------------------
    def save(self) -> None:
        tmp = self.output_path.with_suffix(self.output_path.suffix + ".part")
        if _is_xlsx(self.output_path):
            self._write_xlsx(tmp)
        else:
            self._write_csv(tmp)
        tmp.replace(self.output_path)  # atomic on the same filesystem

    def _write_csv(self, path: Path) -> None:
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(self.rows)

    def _write_xlsx(self, path: Path) -> None:
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.append(self.fieldnames)
        for row in self.rows:
            ws.append([row.get(f, "") for f in self.fieldnames])
        wb.save(path)

    # --- labeling ---------------------------------------------------------
    def set_label(
        self, index: int, nest: bool | None, structure: bool, reviewer: str = ""
    ) -> None:
        """Record a decision for row ``index`` and persist immediately."""
        row = self.rows[index]
        row["nest_label"] = "" if nest is None else ("yes" if nest else "no")
        row["human_structure"] = "yes" if structure else "no"
        row["reviewed"] = REVIEWED
        row["reviewed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        row["reviewer"] = reviewer
        self.save()

    def is_reviewed(self, index: int) -> bool:
        return self.rows[index].get("reviewed") == REVIEWED

    def first_unreviewed(self) -> int:
        for i in range(len(self.rows)):
            if not self.is_reviewed(i):
                return i
        return len(self.rows)  # all done

    def stats(self) -> dict:
        reviewed = sum(1 for r in self.rows if r.get("reviewed") == REVIEWED)
        yes = sum(1 for r in self.rows if r.get("nest_label") == "yes")
        no = sum(1 for r in self.rows if r.get("nest_label") == "no")
        struct = sum(1 for r in self.rows if r.get("human_structure") == "yes")
        return {"total": len(self.rows), "reviewed": reviewed, "yes": yes, "no": no, "structure": struct}
