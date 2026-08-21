"""The label loop: hotkey labeling with save-as-you-go and resume."""

from __future__ import annotations

from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets

from bird_swipe import config
from bird_swipe.core import macaulay
from bird_swipe.core.catalog import Catalog, ValidationError, default_output_dir
from bird_swipe.ui.media_view import MediaView
from bird_swipe.ui.preferences import PreferencesDialog


class _NotesEdit(QtWidgets.QPlainTextEdit):
    """Notes box: Enter returns to labeling (Shift+Enter inserts a line break).

    Esc also returns to labeling — kept only so it can't propagate up and quit
    the app while you're typing.
    """

    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        key = event.key()
        if key in (QtCore.Qt.Key_Return, QtCore.Qt.Key_Enter):
            if event.modifiers() & QtCore.Qt.ShiftModifier:
                super().keyPressEvent(event)  # Shift+Enter -> newline
                return
            self.clearFocus()  # Enter -> back to the label loop
            event.accept()
            return
        if key == QtCore.Qt.Key_Escape:
            self.clearFocus()  # safety: never let Esc bubble up and quit
            event.accept()
            return
        super().keyPressEvent(event)


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self, reviewer: str = "", output_dir: str | None = None):
        super().__init__()
        self.catalog: Catalog | None = None
        self._input_path: Path | None = None
        self._output_override = output_dir  # from --output-dir; else config/default
        self.reviewer = reviewer
        self.idx = 0
        self.structure = False  # pending human-made-structure toggle for current item
        self._reviewing_skipped = False  # walking only skipped items from the done screen
        self._review_history: list[int] = []  # breadcrumb of visited items in that pass
        self.keys = config.keymap_ints()  # action -> Qt key int

        self.setWindowTitle("bird-swipe")
        self.resize(1100, 850)
        self._build_ui()
        self._show_welcome()

    def load_file(self, input_path: str | Path, *, resume: bool = True) -> bool:
        """Open a spreadsheet into the label loop. Returns True on success."""
        input_path = Path(input_path)
        out_dir = self._output_override or config.get_output_dir()
        try:
            catalog, _ = Catalog.open(input_path, out_dir, resume=resume)
        except (ValidationError, OSError) as exc:
            QtWidgets.QMessageBox.critical(self, "Can't open file", str(exc))
            return False
        self.media.stop()
        self.catalog = catalog
        self._input_path = input_path
        self.idx = catalog.first_unreviewed()
        self.structure = False
        self._reviewing_skipped = False
        self._review_history = []
        self.show_current()
        return True

    def prompt_open_on_start(self) -> None:
        """First-run: pop the open dialog; if cancelled, the welcome page stays."""
        self.open_spreadsheet()

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

        self.notes_lbl = QtWidgets.QLabel("Notes  (click to edit · Enter to return)")
        self.notes_lbl.setStyleSheet("color:#888;padding:0 6px;")
        self.notes_edit = _NotesEdit()
        self.notes_edit.setPlaceholderText("Your note for this item (saved when you press YES/NO)…")
        self.notes_edit.setFixedHeight(56)  # ~1–2 sentences
        # Focus only on click — never auto/Tab-grab — so arrow keys stay with the
        # label loop until you deliberately click into the box.
        self.notes_edit.setFocusPolicy(QtCore.Qt.ClickFocus)

        work = QtWidgets.QWidget()
        wlay = QtWidgets.QVBoxLayout(work)
        wlay.addLayout(header)
        wlay.addLayout(chips)
        wlay.addWidget(self.media, stretch=1)
        wlay.addWidget(self.meta_lbl)
        wlay.addWidget(self.notes_lbl)
        wlay.addWidget(self.notes_edit)

        done_page = QtWidgets.QWidget()
        dlay = QtWidgets.QVBoxLayout(done_page)
        dlay.addStretch()
        self.done_lbl = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter, wordWrap=True)
        self.done_lbl.setStyleSheet("font-size:18px;padding:24px;")
        self.review_skipped_btn = QtWidgets.QPushButton("Review skipped items")
        self.review_skipped_btn.setMinimumWidth(220)
        self.review_skipped_btn.clicked.connect(self._start_review_skipped)
        dlay.addWidget(self.done_lbl)
        dlay.addWidget(self.review_skipped_btn, alignment=QtCore.Qt.AlignCenter)
        dlay.addStretch()

        self.pages = QtWidgets.QStackedWidget()
        self.pages.addWidget(work)             # 0
        self.pages.addWidget(done_page)        # 1
        self.pages.addWidget(self._build_welcome())  # 2
        self.setCentralWidget(self.pages)
        self.statusBar().showMessage(self._legend())

    def _build_welcome(self) -> QtWidgets.QWidget:
        page = QtWidgets.QWidget()
        lay = QtWidgets.QVBoxLayout(page)
        lay.addStretch()
        title = QtWidgets.QLabel("bird-swipe", alignment=QtCore.Qt.AlignCenter)
        title.setStyleSheet("font-size:32px;font-weight:700;")
        sub = QtWidgets.QLabel(
            "Open a Macaulay Library export (.csv or .xlsx) to start labeling nests.",
            alignment=QtCore.Qt.AlignCenter,
        )
        sub.setStyleSheet("color:#aaa;padding:8px;")
        open_btn = QtWidgets.QPushButton("Open spreadsheet…")
        open_btn.setMinimumWidth(220)
        open_btn.clicked.connect(self.open_spreadsheet)
        prefs_btn = QtWidgets.QPushButton("Preferences…")
        prefs_btn.setMinimumWidth(220)
        prefs_btn.clicked.connect(self.open_preferences)
        for w in (title, sub):
            lay.addWidget(w)
        lay.addSpacing(12)
        lay.addWidget(open_btn, alignment=QtCore.Qt.AlignCenter)
        lay.addWidget(prefs_btn, alignment=QtCore.Qt.AlignCenter)
        lay.addStretch()
        return page

    def _show_welcome(self) -> None:
        self.pages.setCurrentIndex(2)
        self.setWindowTitle("bird-swipe")
        self.statusBar().showMessage("Open a Macaulay export to begin  ·  File ▸ Open spreadsheet…")

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
                f"    {d(k['toggle_structure'])} toggle structure"
                f"    {d(k['skip'])} skip    {d(k['back'])} back    {d(k['quit'])} quit")

    # --- keys -------------------------------------------------------------
    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        action = self._action_for(event.key())
        if action == "quit":
            self.close()
            return
        if self.catalog is None:  # welcome page — labeling keys do nothing
            super().keyPressEvent(event)
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
            self._skip()
        else:
            super().keyPressEvent(event)

    def _action_for(self, key: int) -> str | None:
        for action, bound in self.keys.items():
            if bound == key:
                return action
        return None

    # --- menu actions -----------------------------------------------------
    def open_spreadsheet(self) -> None:
        start = str(self._input_path.parent) if self._input_path else str(Path.home())
        fn, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open Macaulay export", start,
            "Spreadsheets (*.csv *.xlsx *.xlsm);;All files (*)",
        )
        if fn:
            self.load_file(Path(fn))

    def open_preferences(self) -> None:
        dlg = PreferencesDialog(self, current_output_dir=config.get_output_dir())
        if dlg.exec() != QtWidgets.QDialog.Accepted:
            return
        config.set_keys(dlg.result_keys())
        self.keys = config.keymap_ints()
        self._apply_output_dir(dlg.result_output_dir())
        if self.catalog is None:
            self._show_welcome()
        else:
            self.statusBar().showMessage(self._legend())
            self.show_current()  # refresh done-screen hints, etc.

    def _apply_output_dir(self, out_dir: str | None) -> None:
        config.set_output_dir(out_dir)
        if self.catalog is None:  # nothing open yet; setting takes effect on next open
            return
        folder = Path(out_dir) if out_dir else default_output_dir(self._input_path)
        if Path(self.catalog.labeled.path.parent) != folder:
            # Move the output files to the new folder, carrying rows across.
            self.catalog.retarget_output_dir(folder)

    # --- actions ----------------------------------------------------------
    def _commit(self, nest: bool) -> None:
        self.catalog.set_label(
            self.idx, nest=nest, structure=self.structure,
            reviewer=self.reviewer, notes=self.notes_edit.toPlainText().strip(),
        )
        self.advance()

    def _skip(self) -> None:
        self.catalog.set_skip(
            self.idx, reviewer=self.reviewer, notes=self.notes_edit.toPlainText().strip()
        )
        self.advance()

    def advance(self) -> None:
        self.structure = False
        if self._reviewing_skipped:
            nxt = self._next_skipped_after(self.idx)
            if nxt is None:  # no skips left -> back to the done screen
                self._reviewing_skipped = False
                self._review_history = []
                self.idx = len(self.catalog.rows)
            else:
                self._review_history.append(nxt)
                self.idx = nxt
        else:
            self.idx += 1
        self.show_current()

    def go_back(self) -> None:
        if self._reviewing_skipped:
            # Walk back through the items visited this pass — even ones we've
            # since labeled (so they're no longer "skip") — via a breadcrumb stack.
            if len(self._review_history) <= 1:
                return
            self._review_history.pop()
            self.idx = self._review_history[-1]
        else:
            if self.idx <= 0:
                return
            self.idx -= 1
        row = self.catalog.rows[self.idx]
        self.structure = row.get("human_structure") == "yes"
        self.show_current()

    def _next_skipped_after(self, i: int) -> int | None:
        for j in range(i + 1, len(self.catalog.rows)):
            if self.catalog.is_skipped(j):
                return j
        return None

    def _start_review_skipped(self) -> None:
        skipped = self.catalog.skipped_indices()
        if not skipped:
            return
        self._reviewing_skipped = True
        self._review_history = [skipped[0]]
        self.idx = skipped[0]
        self.structure = self.catalog.rows[self.idx].get("human_structure") == "yes"
        self.show_current()

    # --- rendering --------------------------------------------------------
    def show_current(self) -> None:
        if self.catalog is None:
            self._show_welcome()
            return
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
        mode = "  ·  reviewing skipped" if self._reviewing_skipped else ""
        self.progress_lbl.setText(f"[{self.idx + 1} / {total}]   reviewed {st['reviewed']}{mode}")
        self.setWindowTitle(f"bird-swipe · [{self.idx + 1}/{total}] · ML {ml_id}")
        fmt = row.get("Format", "")
        self.media.show_asset(ml_id, fmt)
        self.meta_lbl.setText(self._meta_html(row))
        self.notes_edit.setPlainText(row.get("notes", ""))
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
        elif label == "skip":
            self.nest_chip.setText("nest: SKIPPED")
            self.nest_chip.setStyleSheet("padding:6px;border-radius:6px;background:#7a5c00;color:#fff;")
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
        self._reviewing_skipped = False
        st = self.catalog.stats()
        self.pages.setCurrentIndex(1)
        self.setWindowTitle("bird-swipe · done")
        skipped = st["skipped"]
        skipped_line = (
            f"<p><b>{skipped}</b> skipped &mdash; use the button below to review them.</p>"
            if skipped else ""
        )
        self.done_lbl.setText(
            f"<h2>All {st['total']} assets reviewed 🎉</h2>"
            f"<p>nest yes: <b>{st['yes']}</b>&nbsp;&nbsp; nest no: <b>{st['no']}</b>"
            f"&nbsp;&nbsp; skipped: <b>{skipped}</b>"
            f"&nbsp;&nbsp; human-made structure: <b>{st['structure']}</b></p>"
            f"{skipped_line}"
            f"<p>{self.catalog.labeled.count()} completed entries saved to:<br>"
            f"<code>{self.catalog.labeled.path}</code></p>"
            f"<p>{self.catalog.nest.count()} nests saved to:<br>"
            f"<code>{self.catalog.nest.path}</code></p>"
            f"<p>Press <b>{config.key_display(config.get_keys()['back'])}</b> to revisit the "
            f"last item, or <b>{config.key_display(config.get_keys()['quit'])}</b> to quit.</p>"
        )
        self.review_skipped_btn.setVisible(bool(skipped))
        self.review_skipped_btn.setText(f"Review {skipped} skipped item{'s' if skipped != 1 else ''}")

    def closeEvent(self, event: QtGui.QCloseEvent) -> None:
        self.media.stop()
        super().closeEvent(event)
