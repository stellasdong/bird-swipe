# bird-swipe

"Bird Tinder" — swipe through Macaulay Library nest media and label each asset
**nest yes/no** and **human-made structure yes/no**, driven by arrow-key hotkeys,
saving after every entry. See [PLAN.md](PLAN.md) for the full design.

## Setup

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -e .
```

## Run (the label loop)

```bash
.venv/bin/python -m bird_swipe.app path/to/export.csv    # or export.xlsx

# With no path it uses a bundled example from test/.
.venv/bin/python -m bird_swipe.app
```

The original download is never modified. Labels are written live into a
`labeled/` folder that defaults to sitting next to the original file:

```
<csv dir>/labeled/<name>_labeled.csv     all completed entries
<csv dir>/labeled/nest/<name>_nest.csv   only the nest=yes entries
```

Both are keyed by ML catalog number; flipping a row out of "nest=yes" removes it
from the nest file. Reopening a file restores its labels so you resume where you
left off.

Options: `--output-dir DIR` (override the output folder),
`--no-resume` (ignore prior labels for this file), `--reviewer NAME`.

Launched with no file (e.g. a freshly installed app), it opens a file picker and,
if you cancel, shows a welcome screen with **Open spreadsheet…** / **Preferences…**
buttons rather than exiting.

**File → Open spreadsheet…** loads another export at runtime.
**File → Preferences…** sets the output folder and lets you rebind every hotkey
(click an action, press the new key). Settings persist across sessions.

### Hotkeys (defaults — rebindable in Preferences)

| Key         | Action |
|-------------|--------|
| `→`         | nest = **YES** → save + next |
| `←`         | nest = **NO** → save + next |
| `↑`         | toggle **human-made structure** for the current item |
| `Space`     | skip (leave unlabeled) → next |
| `Backspace` | go back to the previous item |
| `Esc`       | quit (everything is already saved) |

Reopening the same file resumes at the first unlabeled asset.

## Media probe / spike

```bash
.venv/bin/python -m bird_swipe.core.macaulay 661965337   # verify photo fetch
.venv/bin/python -m bird_swipe.spike                      # navigation-only spike
```

## Status

- [x] M0 — spike: native photo + video in a Qt window
- [x] M1 — label loop: validate, hotkeys, save-as-you-go, resume; native video
- [x] M2 — `.xlsx` read/write + photo prefetch for instant swipes
- [ ] M3 — polish + PyInstaller builds (Windows/Mac)
