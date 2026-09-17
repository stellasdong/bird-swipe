# bird-swipe — what's next

The next round of labeling features, from Stella. Nothing here is built yet.
[PLAN.md](PLAN.md) is the original design; [README.md](README.md) describes what
the app does today. Each item says where it would land in the code, because
every one of them adds columns to a file researchers may already be half way
through labeling.

Numbering carries on from the milestones at the bottom of the README (M0–M11).

**Decided so far:** the new questions appear only on `nest = yes` rows, in a
details panel that marking yes opens — so a nest costs two presses and a
non-nest stays one; a question that doesn't apply is written `n/a`, never left
blank; bird present is a plain two-state toggle; natural vs man-made stays the
existing `human_structure` toggle and substrate is a separate axis; prey is
multi-select; height is out for now; nest IDs are parked.

---

## The flow — settled, build this first

The new questions only apply where there's a nest, so their controls live in a
**nest details panel** that is visible exactly when the current row is
`nest = yes`. Marking yes no longer advances on its own — **a nest costs two
presses, a non-nest stays one**, which is where the volume is.

| Key | On an undecided row | On a row already `nest = yes` |
|---|---|---|
| `→` | record yes, save, **stay**, open the details panel | save and advance |
| `←` | record no, save, advance | flip to no (details become `n/a`), save, advance |
| `↓` | record `skip`, advance | advance, decision untouched |
| `↑` | previous row | previous row |

- Stepping back onto a `nest = yes` row reopens the panel with its saved
  answers, the same way the existing toggles already show what's stored.
- The existing four toggles (structure, anthropogenic, eggs, chicks) **do not
  move**. They stay where they are, answerable before the decision, and keep
  writing the values they write today. Only the new questions live in the panel.

### What gets written when a question doesn't apply

`n/a`, explicitly. Every reviewed row then carries a real value in every
column, so blank keeps its one meaning — not answered — which is what makes a
partly-finished spreadsheet safe to read. It's the same reasoning that already
writes `0` rather than blank for "looked, saw none".

| Row | New columns hold |
|---|---|
| `nest_label=yes` | the answer, or the field's own "none" value |
| `nest_label=no` | `n/a` |
| `nest_label=skip`, or never reached | blank |

Anything reading these files handles three tokens: a value, `n/a`, and blank.
That is deliberate, and it is the decision hardest to reverse later — old files
would have to be rewritten.

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
- [ ] One list covering both kinds, **not** filtered by the toggle. Starting
      set, deliberately short — the point is that it grows from what people
      actually type:
      - natural — branch / twig, tree cavity, cliff or rock ledge, cactus,
        shrub, ground, snag
      - man-made — utility pole, building or ledge, tower, bridge,
        nest box or platform, sign
- [ ] **Other: type it in**, for anything the list doesn't cover.
- [ ] Column `substrate` — the term picked, or whatever was typed.
- [ ] A typed "other" is written to the CSV **verbatim**, and remembered in
      that browser so it appears in the list next time. The remembered list
      stays local to the computer: a genuinely shared list would have to live
      in the OneDrive folder, and two researchers writing it at once is a
      different job. Settled — build it this way.

**Open questions**

- Is the starting list right? It's a guess, and "twigs" was the one term Stella
  offered — read here as *branch / twig*, since twigs are what a nest is made
  of rather than what it sits on. If nest **material** is also wanted, that's a
  separate column, not this one.
- The toggle can still *order* the list — man-made entries first when
  `human_structure` is yes — as long as it never hides the other half. Only
  worth doing if the list gets long.

## M14 — Prey provisioning

- [ ] Mark whether parents are bringing food to the nest: `provisioning`,
      `yes` / `no`.
- [ ] If yes, a prey-type list: mammal, bird, reptile, amphibian, fish,
      invertebrate, unidentified.
- [ ] **Multi-select** — one image can show more than one prey item. Several
      values in one cell, separated by `;` so a comma never has to be escaped
      to stay readable.
- [ ] Columns `provisioning` and `prey_group`. Named *group* rather than
      *kingdom* because mammal/bird/reptile are classes within one kingdom;
      confirmed with Stella.

A conditional inside a conditional — the prey list only exists on a nest row
that's also marked provisioning. Worth building M13's dropdown first and reusing
it here rather than inventing two.

**Later, not now**

- Whether prey ever needs to be finer than the class — "rabbit", "snake".
  Deliberately deferred; the same "other, type it in" mechanism from M13 would
  cover it if the answer turns out to be yes.

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
- [ ] **Blank never means "none"**, and never means "not applicable" either —
      that's what `n/a` is for. See the flow section at the top; this is the
      decision most likely to be regretted later.
- [ ] **Keyboard first.** Two of these want a dropdown. The app's value is that
      it's faster than a spreadsheet — every new control needs a key that opens
      it and a way out that still saves and advances.
- [ ] **Tests.** `web/test.html` is 195 assertions and the only safety net;
      each new field needs its own — set, restored on resume, cleared on skip,
      round-tripped through the CSV, and `n/a` on a non-nest row.
- [ ] **The done screen and the nest split** read the label columns directly;
      check both still make sense once there are more of them.
