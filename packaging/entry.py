"""Frozen-app entry point (PyInstaller runs this)."""

from bird_swipe.app import main

if __name__ == "__main__":
    raise SystemExit(main())
