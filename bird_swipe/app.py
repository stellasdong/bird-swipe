"""bird-swipe entry point.

    bird-swipe [CSV]                     # save to a copy: <name>.labeled.csv
    bird-swipe CSV --output OUT.csv      # explicit output path
    bird-swipe CSV --output-dir DIR      # write the copy into DIR
    bird-swipe CSV --in-place            # edit the original (be sure!)
    bird-swipe CSV --no-resume           # start fresh, ignore prior labels

The output folder and hotkeys are also configurable in-app via File > Preferences.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bird_swipe import config
from bird_swipe.core.catalog import Catalog, ValidationError, default_output_path

DEFAULT_CSV = Path(__file__).resolve().parent.parent / "ML__2026-08-07T18-46_rethaw.csv"


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="bird-swipe", description="Swipe through Macaulay nest media.")
    p.add_argument("csv", nargs="?", default=str(DEFAULT_CSV), help="Macaulay export (.csv or .xlsx)")
    p.add_argument("-o", "--output", help="Exact output path for labels")
    p.add_argument("--output-dir", help="Folder to write the .labeled copy into")
    p.add_argument("--in-place", action="store_true", help="Edit the original file instead of a copy")
    p.add_argument("--no-resume", action="store_true", help="Ignore existing labels and start over")
    p.add_argument("--reviewer", default="", help="Name recorded in the reviewer column")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    if args.in_place:
        output = csv_path
    elif args.output:
        output = Path(args.output)
    elif args.output_dir:
        output = Path(args.output_dir) / default_output_path(csv_path).name
    elif config.get_output_dir():
        output = Path(config.get_output_dir()) / default_output_path(csv_path).name
    else:
        output = default_output_path(csv_path)

    try:
        catalog, validation = Catalog.open(csv_path, output, resume=not args.no_resume)
    except ValidationError as exc:
        print(f"Not a valid Macaulay export:\n  {exc}", file=sys.stderr)
        return 2

    for w in validation.warnings:
        print(f"warning: {w}", file=sys.stderr)
    print(f"input : {csv_path}")
    print(f"output: {output}   ({'in place' if output == csv_path else 'copy'})")
    print(f"resuming at item {catalog.first_unreviewed() + 1} of {len(catalog.rows)}")

    # Import Qt lazily so --help etc. work without a display.
    from PySide6 import QtWidgets
    from bird_swipe.ui.main_window import MainWindow

    app = QtWidgets.QApplication(sys.argv[:1])
    win = MainWindow(catalog, input_path=csv_path, reviewer=args.reviewer)
    win.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
