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

The original download is never modified. Every **completed** entry is written
live into a single accumulating master — `all_labeled.csv` inside the output
folder — keyed by ML catalog number. Labeling many species files over time grows
that one CSV; reopening a file restores its labels so you resume where you left
off. (Each Macaulay download is already one species, so no per-species split is
needed.)

Options: `--output-dir DIR` (folder for `all_labeled.csv`),
`--no-resume` (ignore prior labels for this file), `--reviewer NAME`.

**File → Open spreadsheet…** loads another export at runtime (same master).
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
