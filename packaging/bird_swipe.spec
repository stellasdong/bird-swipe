# PyInstaller spec for bird-swipe (macOS .app + Windows .exe).
#
# Build:  pyinstaller packaging/bird_swipe.spec --noconfirm
#
# collect_all("PySide6") is deliberate: it bundles the full Qt runtime including
# the QtMultimedia FFmpeg backend plugin and its dylibs/DLLs, so video playback
# works in the frozen app. It's large but reliable — the priority is that the
# app "just works" for non-technical users.

import os
import sys

from PyInstaller.utils.hooks import collect_all

ROOT = os.path.dirname(SPECPATH)  # repo root (spec lives in packaging/)

datas, binaries, hiddenimports = [], [], []
for pkg in ("PySide6", "openpyxl", "platformdirs"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    [os.path.join(SPECPATH, "entry.py")],
    pathex=[ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="bird-swipe",
    console=False,          # GUI app: no terminal window
    disable_windowed_traceback=False,
    argv_emulation=True,    # macOS: accept files dropped/opened onto the app
    target_arch=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="bird-swipe",
)

app = BUNDLE(
    coll,
    name="bird-swipe.app",
    icon=None,
    bundle_identifier="org.macaulaylibrary.birdswipe",
    info_plist={
        "CFBundleName": "bird-swipe",
        "CFBundleDisplayName": "bird-swipe",
        "NSHighResolutionCapable": True,
        # Streams video over the network; declare intent for macOS.
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
    },
)
