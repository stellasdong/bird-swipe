"""Persisted user settings: output folder + customizable hotkeys.

Stored as JSON in the platform config dir. Keys are saved as human-readable Qt
key names (e.g. "Right", "Space") so the file stays editable by hand.
"""

from __future__ import annotations

import json
from pathlib import Path

from platformdirs import user_config_dir
from PySide6 import QtGui

APP = "bird-swipe"

# action -> default key name
DEFAULT_KEYS = {
    "nest_yes": "Right",
    "nest_no": "Left",
    "toggle_structure": "Up",
    "focus_notes": "N",
    "skip": "Space",
    "back": "Backspace",
    "quit": "Esc",
}
ACTION_ORDER = ["nest_yes", "nest_no", "toggle_structure", "focus_notes", "skip", "back", "quit"]
ACTION_LABELS = {
    "nest_yes": "Nest = YES  (save + next)",
    "nest_no": "Nest = NO  (save + next)",
    "toggle_structure": "Toggle human-made structure",
    "focus_notes": "Type a note for this item",
    "skip": "Skip  (leave unlabeled)",
    "back": "Previous item",
    "quit": "Quit",
}


def config_path() -> Path:
    return Path(user_config_dir(APP, APP)) / "config.json"


def load() -> dict:
    try:
        return json.loads(config_path().read_text(encoding="utf-8"))
    except Exception:
        return {}


def save(cfg: dict) -> None:
    p = config_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.part")
    tmp.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    tmp.replace(p)


# --- hotkeys ----------------------------------------------------------------
def get_keys() -> dict:
    """Merge saved key names over the defaults."""
    keys = dict(DEFAULT_KEYS)
    saved = load().get("keys", {})
    if isinstance(saved, dict):
        for action, name in saved.items():
            if action in keys and isinstance(name, str) and name:
                keys[action] = name
    return keys


def set_keys(keys: dict) -> None:
    cfg = load()
    cfg["keys"] = {a: keys[a] for a in DEFAULT_KEYS if a in keys}
    save(cfg)


def name_to_key(name: str) -> int:
    """"Right" -> Qt.Key_Right (int). 0 if unparseable."""
    seq = QtGui.QKeySequence(name)
    if seq.count() == 0:
        return 0
    combo = seq[0]
    try:
        return int(combo.key())  # PySide6 6.x: QKeyCombination
    except AttributeError:
        return int(combo)


def key_to_name(key: int) -> str:
    """Qt.Key_Right -> "Right". Used both for display and for saving."""
    return QtGui.QKeySequence(key).toString() or f"key {key}"


# Prettier glyphs for the on-screen legend; other keys show their name as-is.
_KEY_GLYPHS = {"Right": "→", "Left": "←", "Up": "↑", "Down": "↓"}


def key_display(name: str) -> str:
    """Legend-friendly label for a key name (arrows become their glyph)."""
    return _KEY_GLYPHS.get(name, name)


def keymap_ints() -> dict:
    """action -> Qt key int, ready for comparison against event.key()."""
    return {action: name_to_key(name) for action, name in get_keys().items()}


# --- output folder ----------------------------------------------------------
def get_output_dir() -> str | None:
    """The user's chosen output folder, or None to use the default (a ``labeled/``
    folder beside each input file — see ``catalog.default_output_dir``)."""
    value = load().get("output_dir")
    return value if isinstance(value, str) and value else None


def set_output_dir(path: str | None) -> None:
    cfg = load()
    if path:
        cfg["output_dir"] = str(path)
    else:
        cfg.pop("output_dir", None)
    save(cfg)
