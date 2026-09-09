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

### First run

1. Type **your name**. It goes in the `reviewer` column so labels can be traced
   back to whoever made them.
2. Click **Choose folder…** and pick the folder holding your Macaulay exports.
   Your browser will ask permission once — choose **Allow on every visit** so it
   doesn't ask again.
3. Pick a species export from the list that appears, and start labeling.

Next time you open the app, click **Reconnect** and you're straight back in.

### Choosing the shared SharePoint folder

If the lab's exports live in a SharePoint document library, open it in a browser
first and click **Sync** (or **Add shortcut to OneDrive**). It then shows up as
an ordinary folder on your computer, and bird-swipe writes into it like any
other folder — your labels sync back up for everyone automatically.

In the folder picker, that folder is at:

| | |
|---|---|
| **Windows** | `This PC` → `OneDrive - <Your University>` |
| **macOS** | `Locations` → `<Your University>` (or `~/Library/CloudStorage/OneDrive-<Your University>`) |

Two things that will otherwise trip you up:

- **Pick the project folder itself, not `Documents`, `Desktop`, `Downloads` or
  your home folder.** Chrome refuses to hand those top-level folders to a web
  page — you have to choose a folder inside one of them.
- **Right-click the folder → "Always keep on this device."** Otherwise OneDrive
  may keep the files in the cloud only, and the app will refuse to save rather
  than risk overwriting good data with a partial file.

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

The original export is never modified. Labels are written live into a `labeled/`
folder inside the folder you chose:

```
<your folder>/labeled/<name>_labeled.csv     all completed entries
<your folder>/labeled/nest/<name>_nest.csv   only the nest=yes entries
```

Each row gets the columns `nest_label`, `human_structure`, `anthropogenic`,
`eggs`, `notes`, `reviewed`, `reviewed_at`, and `reviewer` appended to the
original ones. Both files are keyed by ML catalog number; flipping a row out of
"nest=yes" removes it from the nest file.

A small but important note on **who edits what**: the app rewrites these whole
files as you go, so **two people should not label the same export at the same
time** — the second person's save would overwrite the first person's. Give each
researcher their own species file. If the app spots labels from someone else in
a file you open, it will warn you.

Saves are batched about a second apart rather than on every keystroke, so a
shared folder isn't uploading on every swipe. The header shows `saved` once your
work is on disk, and anything outstanding is flushed when you close the tab.

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

Open **http://localhost:8000/web/test.html** — 115 assertions covering the CSV
parser, the label scheme, resume, the truncation guard and the debounced writer,
plus round-trips of every real export in `test/`. The page title shows a ✓ or ✗
and the pass/fail count.

### The folder-access spike

**http://localhost:8000/web/spike.html** probes each risky platform behavior in
isolation: browser support, folder read/write, permission persistence across a
reload, OneDrive placeholder truncation, and media playback. Run it on a
university-managed laptop against the real SharePoint folder before rolling the
app out — enterprise policy can disable local file access for websites, and this
tells you in a minute.

### Layout

```
web/index.html    the three screens (welcome / label / done)
web/app.js        label loop, hotkeys, rendering      (was ui/main_window.py)
web/catalog.js    load, validate, label, resume       (was core/catalog.py)
web/storage.js    File System Access API + debounced writes
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
- [x] M4 — static web app: no install, no updates, writes into the shared folder
- [ ] M5 — verify on a university-managed laptop against the real SharePoint folder
