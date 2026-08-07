# bird-swipe

"Bird Tinder" — swipe through Macaulay Library nest media and label each asset
**nest yes/no** and **human-made structure yes/no**, driven by arrow-key hotkeys,
saving after every entry. See [PLAN.md](PLAN.md) for the full design.

## Setup

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -e .
```

## Run (M1 — the label loop)

```bash
# Save labels to a copy (<name>.labeled.csv); original stays untouched:
.venv/bin/python -m bird_swipe.app path/to/export.csv

# With no path it uses the bundled example export.
.venv/bin/python -m bird_swipe.app
```

Options: `--output OUT.csv`, `--in-place` (edit the original), `--no-resume`
(start over), `--reviewer NAME`.

### Hotkeys

| Key         | Action |
|-------------|--------|
| `→`         | nest = **YES** → save + next |
| `←`         | nest = **NO** → save + next |
| `↑`         | toggle **human-made structure** for the current item |
| `Space`     | skip (leave unlabeled) → next |
| `Backspace` | go back to the previous item |
| `Esc` / `Q` | quit (everything is already saved) |

Reopening the same file resumes at the first unlabeled asset.

## Media probe / spike

```bash
.venv/bin/python -m bird_swipe.core.macaulay 661965337   # verify photo fetch
.venv/bin/python -m bird_swipe.spike                      # navigation-only spike
```

## Status

- [x] M0 — spike: native photo + embedded video in a Qt window
- [x] M1 — label loop: validate, hotkeys, save-as-you-go, resume (CSV)
- [ ] M2 — in-app video + `.xlsx` I/O + prefetch cache
- [ ] M3 — polish + PyInstaller builds (Windows/Mac)
