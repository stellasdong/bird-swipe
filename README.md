# bird-swipe

Swipe through Macaulay Library nest media and label each asset
**nest yes/no** and **human-made structure yes/no**, driven by arrow-key hotkeys,
saving after every entry. See [PLAN.md](PLAN.md) for the full design.

## Download & install (no coding needed)

1. Go to the **[Releases page](../../releases/latest)**.
2. Download the file for your computer:
   - **macOS** → `bird-swipe-macos.zip`
   - **Windows** → `bird-swipe-windows.zip`
3. Double-click the downloaded `.zip` to unzip it, then open the app:
   - **macOS:** the first time, **right-click** `bird-swipe.app` → **Open** →
     **Open** (this clears Apple's "unidentified developer" warning; a normal
     double-click works after that).
   - **Windows:** open the unzipped folder and double-click `bird-swipe.exe`. If
     you see a blue "Windows protected your PC" box, click **More info → Run
     anyway** (it appears because the app isn't code-signed).
4. The app opens to a **welcome screen** → click **Open spreadsheet…** and pick a
   Macaulay Library export (`.csv` or `.xlsx`) you downloaded. That's it.

> The download you feed it is one species' nest export from the Macaulay Library
> (its first column is the ML Catalog Number). Your labels are saved next to that
> file — see [How labels are saved](#how-labels-are-saved). Your original file is
> never changed.

## How to label

| Key         | Action |
|-------------|--------|
| `→`         | nest = **YES** → save + next |
| `←`         | nest = **NO** → save + next |
| `↑`         | toggle **human-made structure** for the current item |
| `N`         | type a **note** for this item (Enter returns to labeling; saved on YES/NO) |
| `Space`     | skip (leave unlabeled) → next |
| `Backspace` | go back to the previous item |
| `Esc`       | quit (everything is already saved) |

Hotkeys are rebindable in **File → Preferences…**. Reopening a file resumes at
the first unlabeled asset. Click a video to play/pause it.

## How labels are saved

The original download is never modified. Labels are written live into a
`labeled/` folder that defaults to sitting next to the original file:

```
<csv dir>/labeled/<name>_labeled.csv     all completed entries
<csv dir>/labeled/nest/<name>_nest.csv   only the nest=yes entries
```

Both are keyed by ML catalog number; flipping a row out of "nest=yes" removes it
from the nest file. Change where these go in **File → Preferences…**.

---

## For developers

### Setup

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -e .
```

### Run from source

```bash
.venv/bin/python -m bird_swipe.app path/to/export.csv    # or export.xlsx
.venv/bin/python -m bird_swipe.app                        # dev: loads a test/ file
```

Options: `--output-dir DIR` (override the output folder),
`--no-resume` (ignore prior labels for this file), `--reviewer NAME`.

### Build the apps

```bash
pip install pyinstaller
pyinstaller packaging/bird_swipe.spec --noconfirm
# -> dist/bird-swipe.app  (macOS)   or   dist/bird-swipe/  (Windows)
```

CI ([.github/workflows/build.yml](.github/workflows/build.yml)) builds both
macOS and Windows on every push. **To publish a release for users**, push a
version tag — that attaches the built apps to a GitHub Release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

### Media probe / spike

```bash
.venv/bin/python -m bird_swipe.core.macaulay 661965337   # verify photo fetch
.venv/bin/python -m bird_swipe.spike                      # navigation-only spike
```

## Status

- [x] M0 — spike: native photo + video in a Qt window
- [x] M1 — label loop: validate, hotkeys, save-as-you-go, resume; native video
- [x] M2 — `.xlsx` read/write + photo prefetch for instant swipes
- [x] M3 — first-run dialog + PyInstaller builds + CI release (Windows/Mac)
