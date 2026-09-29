# bird-swipe

Swipe through Macaulay Library nest media and label each asset **nest yes/no**,
and then, only where there is a nest, everything else about it — **human-made
structure**, **eggs** and **chicks**, what it is **made of**, what **man-made
material** is in it and **where it sits** — driven by hotkeys, saving after
every entry.

**Using it:** [the reviewer's guide](GUIDE.md) — the keys, what each question
means, setting up the shared folder, and what the output columns hold.
**Opening it:** <https://stellasdong.github.io/bird-swipe/>

A static page. No build step, no framework, no dependencies: ES modules served
straight from `web/`, so editing a file and refreshing is the whole loop. The
spreadsheet never leaves the researcher's machine except to the folder they
choose.

See [PLAN.md](PLAN.md) for the original design and [TODO.md](TODO.md) for what
is left and why each decision went the way it did.

---

## Run the web app locally

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

## Tests

Open **http://localhost:8000/web/test.html** — 404 assertions covering the CSV
parser, the label scheme, the nest-only columns, the three term lists and their
filter, nest codes and grouping, provisioning and prey, chick stage, the
reviewer list, language detection and the translation caches, the eBird
checklist link, resume, the truncation guard, the debounced writer, the
in-browser progress store, autosave mirroring, the output folder layout and the
problem report, plus round-trips of every real export in `test/`. The page title
shows a ✓ or ✗ and the pass/fail count.

## The folder-access spike

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

## Layout

```
web/index.html    the three screens (welcome / label / done)
web/app.js        label loop, hotkeys, rendering      (was ui/main_window.py)
web/catalog.js    load, validate, label, resume, and the label columns
                                                      (was core/catalog.py)
web/storage.js    file picking, progress, autosave mirroring, submit
web/csv.js        RFC 4180 parse / serialize
web/macaulay.js   asset and eBird checklist URLs      (was core/macaulay.py)
web/translate.js  language detection and on-device translation of notes
web/report.js     the problem report researchers can send
web/settings.js   reviewer name, hotkeys, remembered picker terms  (was config.py)
web/channel.js    real app or dev preview, and which storage each gets
web/style.css     all of it; no framework
web/test.html     the test suite — open it in a browser, it is also the runner
web/favicon.svg   the tab icon
web/spike.html    a standalone folder-access probe, kept for debugging
```

**The output format lives in `catalog.js`.** `LABEL_COLUMNS` is the list of
columns bird-swipe appends, `NEST_ONLY_COLUMNS` the subset blanked off a nest,
and `setLabel` is the one place a row is written. What each column means, and
what a blank in it signifies, is in [the guide](GUIDE.md#how-labels-are-saved).

No build step and no dependencies — the files that ship are the files in the
repo. `csv.js` is hand-written rather than vendored so the app works offline and
carries no third-party code.

## Deploying

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `web/` to
GitHub Pages on every push to `main`; that push *is* the release. One-time
setup: **Settings → Pages → Source: GitHub Actions**.

## The dev preview

One Pages site carries two copies of the app:

| | |
|---|---|
| https://stellasdong.github.io/bird-swipe/ | the `main` branch — what researchers use |
| https://stellasdong.github.io/bird-swipe/dev/ | the `dev` branch — somewhere to try things |

A push to either branch rebuilds both copies from their own branch, so pushing
`dev` can never republish a stale `main`. Work goes `dev` → PR → `main`, and
merging is still what releases it.

The preview is deliberately hard to mistake for the real app: it wears an amber
**DEV PREVIEW** badge, and — because both copies share one origin, and browser
storage is scoped to the origin rather than the path — it keeps its settings and
its in-progress labels under separate names (`bird-swipe-dev`), so trying
something out there can't touch a real half-labeled spreadsheet. See
[`web/channel.js`](web/channel.js).

A local server is still the fastest loop, and unaffected by any of this:
`localhost` is its own origin, so it has its own storage already.

## The desktop app

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
- [x] M8 — egg and chick counts
- [x] M9 — save local and save to OneDrive as separate, explicit steps
- [x] M10 — error catching and a problem report researchers can email
- [x] M11 — zoom, faster counting, and colour-blind-safe toggles

**4.0 — the nest-details round.** Every observation moved behind the nest
decision, and the spreadsheet gained the columns to go with it.

- [x] M12 — bird present, and a nest-details panel to put it in
- [x] M13 — substrate *(superseded by M17)*
- [x] M14 — provisioning and prey
- [x] M15 — repeat nests *(delivered as part of M25)*
- [x] M16 — chick stage: early, late, unclear
- [x] M17 — one question split into three: substrate, man-made material, location
- [x] M18 — every observation is nest-only; structure chooses the location list
- [x] M19 — location and substrate are required, with `unclear` to keep it honest
- [x] M20 — `Enter` finishes a list; plainer labels on the lists themselves
- [x] M21 — every reviewer of a row is kept, not just the last
- [x] M22 — marking a nest opens the questions it owes, in a run
- [x] M23 — `Tab` walks the panel
- [x] M24 — an open list covers 11% of the photo; settled there
- [x] M25 — duplicate nests, grouped by hand from a contact sheet
- [ ] M25b — suggesting those groups automatically, from the eBird checklist
- [ ] M26 — iPad *(doesn't run: no File System Access API on iOS)*
- [ ] M27 — login and accounts
- [ ] M28 — copying in-progress work from the preview to the real site
- [x] M29 — the recordist and their eBird checklist, in the info blurb
- [x] M30 — the eBirder's own words shown in English, on the device
- [x] M31 — short notes offer a translation instead of skipping it
- [x] M32 — the structure keys answer from inside the location list
