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
3. Label it. Your progress is saved as you go, so you can close the tab and come
   back — the spreadsheet reappears under **In progress on this computer**.
4. When you reach the end, click **Send to SharePoint…** and choose the shared
   folder. Only finished work goes there — nothing half-labeled.

The browser asks permission the first time you pick the folder. Choose **Allow
on every visit** so later submissions are one click.

### Autosave (recommended)

On first run bird-swipe offers to **autosave a backup copy** to a folder of your
choosing. Turn it on and every save is written to that folder as well as to the
browser, so your work survives clearing browsing data or switching browsers.

Make a folder for it first — e.g. `Documents/bird-swipe` — because Chrome won't
hand over `Documents` itself. Point it somewhere *other* than the shared
SharePoint folder; the app will refuse if you pick the same one, so half-labeled
files never land where finished work goes. (Pointing it at a personal OneDrive
folder is a fine way to get an off-machine backup.)

It's optional and can be turned on or off any time from the welcome screen. If
the folder ever goes missing, labeling carries on regardless and you get a
warning — the browser copy is the one that has to work.

### Setting up the shared folder (once)

Work for this project goes into the **Macaulay Raptor Nest Project** folder,
where each researcher has their own designated subfolder. Ask the project lead
for the link if you don't have it.

1. Open the link and click **Add shortcut to My files**. The folder now appears
   in your own OneDrive.
2. Make sure the OneDrive app is installed and signed in with your **TAMU
   account**, so the folder syncs down to your computer.
3. Right-click your subfolder → **Always keep on this device**.

In the folder picker it's at:

| | |
|---|---|
| **Windows** | `This PC` → `OneDrive - Texas A&M University` → `Macaulay Raptor Nest Project` → *your folder* |
| **macOS** | `Locations` → `OneDrive - Texas A&M University` → `Macaulay Raptor Nest Project` → *your folder* |

**Pick your own subfolder**, not the project folder above it. bird-swipe shows
which folder it will send to on the welcome screen and again on the done screen
— check it says your name before you submit, because everyone's folders sit
side by side and the app can't tell them apart for you.

Two things that will otherwise trip you up:

- **Chrome won't hand over `Documents`, `Desktop`, `Downloads` or your home
  folder themselves** — you have to pick a folder inside one of them. Your
  OneDrive subfolder is fine. (Opening the *export* from Downloads is fine too;
  that's a single file, not a folder.)
- **If OneDrive keeps files in the cloud only**, the app will refuse to save
  rather than risk overwriting good data with a partial file. "Always keep on
  this device" avoids that.

> After your first submit, open the folder in a browser and check the files
> actually arrived. Nothing verifies this for you — if you pick a plain local
> folder by mistake, saving still succeeds and nobody finds out.

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
the browser on your own computer**, plus an autosave folder if you set one up.
Nothing is shared yet. Keeping the browser copy is what lets you open an export
straight from Downloads without granting access to any folder.

When you click **Send to SharePoint…**, two files are written into the folder
you choose:

```
labeled/<name>_labeled.csv        all completed entries
labeled/nest/<name>_nest.csv      only the nest=yes entries
```

The `nest/` subfolder is the point of the split: it collects only the
nest-positive rows across every spreadsheet, so they can be picked up as a
group. Autosave writes the same two paths inside your autosave folder.

Each row gets the columns `nest_label`, `human_structure`, `anthropogenic`,
`eggs`, `notes`, `reviewed`, `reviewed_at`, and `reviewer` appended to the
original ones. Both are keyed by ML catalog number; flipping a row out of
"nest=yes" removes it from the nest file.

> **Submit when you finish a spreadsheet.** Without autosave, in-progress work
> lives only in that browser on that computer: it survives closing the tab,
> quitting the browser and restarting the machine, but **clearing your browsing
> data will delete it**. Turning on autosave (above) removes that risk, and the
> done screen also offers **Download a copy** at any time.

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

Open **http://localhost:8000/web/test.html** — 143 assertions covering the CSV
parser, the label scheme, resume, the truncation guard, the debounced writer,
the in-browser progress store, autosave mirroring and the output folder layout,
plus round-trips of every real export in `test/`. The page title shows a ✓ or ✗
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
web/storage.js    file picking, progress, autosave mirroring, submit
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
- [x] M7 — optional autosave of in-progress work to a local folder
