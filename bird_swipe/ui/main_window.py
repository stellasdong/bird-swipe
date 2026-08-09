"""The label loop: hotkey labeling with save-as-you-go and resume."""

from __future__ import annotations

from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets

from bird_swipe import config
from bird_swipe.core import macaulay
from bird_swipe.core.catalog import Catalog, MasterLog, ValidationError
from bird_swipe.ui.media_view import MediaView
from bird_swipe.ui.preferences import PreferencesDialog


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self, catalog: Catalog, input_path: str | Path, reviewer: str = ""):
        super().__init__()
        self.catalog = catalog
        self._input_path = Path(input_path)
        self.reviewer = reviewer
        self.idx = catalog.first_unreviewed()
        self.structure = False  # pending human-made-structure toggle for current item
        self.keys = config.keymap_ints()  # action -> Qt key int

        self.setWindowTitle("bird-swipe")
        self.resize(1100, 850)
        self._build_ui()
        self.show_current()

    # --- layout -----------------------------------------------------------
    def _build_ui(self) -> None:
        self._build_menu()
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
        self.statusBar().showMessage(self._legend())

    def _build_menu(self) -> None:
        filem = self.menuBar().addMenu("&File")
        act_open = filem.addAction("Open spreadsheet…")
        act_open.setShortcut(QtGui.QKeySequence.Open)
        act_open.triggered.connect(self.open_spreadsheet)
        act_prefs = filem.addAction("Preferences…")
        act_prefs.setShortcut(QtGui.QKeySequence.Preferences)
        act_prefs.triggered.connect(self.open_preferences)
        filem.addSeparator()
        act_quit = filem.addAction("Quit")
        act_quit.setShortcut(QtGui.QKeySequence.Quit)
        act_quit.triggered.connect(self.close)

    def _legend(self) -> str:
        k = config.get_keys()
        d = config.key_display
        return (f"{d(k['nest_yes'])} YES nest    {d(k['nest_no'])} NO nest"
                f"    {d(k['toggle_structure'])} toggle structure    {d(k['skip'])} skip"
                f"    {d(k['back'])} back    {d(k['quit'])} quit")

    # --- keys -------------------------------------------------------------
    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        action = self._action_for(event.key())
        if action == "quit":
            self.close()
            return
        if action == "back":
            self.go_back()
            return

        if self.idx >= len(self.catalog.rows):  # on the done screen
            super().keyPressEvent(event)
            return

        if action == "toggle_structure":
            self.structure = not self.structure
            self._update_chips()
        elif action == "nest_yes":
            self._commit(nest=True)
        elif action == "nest_no":
            self._commit(nest=False)
        elif action == "skip":
            self.advance()
        else:
            super().keyPressEvent(event)

    def _action_for(self, key: int) -> str | None:
        for action, bound in self.keys.items():
            if bound == key:
                return action
        return None

    # --- menu actions -----------------------------------------------------
    def open_spreadsheet(self) -> None:
        start = str(self._input_path.parent)
        fn, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open Macaulay export", start,
            "Spreadsheets (*.csv *.xlsx *.xlsm);;All files (*)",
        )
        if not fn:
            return
        input_path = Path(fn)
        try:
            catalog, _ = Catalog.open(input_path, self.catalog.master)
        except (ValidationError, OSError) as exc:
            QtWidgets.QMessageBox.critical(self, "Can't open file", str(exc))
            return
        self.media.stop()
        self.catalog = catalog
        self._input_path = input_path
        self.idx = catalog.first_unreviewed()
        self.structure = False
        self.show_current()

    def open_preferences(self) -> None:
        dlg = PreferencesDialog(self, current_output_dir=config.get_output_dir())
        if dlg.exec() != QtWidgets.QDialog.Accepted:
            return
        config.set_keys(dlg.result_keys())
        self.keys = config.keymap_ints()
        self._apply_output_dir(dlg.result_output_dir())
        self.statusBar().showMessage(self._legend())
        self.show_current()  # refresh done-screen hints, etc.

    def _apply_output_dir(self, out_dir: str | None) -> None:
        config.set_output_dir(out_dir)
        folder = config.resolved_output_dir()
        if Path(self.catalog.master.folder) != folder:
            # Move to the new master, carrying this file's completed rows across.
            self.catalog.retarget_master(MasterLog(folder))

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
        fmt = row.get("Format", "")
        self.media.show_asset(ml_id, fmt)
        self.meta_lbl.setText(self._meta_html(row))
        self._update_chips()
        self._prefetch_upcoming()
        hint = "    ·    click video to play/pause" if fmt == "Video" else ""
        self.statusBar().showMessage(self._legend() + hint)

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

        toggle = config.key_display(config.get_keys()["toggle_structure"])
        if self.structure:
            self.struct_chip.setText(f"human-made structure: ON  ({toggle})")
            self.struct_chip.setStyleSheet("padding:6px;border-radius:6px;background:#1565c0;color:#fff;")
        else:
            self.struct_chip.setText(f"human-made structure: off  ({toggle})")
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
            f"<p>{self.catalog.master.count()} completed entries saved to:<br>"
            f"<code>{self.catalog.master.path}</code></p>"
            f"<p>Press <b>{config.key_display(config.get_keys()['back'])}</b> to revisit the "
            f"last item, or <b>{config.key_display(config.get_keys()['quit'])}</b> to quit.</p>"
        )

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        self.media.stop()
        super().closeEvent(event)
