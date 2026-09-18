# bird-swipe — what's next

The next round of labeling features, from Stella. The flow, M12 and M13 are
built; everything below them is not. [PLAN.md](PLAN.md) is the original design; [README.md](README.md) describes what
the app does today. Each item says where it would land in the code, because
every one of them adds columns to a file researchers may already be half way
through labeling.

Numbering carries on from the milestones at the bottom of the README (M0–M11).

**Decided so far:** the new questions appear only on `nest = yes` rows, in a
details panel that marking yes opens — so a nest costs two presses and a
non-nest stays one; a question that doesn't apply is left **blank**, with
`nest_label` saying why; bird present is a plain two-state toggle; what the
nest is made of, what man-made material is in it and where it sits are **three
separate questions** (M17, superseding M13), with substrate multi-select and
`anthropogenic` derived from the material rather than asked; `human_structure`
stays for now; prey is multi-select; chick stage is asked only when chicks
were counted, with an unclear/unknown option; height is out for now; nest IDs
are parked.

---

## The flow — **built**

The new questions only apply where there's a nest, so their controls live in a
**nest details panel** that is visible exactly when the current row is
`nest = yes`. Marking yes no longer advances on its own — **a nest costs two
presses, a non-nest stays one**, which is where the volume is.

| Key | On an undecided row | On a row already `nest = yes` |
|---|---|---|
| `→` | record yes, save, **stay**, open the details panel | save and advance |
| `←` | record no, save, advance | flip to no (details blank out), save, advance |
| `↓` | record `skip`, advance | advance, decision untouched |
| `↑` | previous row | previous row |

- Stepping back onto a `nest = yes` row reopens the panel with its saved
  answers, the same way the existing toggles already show what's stored.
- The existing four toggles (structure, anthropogenic, eggs, chicks) **do not
  move**. They stay where they are, answerable before the decision, and keep
  writing the values they write today. Only the new questions live in the panel.

### What gets written when a question doesn't apply

**Blank.** An earlier version of this plan wrote `n/a` there, so that blank
could keep one meaning — not answered. Stella dropped it: `nest_label` already
distinguishes the cases, so the filler was restating what the row next to it
said.

| Row | New columns hold | Why it's blank |
|---|---|---|
| `nest_label=yes` | the answer, or the field's own "none" value | — |
| `nest_label=no` | blank | the question didn't apply |
| `nest_label=skip` | blank | nothing was answered |
| never reached | blank | not looked at |

Anything reading these files handles two tokens: a value, or blank — and reads
`nest_label` in the same row to learn which kind of blank it is. The one thing
this costs is reading a column *in isolation*: `substrate` on its own can no
longer tell you whether the nest had no substrate recorded or there was no nest.
Pair it with `nest_label` and nothing is lost.

Note this does **not** change the counts: `egg_count` and `chick_count` still
write `0` rather than blank on a reviewed row, because "looked, saw none" is a
real observation there and `0` is its value, not a filler.

**Files already labeled with `n/a` still load.** `catalog.js` reads the old
token as blank (`LEGACY_NOT_APPLICABLE`) and never writes it again, so an old
spreadsheet opens correctly without being rewritten. Rows re-labeled in the app
are saved blank; rows left untouched keep whatever they already held, so a file
part-labeled under the old scheme ends up mixed. Sweeping those on load is a
one-line change if a mixed file turns out to be a nuisance — it was left out
because it silently rewrites data the researcher didn't touch.

## M12 — Bird present / not present — **built**

- [x] A new per-nest-row observation: is a bird visible in this image?
- [x] **Two states**, `yes` / `no`, like the existing toggles: on a reviewed
      row, unanswered means `no`.
- [x] Column `bird_present`, the first entry in `NEST_ONLY_COLUMNS`.
- [x] A toggle in the nest-details panel, bound to `A` / `5` — a new action, so
      nobody's custom bindings are reset.

It is the panel's first occupant, which is why the flow and this landed
together: a panel with nothing in it can't be tested, and the off-a-nest rule
needs a column to be written into.

## M13 — Substrate — **built, superseded by M17**

Built and working, but to a definition Stella has since replaced: this asked
one question ("what is under the nest") where there are really three. **M17 is
the live design** — read it instead. This section stays as the record of what
shipped and why it changed.

Nothing was lost: no spreadsheet has been labeled with a `substrate` value yet,
so the column can be redefined outright rather than migrated. The picker, the
type-it-in-for-other behaviour and the remembered-terms storage all survive —
M17 reuses them three times over.

Hotkey `S` / `6`. The nest-details keys run A, S, D in the order they are added.

**Two independent questions, not one.** Natural vs man-made is already asked —
it's the existing `human_structure` toggle, and it stays exactly as it is. What
the nest is *built on* is a separate axis that can cross it: natural substrate
on a man-made structure is a real combination (vegetation on a bridge, a mud
ledge on a building), and so is the reverse.

- [x] Keep `human_structure` as the natural/man-made answer. No
      `substrate_kind` column — one question, one column, no way for the two to
      disagree.
- [x] One list covering both kinds, **not** filtered by the toggle. Starting
      set, deliberately short — the point is that it grows from what people
      actually type:
      - natural — branch / twig, tree cavity, cliff or rock ledge, cactus,
        shrub, snag
      - man-made — utility pole, building or ledge, tower, bridge,
        nest box or platform, sign
      - material — plastic, metal
      - **none / bare ground** — eggs laid straight on the ground, no
        substrate under them at all
- [x] **Other: type it in**, for anything the list doesn't cover — no separate
      control: a filter that matches nothing *is* the other box.
- [x] Column `substrate` — the term picked, or whatever was typed.
- [x] A typed "other" is written to the CSV **verbatim**, and remembered in
      that browser so it appears in the list next time.
- [x] Keyboard-first picker: `S` opens it, typing narrows it, `Enter` takes the
      top match, `1`–`9` pick off the unfiltered list. **Nothing is recorded
      until it's confirmed** — `Esc` or any arrow closes it and leaves the
      substrate alone, so a half-typed filter can't become an answer. The cost
      is that arrows don't shortcut out of it the way they do a count box.

`substrate` means **the surface immediately under the nest or the eggs**, which
is why materials (plastic, metal) sit in the same list as branches and ledges,
and why "none" is a real answer rather than a blank. Stella's examples are what
fixed this definition; it needs to reach whoever analyses the column, because
"substrate" could otherwise be read as the structure the nest is attached to.

**Still open**

- Is the starting list right? It's a guess. Everything typed into "other" is
  cleanup for whoever analyses the column, so it's worth a look once a few
  spreadsheets have been through the app — what people actually type is the
  best evidence for what the list should hold.
- If nest **material** is wanted as well as substrate, that's a separate
  column, not this one.
- The toggle could *order* the list — man-made entries first when
  `human_structure` is yes — as long as it never hides the other half. Only
  worth doing if the list gets long.
- The remembered list is per-browser, so two researchers see different
  suggestions. The file is unaffected (it records the text, never a reference
  into a list), but a shared list would need a file in the OneDrive folder.

## M14 — Prey provisioning — **next**

Hotkey when built: `G` / `9` — M17 took `D` and `F`. The multi-select picker
M17 built for substrate is the thing to reuse: same open/filter/confirm
behaviour, same `; `-joined cell, already written and tested.

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
that's also marked provisioning. The dropdown it needs now exists: M17's
substrate picker is multi-select and joins with `; `, which is exactly what
`prey_group` wants.

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


## M16 — Chick stage — **next**

Hotkey when built: `H` / `0` — M17 took `D` and `F`. **Three states**, so a key that cycles
early → late → unclear → off rather than a two-way toggle; still one control,
still one keypress per press, no picker needed.

- [ ] When chicks are present, record how far along they are:
      - **early** — downy
      - **late** — feathered
      - **unclear / unknown** — can't tell from this image
- [ ] Column `chick_stage`, holding `early`, `late`, `unclear`, or blank.
- [ ] **The definitions go on the screen**, next to the control — "early =
      downy, late = feathered", not just in this file. Two reviewers drawing
      the line differently is the way this column goes wrong, and the labels
      are short enough to sit in the panel.
- [ ] **Conditional on the chick count, not on the nest.** The existing chick
      counter already answers "are there chicks" — `chick_count > 0`. The stage
      control appears in the nest-details panel only when that count is above
      zero, and disappears if the count is cleared back to zero.
- [ ] Editing the chick count back to `0` must also blank `chick_stage`, the
      same way flipping a nest to `no` does. A stale `late` under a zero count
      is the failure mode to test for.

`unclear` is a **recorded answer, not a blank** — it says a reviewer looked and
couldn't call it, which is different from nobody having looked. That difference
is exactly what blank is for now that `n/a` is gone, so the two must not be
collapsed: a blank `chick_stage` on a row with chicks means the question went
unanswered.

It also settles the mid-moult case without a rule: a chick that is downy *and*
feathered is the reviewer's call, and `unclear` is there when they'd rather not
guess. Per Stella, the tiebreak is deliberately left to whoever is labeling
(Mei) rather than written into the app — the definitions on screen are guidance,
not a decision procedure.

**Still open**

- Whether `unclear` and a mixed-age brood want separating later. They're folded
  together for now; if the column comes back full of `unclear`, that's the
  evidence for splitting it.
- Nestling age is sometimes recorded in days rather than stages. That would be
  a different column, not this one.


## M17 — Substrate, anthropogenic material, location — **built, supersedes M13**

M13 asked one question — "what is the nest on?" — and its option list gave the
game away: it mixed branches, bridges, plastic and bare ground in one column.
Those are **three** questions, and Stella has separated them:

| Column | The question | Example answers |
|---|---|---|
| `substrate` | what the nest is **made of**, natural material only | twig, dried grass, mud / clay / feces |
| `anthropogenic_material` | what **man-made** material is in it | plastic, metal, other |
| `nest_location` | where the nest physically **is** | cactus, tree, telephone pole, ground |

The old M13 list splits across all three almost perfectly — branch/twig, cactus,
bridge, utility pole and the rest are *location*; plastic and metal are
*anthropogenic material*; "none / bare ground" was two answers wearing one coat
("ground" is a location, "none" is a material). That clean split is the
evidence the original column was conflating things.

**Substrate now means material, not surface.** This is the opposite of what M13
wrote and what `catalog.js` still documents. Both need correcting, or the column
means one thing in the file and another in the comments.

### The three controls

- [x] `substrate` — **natural material the nest is built from**: twig, dried
      grass, mud / clay / feces, leaves, soft / plushy plant material, animal
      fur, **none**. Hotkey `S` / `6`, keeping the key it already had.
- [x] **Multi-select**, confirmed with Stella: a nest is often twigs *and* mud
      *and* a fur lining. Picking toggles a term and leaves the list open for
      the next; several answers ride in one cell joined with `; `, the
      separator M14 will reuse for prey. Single answers still look like plain
      values, so nothing has to be re-read if one turns out to be enough.
- [x] `anthropogenic_material` — **plastic, metal, other**. Hotkey `D` / `7`.
      Single-select.
- [x] `nest_location` — **where the nest sits**: tree, cactus, shrub, snag,
      tree cavity, ground, cliff or rock ledge, telephone pole, building or
      ledge, tower, bridge, nest box or platform, sign, other. Hotkey `F` / `8`.
      Single-select; a nest is in one place.
- [x] All three use **M13's picker unchanged** — opens on a key, typing
      narrows, `Enter` takes the top match, `1`–`9` pick off the list, nothing
      recorded until confirmed. "Other" needs no special control: a filter that
      matches nothing already *is* the other box, and what's typed is kept
      verbatim and remembered for next time.
- [x] Remembered terms are now kept **per field**, so a place someone typed
      can't turn up in the list of what a nest is built from — the same mixing
      M13 got wrong. Terms remembered under the old single list move to
      `nest_location`, which is what they were answering.

### What this cost

- [x] **Two more panel keys**, `D` / `7` and `F` / `8` — the run is now
      A S D F. M14 and M16 move down to `G` / `9` and `H` / `0` when they are
      built. Five controls is a full panel; worth looking at the layout before
      adding a sixth.
- [x] **`anthropogenic` is no longer asked.** It was a top-level toggle
      (`w` / `2`) written `yes`/`no` on *every* reviewed row. The material list
      replaced it, and the column is now **derived** from it — exactly the
      arrangement `eggs` already has with `egg_count`, so the yes/no and the
      detail cannot disagree, and the three spreadsheets that already hold the
      column keep their meaning. Naming a material answers it; there is no
      second press.
- [x] **Two behaviour changes worth knowing**, both consequences of it moving
      into the panel: `anthropogenic` is now **blank off a nest** where it used
      to say `no`, and **`w` / `2` is unbound** — deliberately left empty
      rather than shifting every key below it up one, which would have cost
      muscle memory for the sake of tidiness. This is the first key this
      project has taken away rather than added.
- [x] **It breaks "the existing four toggles do not move"**, stated in the flow
      section. That rule was about not disturbing what already works; this is a
      deliberate exception, not an oversight.
- [x] `catalog.js`'s `NEST_ONLY_COLUMNS`, `LABEL_COLUMNS`, the skip-clearing
      list and the done-screen stats carry the new columns, and the substrate
      comment block is rewritten to the new definition. README updated too —
      its key table, column reference and the substrate section were all
      describing the old single question.
- [x] 30 new assertions in `web/test.html` (261 total, all passing): the three
      lists don't overlap, multi-select cells join and split and round-trip
      through the CSV, `anthropogenic` follows its material, and every new
      column is blank off a nest and cleared by a skip.

**Still open**

- **Feathers are missing from the material list**, and they are a common
  lining — a reviewer has to type them today. Likewise "soft / plushy plant
  material" is Stella's phrasing and clear in conversation, but it wants a
  settled term before it reaches whoever analyses the column ("plant down"?).
  Both are one-word list edits now and spreadsheet cleanup later.
- **Is `anthropogenic_material` single-select the right call?** Plastic twine
  and wire in the same nest is plausible. Left single because only substrate
  was confirmed multi; the machinery is now there either way, so it is a
  one-line change.
- **`human_structure` is now largely redundant.** Natural vs man-made is
  derivable from `nest_location` for every listed answer: tree and cactus are
  natural, telephone pole and bridge are not. It only earns its place for typed
  "other" values, where nothing can infer it. Kept for now — it has real data
  behind it and costs one press — but it is the next thing to question, and
  `q` / `1` sits next to the `w` / `2` this milestone just emptied.
- Whether `nest_location` wants the same natural/man-made grouping M13's list
  had, as *ordering* within one list rather than two lists.

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
- [ ] **Blank never means "none".** "None" is a real answer with its own value
      — `0` for a count, `none / bare ground` for a substrate. Blank means the
      question wasn't answered or didn't apply, and `nest_label` says which.
      See the flow section at the top.
- [ ] **Keyboard first.** Two of these want a dropdown. The app's value is that
      it's faster than a spreadsheet — every new control needs a key that opens
      it and a way out that still saves and advances.
- [ ] **Tests.** `web/test.html` is 195 assertions and the only safety net;
      each new field needs its own — set, restored on resume, cleared on skip,
      round-tripped through the CSV, and blank on a non-nest row.
- [ ] **The done screen and the nest split** read the label columns directly;
      check both still make sense once there are more of them.
