"""Media widget: native photo for images, embedded webview player for video."""

from __future__ import annotations

from PySide6 import QtCore, QtGui, QtWidgets
from PySide6.QtWebEngineWidgets import QWebEngineView

from bird_swipe.core import macaulay


class _PhotoFetcher(QtCore.QThread):
    done = QtCore.Signal(str, bytes)
    failed = QtCore.Signal(str, str)

    def __init__(self, ml_id: str):
        super().__init__()
        self.ml_id = ml_id

    def run(self) -> None:
        try:
            self.done.emit(self.ml_id, macaulay.fetch_photo(self.ml_id))
        except Exception as exc:  # pragma: no cover - live network
            self.failed.emit(self.ml_id, str(exc))


class MediaView(QtWidgets.QStackedWidget):
    """Call :meth:`show_asset` to render a photo or video for an ML id."""

    def __init__(self, parent: QtWidgets.QWidget | None = None):
        super().__init__(parent)
        self._current_id: str | None = None
        self._pixmap: QtGui.QPixmap | None = None
        self._fetcher: _PhotoFetcher | None = None

        self.photo = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter)
        self.photo.setMinimumSize(640, 480)
        self.photo.setStyleSheet("background:#111;color:#bbb;font-size:14px;")
        self.web = QWebEngineView()

        self.addWidget(self.photo)  # index 0
        self.addWidget(self.web)    # index 1

    def show_asset(self, ml_id: str, fmt: str) -> None:
        self._current_id = ml_id
        if fmt == "Video":
            self._pixmap = None
            self.web.load(QtCore.QUrl(macaulay.embed_url(ml_id)))
            self.setCurrentWidget(self.web)
            return

        self.setCurrentWidget(self.photo)
        self._pixmap = None
        self.photo.setText(f"Loading {ml_id}…")
        if self._fetcher is not None and self._fetcher.isRunning():
            self._fetcher.wait()
        self._fetcher = _PhotoFetcher(ml_id)
        self._fetcher.done.connect(self._on_photo)
        self._fetcher.failed.connect(self._on_error)
        self._fetcher.start()

    @QtCore.Slot(str, bytes)
    def _on_photo(self, ml_id: str, data: bytes) -> None:
        if ml_id != self._current_id:  # user moved on; drop stale result
            return
        pix = QtGui.QPixmap()
        pix.loadFromData(data)
        self._pixmap = pix
        self._rescale()

    @QtCore.Slot(str, str)
    def _on_error(self, ml_id: str, msg: str) -> None:
        if ml_id == self._current_id:
            self.photo.setText(f"Failed to load {ml_id}\n{msg}")

    def _rescale(self) -> None:
        if self._pixmap is None:
            return
        self.photo.setPixmap(
            self._pixmap.scaled(
                self.photo.size(), QtCore.Qt.KeepAspectRatio, QtCore.Qt.SmoothTransformation
            )
        )

    def resizeEvent(self, event: QtGui.QResizeEvent) -> None:
        super().resizeEvent(event)
        self._rescale()

    def stop(self) -> None:
        if self._fetcher is not None and self._fetcher.isRunning():
            self._fetcher.wait()
