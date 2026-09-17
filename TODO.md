# bird-swipe — what's next

The next round of labeling features, from Stella. Nothing here is built yet.
[PLAN.md](PLAN.md) is the original design; [README.md](README.md) describes what
the app does today. Each item says where it would land in the code, because
every one of them adds columns to a file researchers may already be half way
through labeling.

Numbering carries on from the milestones at the bottom of the README (M0–M11).

---

## M12 — Bird present / not present

- [ ] A new per-asset observation: is a bird visible in this image?
- [ ] Column `bird_present` — `yes` / `no`, alongside `human_structure` and
      `anthropogenic` in `LABEL_COLUMNS`.
- [ ] A toggle button in the row above the photo, and a hotkey pair (letter +
      number-pad mirror), like the existing toggles.

**Open questions**

- Does "no bird" need to be distinct from "not answered"? Every other toggle
  treats a reviewed row's blank as a real `no`. If an empty nest is a finding
  worth counting, `bird_present` needs three states, and that's a different
  control from the existing toggles.
- Free letter keys are getting scarce: `Q W E R Z G` are taken, and `1`–`4` are
  the number-pad mirrors. Adding `bird_present` as a *new* action is fine —
  `getKeys()` merges new actions over saved bindings — but reusing an existing
  key would force a `KEYS_VERSION` bump, which resets everyone's custom
  bindings.

## M13 — Categorical location and substrate

- [ ] First choice: **natural** or **man-made**.
- [ ] Then a specific substrate from a list that depends on that choice:
      - natural — tree, cliff, cactus, ground, snag, …
      - man-made — utility/telephone pole, building, tower, bridge, nest box, …
- [ ] **Other: type it in** on both lists, for anything not covered.
- [ ] Columns `substrate_kind` (`natural` / `manmade`) and `substrate` (the
      term, or whatever was typed).

**Open questions**

- **Does a typed "other" join the dropdown?** Stella asked for this. Suggested
  split: the typed text is written to the CSV verbatim, *and* remembered in that
  browser so it appears in the list next time — but the list stays local to the
  computer. Otherwise two researchers end up with different dropdowns and the
  column quietly stops being categorical. If the list is meant to be shared,
  it has to live in a file in the OneDrive folder, which is a bigger job.
- **`substrate_kind` and `human_structure` are the same question.** The app
  already asks "human-made structure, yes/no" as a toggle. Two controls that
  can disagree is the worst outcome — so either `human_structure` is derived
  from `substrate_kind` (the way `eggs` is derived from `egg_count`), or the
  toggle retires and old files keep the column for continuity. Pick one before
  building.
- **Keyboard path.** A dropdown is a mouse control, and the whole point of this
  app is that a spreadsheet can be labeled without leaving the arrow keys. It
  needs the same treatment the egg count got: a key opens the list, a number or
  first letter picks an entry, and `→` still saves and advances from inside it.

## M14 — Height

- [ ] Record how high the nest is.

**This one is a question, not a task yet.** Three things to settle:

- **Can it be answered from the image at all?** A photo taken from a distance
  rarely supports a height estimate. If most rows would be blank or guessed,
  the column costs more than it's worth.
- **Bands or a number?** A dropdown of ranges (`<2 m`, `2–5 m`, `5–10 m`,
  `>10 m`, `unknown`) is fast and honest about the precision; a free number
  invites false confidence but is easier to analyse.
- **Per image, or per nest?** Height belongs to the nest site, not to the
  photograph — which makes it a property of the repeat-nest record in M16
  rather than of the row. If M16 lands first, this is nearly free.

## M15 — Prey provisioning

- [ ] Mark whether parents are bringing food to the nest: `provisioning`,
      `yes` / `no`.
- [ ] If yes, a prey-type list: mammal, bird, reptile, amphibian, fish,
      invertebrate, unidentified.
- [ ] The prey list only appears once provisioning is `yes` — the first
      conditional control in the label screen.
- [ ] Columns `provisioning` and `prey_group`.

**Open questions**

- Stella called this "by kingdom", but mammal/bird/reptile are classes, all in
  one kingdom. Naming the column `prey_group` keeps it accurate without
  pretending to a rank it doesn't have — worth confirming that's fine, since
  the column name is what an analyst sees.
- Can a single image show more than one prey item? If so this is a multi-select
  or a second free-text column, not one value.
- Does prey ever need to be more specific than the class — "rabbit", "snake"?
  If so, the same "other, type it in" question as M13 applies.

## M16 — Repeat nests

- [ ] A nest ID shared by every asset of the same nest — `AAAA`, `BBBB`, …
- [ ] Column `nest_id`.
- [ ] Show enough metadata on the label screen to recognise a nest you've
      already seen: who recorded it (the eBirder) and the date, both already
      present in the Macaulay export, plus the location if it's there.
- [ ] A way to assign an ID without typing it every time — pick from the IDs
      already used in this spreadsheet, or type a new one.

**Open questions**

- Are IDs unique within one spreadsheet, or across the whole project? Within a
  spreadsheet is far simpler and can be done now; project-wide means a shared
  registry in the OneDrive folder and two researchers able to collide.
- Should the app *suggest* repeats — same recordist, same date, same locality —
  or is spotting them entirely the reviewer's job? Suggesting is a much bigger
  piece of work and can come later.

## M17 — GBIF and iNaturalist

Not Stella's problem — it arrives as a spreadsheet. One line of warning for
whoever does pick it up: the loader currently hard-requires Macaulay's header
(`CATALOG_KEY = 'ML Catalog Number'`, `REQUIRED_COLUMNS` in `catalog.js`), and
`macaulay.js` builds every photo and video URL from that catalog number. A
non-Macaulay source needs its own media-URL column and a way to say so.

---

## Cross-cutting — applies to every item above

- [ ] **Old files must still open.** `catalog.js` already unions columns and
      appends new ones at the end, and there are tests for it. Each new column
      goes in `LABEL_COLUMNS`, and a file labeled under the old scheme has to
      round-trip cleanly.
- [ ] **Skip clears observations.** `skip` blanks every observation on the row
      so a skipped row never looks answered. Every new field needs adding to
      that list, or it will carry a stale value onto a skipped row.
- [ ] **Blank never means "none".** On a reviewed row, an unanswered count is
      `0` and an unanswered toggle is `no`; blank only ever means not reviewed.
      New fields follow the same rule, or a partly-finished spreadsheet stops
      being safe to analyse.
- [ ] **Keyboard first.** Three of these five items want a dropdown. The app's
      value is that it's faster than a spreadsheet — every new control needs a
      key that opens it and a way out that still saves and advances.
- [ ] **Tests.** `web/test.html` is 195 assertions and the only safety net;
      each new field needs its own — set, restored on resume, cleared on skip,
      round-tripped through the CSV.
- [ ] **The done screen and the nest split** read the label columns directly;
      check both still make sense once there are twice as many.
- [ ] **How much is too much?** Five new questions per image on top of the six
      that exist. At some point the swipe stops being a swipe — worth deciding
      whether these all apply to every asset, or only to `nest = yes` rows.
