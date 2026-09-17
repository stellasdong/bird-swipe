# bird-swipe — what's next

The next round of labeling features, from Stella. Nothing here is built yet.
[PLAN.md](PLAN.md) is the original design; [README.md](README.md) describes what
the app does today. Each item says where it would land in the code, because
every one of them adds columns to a file researchers may already be half way
through labeling.

Numbering carries on from the milestones at the bottom of the README (M0–M11).

**Decided so far:** the new questions appear only on `nest = yes` rows; bird
present is a plain two-state toggle; natural vs man-made stays the existing
`human_structure` toggle and substrate is a separate axis; height is out for
now; nest IDs are parked.

---

## The one thing that affects all of it: nest-only questions

The new questions only apply where there's a nest, so the controls stay hidden
until `nest = yes`. That is a change to the swipe itself, and it needs settling
before any of M12–M14 is built:

- Today `→` *is* the answer — it records nest = yes, saves, and advances. If the
  extra questions only exist on a yes, then `→` can't both open them and move
  past them. The likely shape: **`→` marks yes and reveals the extra controls;
  a second `→` saves and advances.** Non-nest images stay a single keypress,
  which is where the volume is.
- That makes `←` (no) and `↓` (skip) unchanged — one key, straight on.
- **Blank gets a third meaning.** Today blank only ever means "not reviewed".
  On a `nest = no` row these new columns will be blank because they don't
  apply. Either that's written down as a rule (blank + `nest_label=no` =
  not applicable), or non-applicable is written explicitly as `n/a`. The second
  is uglier to read and safer to analyse. Pick one before the first column
  ships — it's not changeable later without rewriting old files.

## M12 — Bird present / not present

- [ ] A new per-nest-row observation: is a bird visible in this image?
- [ ] **Two states**, `yes` / `no`, like the existing toggles: on a reviewed
      row, unanswered means `no`.
- [ ] Column `bird_present`, alongside `human_structure` and `anthropogenic`
      in `LABEL_COLUMNS`.
- [ ] A toggle button in the row above the photo, and a hotkey pair (letter +
      number-pad mirror).

**Note.** Free keys are scarce — `Q W E R Z G` are taken and `1`–`4` are the
number-pad mirrors. Adding this as a *new* action is fine; `getKeys()` merges
new actions over saved bindings. Reusing an existing key would force a
`KEYS_VERSION` bump, which resets everyone's custom bindings.

## M13 — Substrate

**Two independent questions, not one.** Natural vs man-made is already asked —
it's the existing `human_structure` toggle, and it stays exactly as it is. What
the nest is *built on* is a separate axis that can cross it: natural substrate
on a man-made structure is a real combination (vegetation on a bridge, a mud
ledge on a building), and so is the reverse.

- [ ] Keep `human_structure` as the natural/man-made answer. No
      `substrate_kind` column — one question, one column, no way for the two to
      disagree.
- [ ] Add a substrate list covering both kinds in one list, **not** filtered by
      the toggle:
      - natural — tree, cliff, cactus, ground, snag, shrub, …
      - man-made — utility/telephone pole, building/ledge, tower, bridge,
        nest box, sign, …
- [ ] **Other: type it in**, for anything the list doesn't cover.
- [ ] Column `substrate` — the term picked, or whatever was typed.

**Open questions**

- **Does a typed "other" join the dropdown?** Stella asked for this. Suggested
  split: the typed text is written to the CSV verbatim, *and* remembered in that
  browser so it appears in the list next time — but the list stays local to the
  computer. Otherwise two researchers end up with different dropdowns and the
  column quietly stops being categorical. If the list is meant to be shared,
  it has to live in a file in the OneDrive folder, which is a bigger job.
- What goes in the starting list? The terms above are a guess. Worth fixing the
  first version with whoever is doing the analysis, because everything typed
  into "other" is cleanup for them later.
- The toggle can still *order* the list — man-made entries first when
  `human_structure` is yes — as long as it never hides the other half. Only
  worth doing if the list gets long.

## M14 — Prey provisioning

- [ ] Mark whether parents are bringing food to the nest: `provisioning`,
      `yes` / `no`.
- [ ] If yes, a prey-type list: mammal, bird, reptile, amphibian, fish,
      invertebrate, unidentified.
- [ ] Columns `provisioning` and `prey_group`.

A conditional inside a conditional — the prey list only exists on a nest row
that's also marked provisioning. Worth building M13's dropdown first and reusing
it here rather than inventing two.

**Open questions**

- Stella called this "by kingdom", but mammal/bird/reptile are classes, all in
  one kingdom. `prey_group` keeps the column name accurate without claiming a
  rank it doesn't have — confirm that's fine, since the column name is what an
  analyst sees.
- Can one image show more than one prey item? If so this is a multi-select or a
  second free-text column, not one value.
- Does prey ever need to be finer than the class — "rabbit", "snake"? Same
  "other, type it in" question as M13.

## M15 — Repeat nests — **parked**

The feature is wanted; the decision that unblocks it isn't made yet.

- [ ] A nest ID shared by every asset of the same nest — `AAAA`, `BBBB`, … in a
      `nest_id` column.
- [ ] Show enough metadata on the label screen to recognise a nest you've seen
      already: recordist (the eBirder) and date, both already in the Macaulay
      export, plus location if it's there.
- [ ] A way to assign an ID without retyping — pick from IDs already used, or
      type a new one.

**Blocked on:** how far an ID reaches. Unique within one spreadsheet is
buildable now and can't collide between researchers; project-wide is more useful
for analysis but needs a shared registry in the OneDrive folder that two people
can write at once. Deferred deliberately — revisit before starting.

Separate question for later: should the app *suggest* repeats from matching
recordist/date/locality, or is spotting them entirely the reviewer's job?
Suggesting is a much larger piece of work.

---

## Parked — not now

**Height.** Dropped for this round. If it comes back: a photo rarely supports a
real estimate, so bands (`<2 m`, `2–5 m`, `5–10 m`, `>10 m`, unknown) beat a
free number, and height is a property of the nest site rather than the
photograph — which makes it part of the M15 nest record, not a per-row column.

**GBIF and iNaturalist.** Not Stella's problem — it arrives as a spreadsheet.
One line of warning for whoever picks it up: the loader hard-requires Macaulay's
header (`CATALOG_KEY = 'ML Catalog Number'`, `REQUIRED_COLUMNS` in
`catalog.js`), and `macaulay.js` builds every photo and video URL from that
catalog number. A non-Macaulay source needs its own media-URL column and a way
to say so.

---

## Cross-cutting — applies to every item above

- [ ] **Old files must still open.** `catalog.js` already unions columns and
      appends new ones at the end, and there are tests for it. Each new column
      goes in `LABEL_COLUMNS`, and a file labeled under the old scheme has to
      round-trip cleanly.
- [ ] **Skip clears observations.** `skip` blanks every observation on the row
      so a skipped row never looks answered. Every new field needs adding to
      that list, or it will carry a stale value onto a skipped row.
- [ ] **Blank never means "none"** — and now also has to mean "not applicable"
      on non-nest rows. See the section at the top; this is the decision most
      likely to be regretted later.
- [ ] **Keyboard first.** Two of these want a dropdown. The app's value is that
      it's faster than a spreadsheet — every new control needs a key that opens
      it and a way out that still saves and advances.
- [ ] **Tests.** `web/test.html` is 195 assertions and the only safety net;
      each new field needs its own — set, restored on resume, cleared on skip,
      round-tripped through the CSV, and absent on a non-nest row.
- [ ] **The done screen and the nest split** read the label columns directly;
      check both still make sense once there are more of them.
