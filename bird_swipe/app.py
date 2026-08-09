"""bird-swipe entry point.

    bird-swipe [EXPORT]                   # label a Macaulay export (.csv/.xlsx)
    bird-swipe EXPORT --output-dir DIR    # put <name>_labeled.csv in DIR
    bird-swipe EXPORT --no-resume         # ignore prior labels for this file

Completed entries are written live into <output-dir>/<name>_labeled.<ext> (the
original file name plus a _labeled suffix). The output folder and hotkeys are
also configurable in-app via File > Preferences.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from bird_swipe import config
from bird_swipe.core.catalog import Catalog, ValidationError

_REPO_ROOT = Path(__file__).resolve().parent.parent

# Uncategorized Qt warnings (not filterable via QT_LOGGING_RULES) that flood the
# console during video playback on macOS. Harmless — Qt probing an audio *input*
# device we never use. See README / the audio-warning discussion.
_QT_NOISE = (
    "QAudioSource: Unable to use find most recent CoreAudio",
)


def _silence_multimedia_noise() -> None:
    """Quiet Qt's multimedia log spam without hiding real errors."""
    # Must be set before Qt initializes: drops the categorized qt.multimedia lines.
    os.environ.setdefault("QT_LOGGING_RULES", "qt.multimedia.*=false")

    from PySide6 import QtCore

    def handler(mode, context, message):
        if any(noise in message for noise in _QT_NOISE):
            return  # swallow the repetitive audio-input warning
        sys.stderr.write(message + "\n")  # forward everything else

    QtCore.qInstallMessageHandler(handler)


def _default_input() -> str | None:
    """A bundled test export, so `bird-swipe` with no args works during dev."""
    for p in sorted((_REPO_ROOT / "test").glob("*.csv")):
        return str(p)
    return None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="bird-swipe", description="Swipe through Macaulay nest media.")
    p.add_argument("export", nargs="?", default=_default_input(),
                   help="Macaulay export (.csv or .xlsx)")
    p.add_argument("--output-dir", help="Folder for <name>_labeled files (default: see Preferences)")
    p.add_argument("--no-resume", action="store_true", help="Ignore existing labels for this file")
    p.add_argument("--reviewer", default="", help="Name recorded in the reviewer column")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    if not args.export:
        print("No export given and no test file found. Pass a .csv/.xlsx path.", file=sys.stderr)
        return 1
    input_path = Path(args.export)
    if not input_path.exists():
        print(f"File not found: {input_path}", file=sys.stderr)
        return 1

    out_dir = args.output_dir or config.get_output_dir()  # None -> ./labeled default

    try:
        catalog, validation = Catalog.open(input_path, out_dir, resume=not args.no_resume)
    except ValidationError as exc:
        print(f"Not a valid Macaulay export:\n  {exc}", file=sys.stderr)
        return 2

    for w in validation.warnings:
        print(f"warning: {w}", file=sys.stderr)
    print(f"input : {input_path}")
    print(f"output: {catalog.labeled.path}   ({catalog.labeled.count()} completed entries so far)")
    print(f"resuming at item {catalog.first_unreviewed() + 1} of {len(catalog.rows)}")

    # Import Qt lazily so --help etc. work without a display.
    _silence_multimedia_noise()
    from PySide6 import QtWidgets
    from bird_swipe.ui.main_window import MainWindow

    app = QtWidgets.QApplication(sys.argv[:1])
    win = MainWindow(catalog, input_path=input_path, reviewer=args.reviewer)
    win.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
