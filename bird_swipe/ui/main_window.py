"""The M1 label loop: arrow-key labeling with save-as-you-go and resume."""

from __future__ import annotations

from PySide6 import QtCore, QtGui, QtWidgets

from bird_swipe.core import macaulay
from bird_swipe.core.catalog import Catalog
from bird_swipe.ui.media_view import MediaView

_LEGEND = "→ YES nest    ← NO nest    ↑ toggle structure    Space skip    Backspace back    Esc quit"


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self, catalog: Catalog, reviewer: str = ""):
        super().__init__()
        self.catalog = catalog
        self.reviewer = reviewer
        self.idx = catalog.first_unreviewed()
        self.structure = False  # pending human-made-structure toggle for current item

        self.setWindowTitle("bird-swipe")
        self.resize(1100, 850)
        self._build_ui()
        self.show_current()

    # --- layout -----------------------------------------------------------
    def _build_ui(self) -> None:
        self.media = MediaView()

        self.title_lbl = QtWidgets.QLabel()
        self.title_lbl.setStyleSheet("font-size:18px;font-weight:600;")
        self.progress_lbl = QtWidgets.QLabel(alignment=QtCore.Qt.AlignRight)
        header = QtWidgets.QHBoxLayout()
        header.addWidget(self.title_lbl)
        header.addWidget(self.progress_lbl)

        self.nest_chip = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter)
        self.struct_chip = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter)
        for chip in (self.nest_chip, self.struct_chip):
            chip.setMinimumWidth(220)
            chip.setStyleSheet("padding:6px;border-radius:6px;background:#222;color:#eee;")
        chips = QtWidgets.QHBoxLayout()
        chips.addWidget(self.nest_chip)
        chips.addWidget(self.struct_chip)
        chips.addStretch()

        self.meta_lbl = QtWidgets.QLabel(wordWrap=True)
        self.meta_lbl.setTextFormat(QtCore.Qt.RichText)
        self.meta_lbl.setOpenExternalLinks(True)
        self.meta_lbl.setStyleSheet("padding:6px;color:#ccc;")

        work = QtWidgets.QWidget()
        wlay = QtWidgets.QVBoxLayout(work)
        wlay.addLayout(header)
        wlay.addLayout(chips)
        wlay.addWidget(self.media, stretch=1)
        wlay.addWidget(self.meta_lbl)

        self.done_lbl = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter, wordWrap=True)
        self.done_lbl.setStyleSheet("font-size:18px;padding:40px;")

        self.pages = QtWidgets.QStackedWidget()
        self.pages.addWidget(work)       # 0
        self.pages.addWidget(self.done_lbl)  # 1
        self.setCentralWidget(self.pages)
        self.statusBar().showMessage(_LEGEND)

    # --- keys -------------------------------------------------------------
    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        key = event.key()
        if key in (QtCore.Qt.Key_Escape, QtCore.Qt.Key_Q):
            self.close()
            return
        if key == QtCore.Qt.Key_Backspace:
            self.go_back()
            return

        at_end = self.idx >= len(self.catalog.rows)
        if at_end:
            super().keyPressEvent(event)
            return

        if key == QtCore.Qt.Key_Up:
            self.structure = not self.structure
            self._update_chips()
        elif key == QtCore.Qt.Key_Right:
            self._commit(nest=True)
        elif key == QtCore.Qt.Key_Left:
            self._commit(nest=False)
        elif key == QtCore.Qt.Key_Space:
            self.advance()
        else:
            super().keyPressEvent(event)

    # --- actions ----------------------------------------------------------
    def _commit(self, nest: bool) -> None:
        self.catalog.set_label(self.idx, nest=nest, structure=self.structure, reviewer=self.reviewer)
        self.advance()

    def advance(self) -> None:
        self.idx += 1
        self.structure = False
        self.show_current()

    def go_back(self) -> None:
        if self.idx <= 0:
            return
        self.idx -= 1
        row = self.catalog.rows[self.idx]
        self.structure = row.get("human_structure") == "yes"
        self.show_current()

    # --- rendering --------------------------------------------------------
    def show_current(self) -> None:
        total = len(self.catalog.rows)
        if self.idx >= total:
            self.media.stop()
            self._show_done()
            return

        self.pages.setCurrentIndex(0)
        row = self.catalog.rows[self.idx]
        ml_id = row["ML Catalog Number"]
        self.title_lbl.setText(f"{row.get('Common Name', '')}  ·  {row.get('Scientific Name', '')}")
        st = self.catalog.stats()
        self.progress_lbl.setText(f"[{self.idx + 1} / {total}]   reviewed {st['reviewed']}")
        self.setWindowTitle(f"bird-swipe · [{self.idx + 1}/{total}] · ML {ml_id}")
        self.media.show_asset(ml_id, row.get("Format", ""))
        self.meta_lbl.setText(self._meta_html(row))
        self._update_chips()
        self._prefetch_upcoming()

    def _prefetch_upcoming(self, n: int = 3) -> None:
        ids: list[str] = []
        i = self.idx + 1
        while i < len(self.catalog.rows) and len(ids) < n:
            row = self.catalog.rows[i]
            if row.get("Format") != "Video":  # only photos are prefetchable
                ids.append(row["ML Catalog Number"])
            i += 1
        self.media.prefetch(ids)

    def _update_chips(self) -> None:
        row = self.catalog.rows[self.idx]
        label = row.get("nest_label", "")
        if label == "yes":
            self.nest_chip.setText("nest: YES ✓")
            self.nest_chip.setStyleSheet("padding:6px;border-radius:6px;background:#1b5e20;color:#fff;")
        elif label == "no":
            self.nest_chip.setText("nest: NO ✗")
            self.nest_chip.setStyleSheet("padding:6px;border-radius:6px;background:#7f1d1d;color:#fff;")
        else:
            self.nest_chip.setText("nest: — (unlabeled)")
            self.nest_chip.setStyleSheet("padding:6px;border-radius:6px;background:#222;color:#eee;")

        if self.structure:
            self.struct_chip.setText("human-made structure: ON  (↑)")
            self.struct_chip.setStyleSheet("padding:6px;border-radius:6px;background:#1565c0;color:#fff;")
        else:
            self.struct_chip.setText("human-made structure: off  (↑)")
            self.struct_chip.setStyleSheet("padding:6px;border-radius:6px;background:#222;color:#eee;")

    def _meta_html(self, row: dict) -> str:
        ml_id = row["ML Catalog Number"]
        page = macaulay.asset_page_url(ml_id)
        base = ["Format", "Caption", "Behaviors", "Date", "Locality", "Asset Tags"]
        notes = ["Observation Details", "Media notes"]
        parts = [f"<b>ML {ml_id}</b> · <a href='{page}'>{page}</a><br>"]
        parts += [f"<b>{k}:</b> {row.get(k, '')}&nbsp;&nbsp; " for k in base if row.get(k)]
        for k in notes:  # each note on its own line
            if row.get(k):
                parts.append(f"<br><b>{k}:</b> {row.get(k)}")
        return "".join(parts)

    def _show_done(self) -> None:
        st = self.catalog.stats()
        self.pages.setCurrentIndex(1)
        self.setWindowTitle("bird-swipe · done")
        self.done_lbl.setText(
            f"<h2>All {st['total']} assets reviewed 🎉</h2>"
            f"<p>nest yes: <b>{st['yes']}</b>&nbsp;&nbsp; nest no: <b>{st['no']}</b>"
            f"&nbsp;&nbsp; human-made structure: <b>{st['structure']}</b></p>"
            f"<p>Saved to:<br><code>{self.catalog.output_path}</code></p>"
            f"<p>Press <b>Backspace</b> to revisit the last item, or <b>Esc</b> to quit.</p>"
        )

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        self.media.stop()
        super().closeEvent(event)
