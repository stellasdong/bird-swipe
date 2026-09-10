# bird-swipe

Swipe through Macaulay Library nest media and label each asset **nest yes/no**,
plus three per-image observations — **human-made structure**, **anthropogenic
material**, and **eggs present** — driven by hotkeys, saving after every entry.
See [PLAN.md](PLAN.md) for the original design.

## Open the app (nothing to install)

**→ https://stellasdong.github.io/bird-swipe/**

Open that link in **Google Chrome or Microsoft Edge** on a Mac or Windows PC.
That's the whole install. There is no download, no security warning, and no
update to keep up with — reloading the page always gives you the current
version.

> **Chrome or Edge specifically.** Safari and Firefox can't write to a folder on
> your computer, so labels couldn't be saved. Edge is already on every Windows
> PC; on a Mac, install Chrome once.

### Labeling a spreadsheet

1. Type **your name**. It goes in the `reviewer` column so labels can be traced
   back to whoever made them.
2. Click **Open a spreadsheet…** and pick the Macaulay export you downloaded —
   straight out of your Downloads folder is fine.
3. Label it. Your progress is saved in the browser as you go, so you can close
   the tab and come back; the spreadsheet reappears under **In progress on this
   computer**.
4. When you reach the end, click **Send to SharePoint…** and choose the shared
   folder. Only finished work goes there — nothing half-labeled.

The browser asks permission the first time you pick the folder. Choose **Allow
on every visit** so later submissions are one click.

### Setting up the SharePoint folder (once)

Open the shared document library in a browser and click **Sync** (or **Add
shortcut to OneDrive**). It then shows up as an ordinary folder on your
computer, and **Send to SharePoint…** writes into it — OneDrive syncs it back up
for everyone automatically.

In the folder picker it's at:

| | |
|---|---|
| **Windows** | `This PC` → `OneDrive - <Your University>` |
| **macOS** | `Locations` → `<Your University>` (or `~/Library/CloudStorage/OneDrive-<Your University>`) |

Two things that will otherwise trip you up:

- **Pick the shared folder itself, not `Documents`, `Desktop`, `Downloads` or
  your home folder.** Chrome refuses to hand those top-level folders to a web
  page — you have to choose a folder inside one of them. (Opening the *export*
  from Downloads is fine; that's a single file, not a folder.)
- **Right-click the folder → "Always keep on this device."** Otherwise OneDrive
  may keep files in the cloud only, and the app will refuse to save rather than
  risk overwriting good data with a partial file.

## How to label

| Key       | Action |
|-----------|--------|
| `→`       | nest = **YES** → save + next |
| `←`       | nest = **NO** → save + next |
| `↓`       | next item — an undecided one is recorded as `nest_label=skip` (counts as reviewed) |
| `↑`       | back to the previous item |
| `Q` / `1` | toggle **human-made structure** for the current item |
| `W` / `2` | toggle **anthropogenic material** |
| `E` / `3` | toggle **eggs present** |
| `Enter`   | jump to the notes box |
| `Esc`     | close the file (everything is already saved) |

Each toggle has a letter key and the matching number key, so a number pad works
too. The three also appear as buttons above the image — **green** when yes,
**red** when no — and you can click them instead of using the keys. They always
show what is already saved for that item, so stepping back shows your earlier
answer rather than a blank slate.

Hotkeys are rebindable in **Preferences…**. Reopening a file resumes at the
first **un-reviewed** asset (skipped items count as reviewed, so it won't jump
back to them — but the done screen has a **Review skipped items** button to
revisit them). Click a video to play/pause it. To add a **note**, press `Enter`
(or click the Notes box), type, then press `Enter` again to return to labeling —
the note is saved when you press YES/NO.

## How labels are saved

The original export is never modified. While you label, your work is kept **in
the browser on your own computer** — nothing is written to disk and nothing is
shared yet. That's what lets you open an export straight from Downloads without
granting access to any folder.

When you click **Send to SharePoint…**, two files are written into the folder
you choose:

```
<name>_labeled.csv     all completed entries
<name>_nest.csv        only the nest=yes entries
```

Each row gets the columns `nest_label`, `human_structure`, `anthropogenic`,
`eggs`, `notes`, `reviewed`, `reviewed_at`, and `reviewer` appended to the
original ones. Both are keyed by ML catalog number; flipping a row out of
"nest=yes" removes it from the nest file.

> **Submit when you finish a spreadsheet.** In-progress work lives only in that
> browser on that computer. It survives closing the tab, quitting the browser
> and restarting the machine — but **clearing your browsing data will delete
> it**, and it isn't backed up anywhere. The done screen also offers
> **Download a copy** if you'd rather save the files yourself.

Because each researcher works on their own spreadsheet and submits a finished
file, two people never write the same file at once. If the app does spot labels
from someone else in a file you open, it warns you.

### Your data stays yours

The page is static — there is no server and no account. Your exports and your
labels never leave your computer and the university's own SharePoint; nothing is
uploaded to GitHub or anywhere else. The only network traffic is fetching the
bird photos and videos from Cornell's public media CDN.

---

## For developers

### Run the web app locally

```bash
python3 -m http.server 8000     # from the repo root
# then open http://localhost:8000/web/
```

The File System Access API works on `localhost`, so folder picking behaves
exactly as it does in production.

Load an export without a folder picker (mirrors the desktop app's habit of
opening a `test/` file during development):

```
http://localhost:8000/web/?dev=../test/ML__2026-08-09T19-55_t-11995866.csv
```

Labels stay in memory in that mode and are never written to disk.

### Tests

Open **http://localhost:8000/web/test.html** — 126 assertions covering the CSV
parser, the label scheme, resume, the truncation guard, the debounced writer and
the in-browser progress store, plus round-trips of every real export in `test/`. The page title shows a ✓ or ✗
and the pass/fail count.

### The folder-access spike

**http://localhost:8000/web/spike.html** (or
[the deployed copy](https://stellasdong.github.io/bird-swipe/spike.html)) probes
each risky platform behavior in isolation: browser support, folder read/write,
permission persistence across a reload, OneDrive placeholder truncation, and
media playback. Run it against the real synced SharePoint folder before rolling
the app out — chiefly to confirm that a cloud-only file either hydrates or trips
the truncation guard, and that the picker reaches
`~/Library/CloudStorage/OneDrive-<Tenant>` on macOS.

Chrome and Edge can also disable local file access by policy
(`DefaultFileSystemWriteGuardSetting`), but that needs a managed device or a
managed browser profile — not a concern when researchers use personal laptops.

### Layout

```
web/index.html    the three screens (welcome / label / done)
web/app.js        label loop, hotkeys, rendering      (was ui/main_window.py)
web/catalog.js    load, validate, label, resume       (was core/catalog.py)
web/storage.js    file picking, in-browser progress, submit to a folder
web/csv.js        RFC 4180 parse / serialize
web/macaulay.js   asset URLs                          (was core/macaulay.py)
web/settings.js   reviewer name + hotkeys             (was config.py)
```

No build step and no dependencies — the files that ship are the files in the
repo. `csv.js` is hand-written rather than vendored so the app works offline and
carries no third-party code.

### Deploying

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `web/` to
GitHub Pages on every push to `main`; that push *is* the release. One-time
setup: **Settings → Pages → Source: GitHub Actions**.

### The desktop app

The original PySide6 app still lives in `bird_swipe/` and still works
(`pip install -e .` then `bird-swipe path/to/export.csv`). It is no longer the
recommended way to run bird-swipe: each release was a ~220 MB download per
person, per update, past an "unidentified developer" warning. It shares no code
with the web app.

```bash
python3.12 -m venv .venv && .venv/bin/python -m pip install -e .
.venv/bin/python -m bird_swipe.app path/to/export.csv
pyinstaller packaging/bird_swipe.spec --noconfirm   # build the bundles
```

## Status

- [x] M0 — spike: native photo + video in a Qt window
- [x] M1 — label loop: validate, hotkeys, save-as-you-go, resume; native video
- [x] M2 — `.xlsx` read/write + photo prefetch for instant swipes
- [x] M3 — first-run dialog + PyInstaller builds + CI release (Windows/Mac)
- [x] M4 — static web app: no install, no updates
- [ ] M5 — verify against the real OneDrive-synced SharePoint folder
- [x] M6 — hand finished spreadsheets to a designated SharePoint folder
