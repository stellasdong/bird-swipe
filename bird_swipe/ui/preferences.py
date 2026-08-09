"""Preferences dialog: choose the output folder and rebind hotkeys."""

from __future__ import annotations

from PySide6 import QtCore, QtWidgets

from bird_swipe import config

_MODIFIERS = {
    QtCore.Qt.Key_Shift, QtCore.Qt.Key_Control, QtCore.Qt.Key_Alt,
    QtCore.Qt.Key_Meta, QtCore.Qt.Key_AltGr,
}


class _KeyCaptureButton(QtWidgets.QPushButton):
    """Click to arm, then the next key pressed becomes this action's binding."""

    captured = QtCore.Signal(str)  # emits the new key name

    def __init__(self, name: str):
        super().__init__()
        self._name = name
        self._capturing = False
        self.setFocusPolicy(QtCore.Qt.StrongFocus)
        self._refresh()
        self.clicked.connect(self._arm)

    def set_name(self, name: str) -> None:
        self._name = name
        self._capturing = False
        self._refresh()

    def _refresh(self) -> None:
        self.setText("press a key…" if self._capturing else self._name)

    def _arm(self) -> None:
        self._capturing = True
        self._refresh()
        self.setFocus()

    def keyPressEvent(self, event) -> None:
        if not self._capturing:
            return super().keyPressEvent(event)
        if event.key() in _MODIFIERS:
            return  # wait for a real key
        self._name = config.key_to_name(event.key())
        self._capturing = False
        self._refresh()
        self.captured.emit(self._name)


class PreferencesDialog(QtWidgets.QDialog):
    def __init__(self, parent=None, current_output_dir: str | None = None):
        super().__init__(parent)
        self.setWindowTitle("Preferences")
        self.setMinimumWidth(460)
        self._keys = config.get_keys()  # working copy
        self._output_dir = current_output_dir  # None => beside input
        self._buttons: dict[str, _KeyCaptureButton] = {}

        lay = QtWidgets.QVBoxLayout(self)

        # --- output folder ---
        lay.addWidget(QtWidgets.QLabel("<b>Output folder</b> &nbsp;<span style='color:#888'>"
                                       "(holds &lt;name&gt;_labeled and nest/&lt;name&gt;_nest)</span>"))
        self._out_edit = QtWidgets.QLineEdit(self._output_dir or "")
        self._out_edit.setPlaceholderText("Default: a 'labeled' folder next to each CSV")
        self._out_edit.setReadOnly(True)
        browse = QtWidgets.QPushButton("Browse…")
        browse.clicked.connect(self._browse)
        use_default = QtWidgets.QPushButton("Use default")
        use_default.clicked.connect(self._clear_output)
        row = QtWidgets.QHBoxLayout()
        row.addWidget(self._out_edit, stretch=1)
        row.addWidget(browse)
        row.addWidget(use_default)
        lay.addLayout(row)

        # --- hotkeys ---
        lay.addSpacing(8)
        lay.addWidget(QtWidgets.QLabel("<b>Hotkeys</b> &nbsp;<span style='color:#888'>"
                                       "(click a key, then press the new key)</span>"))
        grid = QtWidgets.QGridLayout()
        for i, action in enumerate(config.ACTION_ORDER):
            grid.addWidget(QtWidgets.QLabel(config.ACTION_LABELS[action]), i, 0)
            btn = _KeyCaptureButton(self._keys[action])
            btn.captured.connect(lambda name, a=action: self._set_key(a, name))
            self._buttons[action] = btn
            grid.addWidget(btn, i, 1)
        lay.addLayout(grid)

        reset = QtWidgets.QPushButton("Reset hotkeys to defaults")
        reset.clicked.connect(self._reset_keys)
        lay.addWidget(reset, alignment=QtCore.Qt.AlignLeft)

        self._warn = QtWidgets.QLabel("")
        self._warn.setStyleSheet("color:#c0392b;")
        self._warn.setWordWrap(True)
        lay.addWidget(self._warn)

        buttons = QtWidgets.QDialogButtonBox(
            QtWidgets.QDialogButtonBox.Save | QtWidgets.QDialogButtonBox.Cancel
        )
        buttons.accepted.connect(self._try_accept)
        buttons.rejected.connect(self.reject)
        lay.addWidget(buttons)

    # --- output folder handlers ---
    def _browse(self) -> None:
        d = QtWidgets.QFileDialog.getExistingDirectory(
            self, "Choose output folder", self._output_dir or ""
        )
        if d:
            self._output_dir = d
            self._out_edit.setText(d)

    def _clear_output(self) -> None:
        self._output_dir = None
        self._out_edit.clear()

    # --- hotkey handlers ---
    def _set_key(self, action: str, name: str) -> None:
        self._keys[action] = name

    def _reset_keys(self) -> None:
        self._keys = dict(config.DEFAULT_KEYS)
        for action, btn in self._buttons.items():
            btn.set_name(self._keys[action])
        self._warn.clear()

    def _duplicate_key(self) -> tuple[str, list[str]] | None:
        seen: dict[str, list[str]] = {}
        for action, name in self._keys.items():
            seen.setdefault(name, []).append(action)
        for name, actions in seen.items():
            if len(actions) > 1:
                return name, actions
        return None

    def _try_accept(self) -> None:
        dup = self._duplicate_key()
        if dup:
            name, actions = dup
            labels = ", ".join(config.ACTION_LABELS[a] for a in actions)
            self._warn.setText(f"'{name}' is bound to multiple actions: {labels}. "
                               "Give each action a distinct key.")
            return
        self.accept()

    # --- results ---
    def result_keys(self) -> dict:
        return self._keys

    def result_output_dir(self) -> str | None:
        return self._output_dir
