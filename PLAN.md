# bird-swipe — Design & Implementation Plan

"Bird Tinder" — a desktop app for rapidly reviewing Macaulay Library nest media
and labeling each asset **nest / not-nest** and **human-made structure / not**,
driven entirely by arrow-key hotkeys, saving after every entry back into the
original spreadsheet.

---

## 1. Goal & workflow

1. User downloads a Macaulay Library export (one spreadsheet per species) with
   nest-tagged assets. First column is the **ML Catalog Number**.
2. User opens the spreadsheet in bird-swipe.
3. For each asset, the app shows the media (photo or video, replicating
   `https://macaulaylibrary.org/asset/{ML#}`) plus key metadata.
4. User labels with hotkeys; the app **saves after every entry** and can resume
   where it left off.
5. Output: the **original spreadsheet is edited in place** with new label
   columns. (Stretch: also split into positive/negative nest spreadsheets.)

Cross-platform: **Windows + macOS**.

---

## 2. Tech stack (decided)

| Concern            | Choice                                     | Why |
|--------------------|--------------------------------------------|-----|
| Language           | Python 3.11+                               | Requested; matches BirdNET ecosystem |
| GUI                | **PySide6 (Qt for Python)**                | Best cross-platform media + keyboard handling; LGPL |
| Photo display      | Native `QLabel`/`QGraphicsView` from fetched JPEG | Instant, cached, full hotkey control |
| Video display      | **QtWebEngine** embedding the Macaulay embed page | Guaranteed playback without reverse-engineering streams |
| HTTP               | `requests` (+ threaded prefetch)           | Simple; move fetch off the UI thread |
| Spreadsheet I/O    | `pandas` + `openpyxl` (xlsx), stdlib `csv` | Support both CSV and Excel exports |
| Packaging          | **PyInstaller** (one build per OS)         | Standard for Python desktop apps |
| Config/state       | JSON in a user config dir (`platformdirs`) | Remember last dir, window state |

**Media rendering = Hybrid:** photos render natively (96% of data, snappy,
offline-cacheable); the rare video uses an embedded browser player.

---

## 3. Media pipeline (verified against live assets)

For catalog number `{ML#}` (first column of each row):

- **Reference page** (what we replicate): `https://macaulaylibrary.org/asset/{ML#}`
- **Photo JPEG (direct):**
  `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/{ML#}/1200`
  (use `/2400` for zoom/high-res). No auth. ✅ verified.
- **Video:** the CDN paths return only a **poster JPEG**; the playable stream is
  behind `https://macaulaylibrary.org/asset/{ML#}/embed` (loads fine ✅). Show
  this page in the QtWebEngine view for `Format == "Video"` rows.
- **Prefetch:** background-fetch the next N photos while the user labels the
  current one, so swipes feel instant. Disk cache keyed by ML# under the app
  cache dir.

> Risk: CDN/embed URL patterns are undocumented and could change. Isolate them in
> a single `macaulay.py` module with a self-test so a break is one-line to fix.

---

## 4. Data model

### Input (verified from `ML__2026-08-07T18-46_rethaw.csv`)
- 46 columns, fixed header beginning:
  `ML Catalog Number, Format, Common Name, Scientific Name, Background Species,
  Caption, Recordist, Date, ... , Asset Tags, Original Image Height,
  Original Image Width`
- `Format` ∈ {Photo, Video, Audio}. `Asset Tags` contains `Nest`.

### Format validation on load
- Confirm required columns exist (at minimum: `ML Catalog Number`, `Format`,
  `Common Name`, `Scientific Name`, `Asset Tags`).
- Warn (don't hard-fail) on unexpected extra/missing columns so future Macaulay
  format tweaks degrade gracefully.
- Confirm first column is the catalog number.

### Output — columns appended to the original file
| Column              | Values            | Notes |
|---------------------|-------------------|-------|
| `nest_label`        | `yes` / `no` / "" | primary decision |
| `human_structure`   | `yes` / `no` / "" | from the toggle |
| `reviewed`          | `TRUE` / ""       | drives resume (skip reviewed rows) |
| `reviewed_at`       | ISO timestamp     | audit trail |
| `reviewer`          | string            | optional (from config) |

Idempotent: if these columns already exist, reuse them (enables resume). Existing
data columns are never modified.

---

## 5. UX & hotkeys (decided: "Arrows + toggle")

```
Up          toggle "human-made structure" flag for current item (visual indicator)
Right       YES nest   -> commit (nest=yes) + advance
Left        NO nest    -> commit (nest=no)  + advance
Space       skip (leave unlabeled) + advance
Backspace   undo / go to previous item
Esc / Q     quit (state already saved)
```

- On commit, `human_structure` is written from the current toggle state, then the
  toggle resets for the next item.
- Screen shows: media, `Common Name` / `Scientific Name`, `ML#` (clickable to open
  the real page), `Format`, `Caption`, `Behaviors`, `Date`, locality, progress
  `[i / N]`, current toggle state, and the last decision (for quick undo).
- Big, unmissable YES/NO/structure indicators so it stays "swipe-fast."

---

## 6. Save-as-you-go & resume

- After every commit/skip, write the full spreadsheet back to disk (cheap at
  these sizes; ~30 rows). Write to a temp file + atomic rename to avoid
  corruption if the app is killed mid-write.
- On open, rows with `reviewed == TRUE` are skipped; app resumes at the first
  unreviewed row. A "review all / re-review" toggle lets the user revisit.

---

## 7. Cross-platform packaging

- `pip install -e .` for dev; `requirements.txt` / `pyproject.toml`.
- PyInstaller spec producing a `.app` (macOS) and `.exe`/folder (Windows).
- Note: QtWebEngine noticeably increases bundle size — acceptable for the video
  requirement. Document build steps per OS in README.
- (Later) macOS code-signing/notarization and a Windows installer are stretch.

---

## 8. Module layout (proposed)

```
bird_swipe/
  __init__.py
  app.py            # entry point, arg parsing, launches Qt app
  ui/
    main_window.py  # layout, key handling, progress, indicators
    media_view.py   # photo widget + webview video swap
  core/
    catalog.py      # spreadsheet load/validate/save (csv + xlsx), resume logic
    macaulay.py     # URL builders, photo fetch, cache, embed URL  (self-testable)
    prefetch.py     # background fetch/caching of upcoming assets
    models.py       # Asset dataclass, label enums
  config.py         # user config/state via platformdirs
tests/
  test_catalog.py   # validation, save/resume round-trips
  test_macaulay.py  # URL building; live-endpoint smoke test (opt-in)
```

---

## 9. Milestones

- **M0 — Spike (½ day):** confirm photo fetch + embed-video playback inside a
  minimal PySide6 window. De-risks the two hardest pieces.
- **M1 — Core loop (MVP):** load CSV → validate → show photo + metadata →
  arrow-key label with structure toggle → save-as-you-go → resume. Photos only;
  video rows show poster + "open page."
- **M2 — Video + Excel:** embedded video playback; `.xlsx` read/write; prefetch
  cache for snappy swiping.
- **M3 — Polish & package:** progress/undo UX, config persistence, PyInstaller
  builds for Win + Mac, README with usage + build docs.

---

## 10. Stretch goals

- **In-app species search:** search Macaulay/eBird by species and pull nest-tagged
  assets directly, reducing the manual download step.
- **BirdNET-style I/O:** choose input & output directories; batch across many
  species spreadsheets.
- **Positive/negative split:** in addition to editing the original, emit
  `{species}_nest_positive.csv` and `{species}_nest_negative.csv`.
- Confidence/notes field per asset; keyboard-driven free-text notes.

---

## 11. Open questions

- Windows-specific QtWebEngine packaging quirks (verify during M3).
- Exact high-res/zoom endpoint behavior (`/2400` vs on-demand) — confirm in M1.
- Whether audio-format rows can appear in nest exports (handle gracefully if so).
- Video stream URL as a native fallback (avoid webview) — investigate only if the
  embed approach proves fragile.
