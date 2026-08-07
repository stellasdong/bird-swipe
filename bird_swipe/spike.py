"""M0 spike — de-risk the two hardest pieces before building the label loop:

  1. fetch + display a Macaulay photo natively
  2. play a Macaulay video in an embedded webview

Not the real app: navigation only (Left/Right), no labeling, no saving.

    python -m bird_swipe.spike [path/to/export.csv]
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from PySide6 import QtCore, QtGui, QtWidgets
from PySide6.QtWebEngineWidgets import QWebEngineView

from bird_swipe.core import macaulay

DEFAULT_CSV = Path(__file__).resolve().parent.parent / "ML__2026-08-07T18-46_rethaw.csv"


def load_rows(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


class PhotoFetcher(QtCore.QThread):
    """Fetch JPEG bytes off the UI thread so navigation stays responsive."""

    done = QtCore.Signal(str, bytes)
    failed = QtCore.Signal(str, str)

    def __init__(self, ml_id: str):
        super().__init__()
        self.ml_id = ml_id

    def run(self) -> None:
        try:
            data = macaulay.fetch_photo(self.ml_id)
            self.done.emit(self.ml_id, data)
        except Exception as exc:  # pragma: no cover - live network
            self.failed.emit(self.ml_id, str(exc))


class SpikeWindow(QtWidgets.QMainWindow):
    def __init__(self, rows: list[dict]):
        super().__init__()
        self.rows = rows
        self.idx = 0
        self._fetcher: PhotoFetcher | None = None

        self.setWindowTitle("bird-swipe · M0 spike")
        self.resize(1100, 800)

        # Media area: a stack swapping between a photo label and a video webview.
        self.photo = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter)
        self.photo.setMinimumSize(640, 480)
        self.photo.setStyleSheet("background:#111;color:#bbb;")
        self.web = QWebEngineView()
        self.stack = QtWidgets.QStackedWidget()
        self.stack.addWidget(self.photo)  # index 0
        self.stack.addWidget(self.web)    # index 1

        self.meta = QtWidgets.QLabel(wordWrap=True)
        self.meta.setTextFormat(QtCore.Qt.RichText)
        self.meta.setOpenExternalLinks(True)
        self.meta.setStyleSheet("padding:8px;")

        central = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(central)
        layout.addWidget(self.stack, stretch=1)
        layout.addWidget(self.meta)
        self.setCentralWidget(central)

        self.statusBar().showMessage("← / →  navigate    ·    Esc  quit")
        self.show_current()

    # --- navigation -------------------------------------------------------
    def keyPressEvent(self, event: QtGui.QKeyEvent) -> None:
        key = event.key()
        if key == QtCore.Qt.Key_Right:
            self.idx = min(self.idx + 1, len(self.rows) - 1)
            self.show_current()
        elif key == QtCore.Qt.Key_Left:
            self.idx = max(self.idx - 1, 0)
            self.show_current()
        elif key in (QtCore.Qt.Key_Escape, QtCore.Qt.Key_Q):
            self.close()
        else:
            super().keyPressEvent(event)

    # --- rendering --------------------------------------------------------
    def show_current(self) -> None:
        row = self.rows[self.idx]
        ml_id = row["ML Catalog Number"]
        fmt = row.get("Format", "")
        self.setWindowTitle(f"bird-swipe · [{self.idx + 1}/{len(self.rows)}] · {fmt} {ml_id}")
        self.meta.setText(self._meta_html(row))

        if fmt == "Video":
            self.web.load(QtCore.QUrl(macaulay.embed_url(ml_id)))
            self.stack.setCurrentIndex(1)
        else:
            self.stack.setCurrentIndex(0)
            self.photo.setText(f"Loading {ml_id}…")
            self._start_fetch(ml_id)

    def _start_fetch(self, ml_id: str) -> None:
        if self._fetcher is not None and self._fetcher.isRunning():
            self._fetcher.wait()
        self._fetcher = PhotoFetcher(ml_id)
        self._fetcher.done.connect(self._on_photo)
        self._fetcher.failed.connect(self._on_photo_error)
        self._fetcher.start()

    @QtCore.Slot(str, bytes)
    def _on_photo(self, ml_id: str, data: bytes) -> None:
        # Ignore stale results if the user navigated away mid-fetch.
        if self.rows[self.idx]["ML Catalog Number"] != ml_id:
            return
        pix = QtGui.QPixmap()
        pix.loadFromData(data)
        self.photo.setPixmap(
            pix.scaled(self.photo.size(), QtCore.Qt.KeepAspectRatio, QtCore.Qt.SmoothTransformation)
        )

    @QtCore.Slot(str, str)
    def _on_photo_error(self, ml_id: str, msg: str) -> None:
        if self.rows[self.idx]["ML Catalog Number"] == ml_id:
            self.photo.setText(f"Failed to load {ml_id}\n{msg}")

    def _meta_html(self, row: dict) -> str:
        ml_id = row["ML Catalog Number"]
        page = macaulay.asset_page_url(ml_id)
        fields = ["Common Name", "Scientific Name", "Caption", "Behaviors", "Date", "Locality", "Asset Tags"]
        parts = [f"<b>ML {ml_id}</b> · <a href='{page}'>{page}</a><br>"]
        parts += [f"<b>{k}:</b> {row.get(k, '')}  " for k in fields if row.get(k)]
        return "".join(parts)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv if argv is None else argv
    csv_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_CSV
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        return 1
    rows = load_rows(csv_path)
    if not rows:
        print("No rows in CSV.")
        return 1

    app = QtWidgets.QApplication(argv)
    win = SpikeWindow(rows)
    win.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
