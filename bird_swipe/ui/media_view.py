"""Media widget: native photo for images, native QMediaPlayer for video.

Video is played with QtMultimedia (AVFoundation on macOS, Media Foundation on
Windows) rather than an embedded webview, because the PySide6 QtWebEngine wheels
ship without the proprietary H.264 codec that Macaulay videos use.
"""

from __future__ import annotations

from PySide6 import QtCore, QtGui, QtWidgets
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtMultimediaWidgets import QVideoWidget

from bird_swipe.core import macaulay


class _ClickableVideo(QVideoWidget):
    """A video surface that reports clicks so we can toggle play/pause."""

    clicked = QtCore.Signal()

    def mousePressEvent(self, event) -> None:
        self.clicked.emit()
        super().mousePressEvent(event)


class _PrefetchTask(QtCore.QRunnable):
    """Warm the disk cache for an upcoming photo; result is discarded."""

    def __init__(self, ml_id: str):
        super().__init__()
        self.ml_id = ml_id

    def run(self) -> None:
        try:
            macaulay.fetch_photo(self.ml_id)
        except Exception:  # pragma: no cover - best-effort prefetch
            pass


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
        self._fetchers: list[_PhotoFetcher] = []  # kept alive until each finishes

        self._pool = QtCore.QThreadPool(self)
        self._pool.setMaxThreadCount(3)
        self._prefetched: set[str] = set()

        self.photo = QtWidgets.QLabel(alignment=QtCore.Qt.AlignCenter)
        self.photo.setMinimumSize(640, 480)
        self.photo.setStyleSheet("background:#111;color:#bbb;font-size:14px;")

        self.video = _ClickableVideo()
        self.video.setStyleSheet("background:#111;")
        self.video.setCursor(QtCore.Qt.PointingHandCursor)
        self.video.setToolTip("Click to play / pause")
        self.video.clicked.connect(self.toggle_play)
        self._player = QMediaPlayer(self)
        self._audio = QAudioOutput(self)
        self._player.setAudioOutput(self._audio)
        self._player.setVideoOutput(self.video)
        self._player.setLoops(QMediaPlayer.Infinite)  # loop so nothing to re-trigger
        self._player.errorOccurred.connect(self._on_video_error)

        self.addWidget(self.photo)  # index 0
        self.addWidget(self.video)  # index 1

    def show_asset(self, ml_id: str, fmt: str) -> None:
        self._current_id = ml_id
        if fmt == "Video":
            self.setCurrentWidget(self.video)
            self._pixmap = None
            # Fully stop the previous stream before re-pointing the backend, so
            # rapid swiping doesn't leave a half-buffered network stream behind.
            self._player.stop()
            self._player.setSource(QtCore.QUrl(macaulay.video_url(ml_id)))
            self._player.play()
            return

        self._player.stop()
        self.setCurrentWidget(self.photo)
        self._pixmap = None
        self.photo.setText(f"Loading {ml_id}…")
        # Start a fetch without blocking the UI thread; a stale result is dropped
        # in _on_photo by the ml_id check. The thread is reaped when it finishes.
        fetcher = _PhotoFetcher(ml_id)
        fetcher.done.connect(self._on_photo)
        fetcher.failed.connect(self._on_error)
        fetcher.finished.connect(lambda f=fetcher: self._reap_fetcher(f))
        self._fetchers.append(fetcher)
        fetcher.start()

    def _reap_fetcher(self, fetcher: _PhotoFetcher) -> None:
        if fetcher in self._fetchers:
            self._fetchers.remove(fetcher)
        fetcher.deleteLater()

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

    @QtCore.Slot(QMediaPlayer.Error, str)
    def _on_video_error(self, error, msg: str) -> None:  # pragma: no cover - live media
        if error != QMediaPlayer.NoError:
            print(f"video error for {self._current_id}: {msg}")

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

    def toggle_play(self) -> None:
        """Pause/resume the video (no-op when a photo is showing)."""
        if self.currentWidget() is not self.video:
            return
        if self._player.playbackState() == QMediaPlayer.PlayingState:
            self._player.pause()
        else:
            self._player.play()

    def prefetch(self, ml_ids: list[str]) -> None:
        """Warm the cache for upcoming photos so the next swipe is instant."""
        for mid in ml_ids:
            if mid in self._prefetched:
                continue
            self._prefetched.add(mid)
            self._pool.start(_PrefetchTask(mid))

    def stop(self) -> None:
        self._player.stop()
        # Wait for any in-flight fetch threads so none is destroyed while running.
        for fetcher in list(self._fetchers):
            if fetcher.isRunning():
                fetcher.wait()
        self._pool.clear()  # drop queued prefetches; running ones finish quickly
