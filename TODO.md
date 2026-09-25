# bird-swipe — what's next

The next round of labeling features, from Stella. The flow and M12, M13, M16,
M14 and M17 through M24 are built; **M25 (duplicate images) is the high
priority**, M15 is parked, M26–M27 are low priority, and M28–M29 are small.
[PLAN.md](PLAN.md) is the original design; [README.md](README.md) describes
what the app does today. Each item says where it would land in the code,
because every one of them adds columns to a file researchers may already be
half way through labeling.

Numbering carries on from the milestones at the bottom of the README (M0–M11).
Unbuilt items carry a priority: **high priority** first, then whatever is
marked **next**, then **low priority**, then **parked** (which means blocked on
a decision rather than unimportant).

**Decided so far:** marking a nest opens the required questions in a run that
carries itself (M22); **every observation is nest-only** — the panel that
marking yes opens holds all of them, so a nest costs two presses and a
non-nest costs one and records only the decision; **location and substrate are
required** and each list carries `unclear` so requiring them stays honest
(M19), while everything else is genuinely optional; a question that didn't
apply is left **blank**, with `nest_label` saying why; what the nest is made
of, what man-made material is in it and where it sits are **three separate
questions** (M17) that each say what they mean in their own popup (M20);
`human_structure` chooses which location list is offered (M18) and is answered
from inside that list with `←`/`→` (M22); chick stage is early/late/unclear
and only asked where chicks were counted (M16); every reviewer of a row is
kept, not just the last (M21); prey is multi-select; height is out for now;
nest IDs are parked.

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
- ~~The existing four toggles (structure, anthropogenic, eggs, chicks) **do not
  move**.~~ All four ended up moving, one at a time and each for its own
  reason: anthropogenic in M17 when a material list replaced it, and structure,
  eggs and chicks in M18 once it was clear that *every* question this app asks
  is a nest question. The rule was about not disturbing what works; it went
  when the panel turned out to be the right home for all of it. The chip row
  now holds the decision and nothing else.

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

The counts follow the same rule, with one wrinkle. On a **nest**, an
unanswered `egg_count` is `0`, not blank: someone looked and saw none, and `0`
is that observation's value rather than a filler. Off a nest it is blank like
everything else — M18 made the counts nest-only, so `0` now appears only where
somebody actually counted.

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

## M14 — Prey provisioning — **built**

**Two questions, in Stella's words: are the parent birds actively feeding, and
if the food is visible, what kind?**

Hotkey when built: `H` / `9` — `F` / `8` went to chick stage, and `G` is jump.
The multi-select picker M17 built for substrate is the thing to reuse: same
open/filter/confirm behaviour, same `; `-joined cell, already written and
tested.

- [x] **Is a parent actively feeding?** `provisioning`, `yes` / `no`. A toggle,
      answerable from the photograph without judging what the food is.
- [x] **If the food is visible, what kind?** A prey-type list: mammal, bird,
      reptile, amphibian, fish, invertebrate, **unidentified**.
- [x] `unidentified` is the "if visible" half doing its work — a feeding parent
      whose bill you can't see into is `provisioning = yes` with
      `prey_group = unidentified`, which is a different fact from a blank. Same
      reasoning as `unclear` in the substrate and location lists (M19).
- [x] **Multi-select** — one image can show more than one prey item. Several
      values in one cell, separated by `; ` so a comma never has to be escaped
      to stay readable.
- [x] Columns `provisioning` and `prey_group`. Named *group* rather than
      *kingdom* because mammal/bird/reptile are classes within one kingdom;
      confirmed with Stella.

A conditional inside a conditional — the prey list only exists on a nest row
that's also marked provisioning. The dropdown it needs now exists: M17's
substrate picker is multi-select and joins with `; `, which is exactly what
`prey_group` wants.

**Settled: it records active feeding, and the column is still called
`provisioning`.** Stella's call. Those are not the same thing — a parent
perched at the nest with a fish in its bill is provisioning in the usual sense
but is not feeding — so the definition has to travel with the name, and it
does: the toggle on screen reads **"provisioning — actively feeding"**, and
`catalog.js`, the README's column table and this note all say which is meant.
The alternative was renaming the column to `feeding`, which is clearer cold but
loses the name Stella had already confirmed.

**Keys and placement.** Toggle `H` / `9`, prey list `J` / `0` — skipping `G`,
which is jump. Both sit at the end of the panel rather than beside the bird
toggle they relate to, because the alternative was moving keys a fourth time.
The prey list is `hidden` until provisioning is yes, so it stays out of the Tab
order and its key does nothing until then, the same arrangement chick stage
has with the chick count.

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


## M16 — Chick stage — **built**

Hotkey `F` / `8`, next to the chick count it depends on — which completes the
`Q W E R` / `A S D F` block. **Three states**, so the key cycles
blank → early → late → unclear → blank rather than toggling; still one control,
still one keypress, no picker needed.

- [x] When chicks are present, record how far along they are:
      - **early** — downy
      - **late** — feathered
      - **unclear / unknown** — can't tell from this image
- [x] Column `chick_stage`, holding `early`, `late`, `unclear`, or blank.
- [x] **The definitions go on the screen**, next to the control — "early =
      downy, late = feathered", not just in this file. Two reviewers drawing
      the line differently is the way this column goes wrong, and the labels
      are short enough to sit in the panel — the button itself reads
      "chick stage: early (downy)".
- [x] **Conditional on the chick count, not on the nest.** The existing chick
      counter already answers "are there chicks" — `chick_count > 0`. The stage
      control appears in the nest-details panel only when that count is above
      zero, and disappears if the count is cleared back to zero.
- [x] Editing the chick count back to `0` also blanks `chick_stage`, the
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

- It is **not required**, unlike location and substrate (M19). A nest with
  chicks counted and no stage picked writes blank, which reads as "nobody
  answered". Requiring it would be consistent; it was left out because Stella
  asked for the two, and because the stage is a harder call than the other two
  from a photograph.
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
      grass, mud / clay / feces, leaves, plant down, animal fur, feathers,
      **none**. Hotkey `S` / `6`, keeping the key it already had.
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
      A S D F. Five controls is a full panel; worth looking at the layout
      before adding a sixth. *(Superseded by M18, which laid all seven out in
      screen order as `Q`–`U` / `1`–`7`. The keys named in this section and in
      M12 and M13 are what they were at the time, not what they are now — see
      M18 for the current ones.)*
- [x] **`anthropogenic` is no longer asked.** It was a top-level toggle
      (`w` / `2`) written `yes`/`no` on *every* reviewed row. The material list
      replaced it, and the column is now **derived** from it — exactly the
      arrangement `eggs` already has with `egg_count`, so the yes/no and the
      detail cannot disagree, and the three spreadsheets that already hold the
      column keep their meaning. Naming a material answers it; there is no
      second press.
- [x] **Two behaviour changes worth knowing**, both consequences of it moving
      into the panel: `anthropogenic` is now **blank off a nest** where it used
      to say `no`, and the toggle's old `w` / `2` was left empty rather than
      shifting every key below it up one. **Stella has since moved the chick
      count into that slot** — so the top row is `Q` structure, `W` chicks,
      `E` eggs, and `r` / `4` is the gap instead. This is the first key this
      project has taken away rather than added.
- [x] **It breaks "the existing four toggles do not move"**, stated in the flow
      section. That rule was about not disturbing what already works; this was
      a deliberate exception, and M18 went on to move the other three.
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

- **Is `anthropogenic_material` single-select the right call?** Plastic twine
  and wire in the same nest is plausible. Left single because only substrate
  was confirmed multi; the machinery is now there either way, so it is a
  one-line change.
- ~~**`human_structure` is now largely redundant**, since natural vs man-made
  is derivable from `nest_location`.~~ Settled by M18, and the other way up:
  it is now the question that *chooses* the location list, so it earns its
  place as an input rather than a fact recoverable from the output.
- ~~Whether `nest_location` wants the natural/man-made grouping as *ordering*
  within one list rather than two lists.~~ Two lists, per M18 — and the
  worry that went with it (never hide half the list) is answered by the
  structure toggle being asked first, so nothing is hidden that the reviewer
  hasn't already ruled out.


## M18 — Everything is a nest question — **built**

The panel started as the place for questions that only made sense on a nest.
It turns out that is *all* of them: there is no structure to judge, nothing to
count and nowhere for a nest to sit on an image that hasn't got one. So the top
row now holds the decision and nothing else.

- [x] **`human_structure`, the egg count and the chick count move into the
      panel**, joining bird present and the three lists. The chip row above the
      image is now nest YES / nest NO / the skipped pill.
- [x] ~~**Nothing moved keys.**~~ Everything moved keys, immediately
      afterwards: with all seven questions in one row it was worth laying them
      out properly rather than preserving two historical runs. See below.
- [x] Every one of those keys now **does nothing while the panel is closed**,
      the rule the panel's own keys already followed — there is no way to set
      an answer nobody can see.
- [x] `NEST_ONLY_COLUMNS` grows to ten; `nest_label` is the only label column
      left outside it. `setSkip` is one loop again, because the list it had to
      clear by hand *is* that set now.

### `human_structure` chooses the location list

- [x] **No** offers the natural places — tree, tree cavity, cactus, shrub,
      snag, ground, cliff or rock ledge. **Yes** offers the man-made ones —
      telephone pole, building or ledge, tower, bridge, nest box or platform,
      sign. Seven terms instead of fourteen, and a tree is never offered as a
      man-made place.
- [x] **This is the opposite of the rule substrate follows**, and deliberately
      so. A mud nest on a bridge is ordinary, so substrate is one list that
      crosses the line freely; M13 was right about that and it still holds. A
      *location* doesn't cross it — a nest sits in one place, and that place
      either is man-made or it isn't.
- [x] **Flipping the toggle drops a stranded location.** Pick "tree", then
      answer man-made, and "man-made: tree" is not an answer anyone meant to
      give; the picker goes visibly empty and asks again. Anything **typed in
      is kept** — nothing can tell which side of the line a typed term sits on,
      and discarding someone's typing is the worse mistake.
- [x] Typed terms are remembered against **the list that was showing**, so a
      man-made one doesn't come back while the natural list is up.
- [x] `human_structure` is no longer redundant, which it was becoming: it is
      the input that picks the list rather than a fact recoverable from it.

**The behaviour change with teeth**

`human_structure`, `eggs`, `egg_count`, `chicks` and `chick_count` used to be
written on *every* reviewed row — `yes`/`no` and `0`. Off a nest they are now
blank. Three labeled spreadsheets already hold the old shape; those values stay
as they are, and only rows relabeled from here on go blank, so a part-labeled
file ends up mixed in exactly the way the `n/a` removal already left it.

Worth being deliberate about, because it changes what a count means: `0` now
appears only on nests, where it says someone looked and saw none. Blank means
the question was never put. Anyone analysing `egg_count` across a whole file
needs to read `nest_label` beside it — which is the same instruction the rest
of the columns already carry.

### The order, and the keys

Seven controls, read left to right in the order you would describe a nest in —
**where it is, what it is built from, what is in it** — and keyed in that same
order along the top row:

| | Control | Key |
|---|---|---|
| 1 | human-made structure | `Q` / `1` |
| 2 | nest location | `W` / `2` |
| 3 | substrate | `E` / `3` |
| 4 | anthropogenic material | `R` / `4` |
| 5 | bird visible | `A` / `5` |
| 6 | eggs | `S` / `6` |
| 7 | chicks | `D` / `7` |
| 8 | chick stage (M16) | `F` / `8` |

- [x] **`Q W E R` then `A S D`** — one block the left hand covers without
      moving. A single run of seven would have reached out to `T Y U`, which is
      a hand shift halfway through the panel; two rows of four and three is the
      same seven keys without it. The numbers stay `1`–`7` in the same order,
      so the number-pad mirror is unbroken.
- [x] Structure leads because it decides which list the location picker
      offers, so the dependency runs the same way the eye does.
- [x] Eggs before chicks, the order they happen in.
- [x] The panel, the legend and the Preferences list are all generated in this
      order too, so nothing can drift out of step with the screen.
- [x] `r` / `4` is no longer a gap: the numbers are contiguous. M16 went on to
      take `F` / `8`, completing a `Q W E R` / `A S D F` block; M14 gets
      `H` / `9`, skipping `G`, which is jump.

**The cost:** every key moved. Nobody is labeling on the dev build yet, so this
is the moment to do it — but it is the third key change in as many milestones,
and it should be the last. Anyone who saved custom bindings keeps them (saved
wins over defaults); Preferences → reset moves them to the new scheme.

**Still open**

- Seven controls is a lot to lay out on a narrow window, and nothing has been
  done about it — worth looking at before M14 and M16 add an eighth and ninth.
- Moving between the two count boxes needs an `Enter` in between: `S` 3 `D` 1
  doesn't work, because while the cursor is in a count box every printable key
  types into it. Only the arrows escape. That predates this reorder, but
  putting the two counts side by side is what makes it noticeable.
- Flipping the toggle twice does not bring the dropped location back. An undo
  would be nice and is not obviously worth the machinery; the term is one
  keypress away in a list that just got shorter.


## M19 — Location and substrate are required — **built**

Everything in the panel looked equally optional: a red button you could walk
past. But two of these questions are the ones the spreadsheet exists to answer.
There may genuinely be no bird in shot and no man-made material to name, and a
blank there is honest. A nest with no location and nothing built from is just
an unfinished row.

- [x] `nest_location` and `substrate` read **REQUIRED** in amber while empty,
      rather than sitting the same quiet red as the optional ones. A different
      colour and a different word, because the old state said "not answered"
      and the new one has to say "not answered *yet*".
- [x] **`→` will not leave a nest** while either is empty. It doesn't only
      refuse: it marks both, says which are wanted and which keys reach them,
      and **opens the first one**, so the prompt lands the reviewer on the work
      instead of in front of a wall.
- [x] Only that press is gated — the *second* `→`, the one that leaves the
      row. The first still opens the panel and answers nothing, so it can't be
      blocked.
- [x] **`←` and `↓` are never gated.** "This isn't a nest" and "I'm not
      answering this one" have to stay one press, or a requirement just teaches
      people to press `↓`. `↑` isn't gated either: stepping back is navigation,
      and it already saves on the way.

### Requiring an answer needs a way to say "can't tell"

- [x] Both location lists and the substrate list gained **`unclear`**. Without
      it, requiring an answer doesn't collect more data, it collects
      confident-looking guesses — the reviewer has to put *something* there.
- [x] It is **distinct from `other`**, which was already in the location lists:
      `other` means the answer is real but isn't on the list, `unclear` means
      the photograph doesn't show it. Both belong in every list, and they are
      the only terms allowed to appear in more than one — there's a test for
      that, since a real term in two lists means guessing which picker it
      belongs in.
- [x] Neither counts as a listed location for M18's flip rule, so answering
      `unclear` and then changing the structure toggle keeps it.

**Still open**

- **Old files.** A spreadsheet labeled before this has nests with no location
  or substrate. Stepping onto one and pressing `→` now stops to ask — correct,
  arguably the point, but it means finishing an old file costs a pass of real
  work rather than a tap through. Nobody has labeled nests under M17's scheme
  yet, so this only bites if it reaches researchers before then.
- The done screen doesn't count unfinished nests, so there is no way to find
  them except by walking the file. If old files do turn out to need a pass, a
  "nests missing an answer" jump would be the thing to build — the jump box
  already knows how to find the first skipped item.
- Nothing stops a reviewer answering `unclear` for everything. That's true of
  any required field, and the honest fix is looking at the data rather than
  more machinery.


## M20 — Driving a list, and saying what it asks — **built**

Three small things that were costing real accuracy.

- [x] **`↑` and `↓` walk the list.** The highlight is outlined rather than
      filled, so it reads apart from the green that means *recorded* — in a
      multi-select the same row can be both. `↑` off the top clears it, so
      `Enter` goes back to meaning "done" rather than trapping you on row one.
      Typing resets it, and so does a pick, since the list underneath has
      changed.
- [x] **The arrows no longer leave the image while a list is open.** They used
      to close the picker and run their label action, so `→` from inside a
      half-answered list advanced to the next photo. Stepping out from under an
      open question was never what anyone meant. The count boxes keep their
      shortcut — `S`, a number, `→` still works — because there the arrow is
      finishing an answer rather than abandoning one.
- [x] `←` and `→` are inert in a list beyond moving the caret in the filter
      box, which is what a text box should do.
- [x] **`Enter` finishes a list.** With a filter typed it still records the top
      match; with the box **empty** it closes instead. That is what finishes a
      multi-select — picking clears the filter each time, so substrate is
      `E`, `1`, `2`, `Enter` — and `Esc` was doing that job while reading like
      a cancel.
- [x] It also closes a **footgun**: a bare `Enter` used to record whichever
      term happened to sit at the top of the unfiltered list. Nothing typed
      means nothing is being offered, so there is nothing to take.
- [x] **Each picker says what it means**, in its own popup, above the filter.
      The button has room for a label and a key and nothing else, and these
      three are genuinely easy to mix up: a nest of twine on a telephone pole
      is three separate answers.
- [x] **"anthropogenic" is gone from the screen.** The button reads *man-made
      material* and its hint says "built INTO the nest — twine, wire, plastic.
      Not the pole or building it sits on." The column keeps the name
      `anthropogenic_material`, because spreadsheets already carry it.
- [x] The structure toggle reads **"on a human-made structure"** rather than
      "human-made structure", so the thing it is about — what the nest sits on
      — is in the label rather than assumed.

## M21 — More than one reviewer on a row — **built**

`reviewer` was overwritten by whoever went last. One person walks a
spreadsheet, another corrects a call, and the first name vanished with no sign
the row had been looked at twice.

- [x] New column **`reviewers`**: everyone who has answered the row, in the
      order they first did, `; `-joined. `reviewer` keeps its meaning —
      whoever went last, which is what you want when chasing a mistake.
- [x] A correction **adds** a name, never replaces one, and re-labeling by
      someone already listed adds no duplicate.
- [x] A skip counts: it is a decision somebody made.
- [x] The existing "someone else has labeled this file" warning now reads the
      full list, so a name that has since been labeled over still raises it.

**Per row, not per file.** A file-level list would have to be rewritten onto
every row each time somebody new joined — including rows that person never
opened — and this project does not silently rewrite rows nobody touched. The
file-level set is the union of the column, which is one line for whoever
analyses it.

**Still open**

- Rows labeled before the column existed have it blank until they are answered
  again; there is no history to recover, only what happens from here.
- Nothing records *what* a second reviewer changed, only that they were there.
  A real audit trail is a much larger piece of work and probably belongs
  outside the spreadsheet.


## M22 — The required run carries itself — **built**

A minimal nest — on a pole, built of twigs, nothing else to say — cost eight
presses:

```
→   Q   W   1   E   1   Enter   →
```

Three of those were answers. The other five were furniture: opening two lists,
closing one, and the arrows. Every question was a mode you entered and left by
hand, nothing carried you from one to the next, and you had to remember which
letter opened what. There was an invisible ordering rule on top — forget `Q`
first and the location list is the wrong one, so you pick again.

It is now five, and none of them is a key whose only job is to open something:

```
→   [→ if man-made]   1   1   Enter
```

### The run

- [x] Marking a nest **opens the location list with it**. Only on the press
      that opens the panel — stepping back onto a half-finished nest shouldn't
      have a list jump out during navigation.
- [x] Confirming location **opens substrate**. Finishing substrate hands the
      panel back and stops.
- [x] **Only the required questions chain.** Finishing an optional list means
      you went looking for it, and being handed another one would be a
      surprise.
- [x] **`Esc` breaks the run** — it closes a list and chains nothing, which is
      how you get to the counts first if that's the order you like.
- [x] The required *prompt* on `→` is unchanged and now rarely fires: you have
      to have actively stepped out of the run to reach it.

### Left and right switch the location list

- [x] Inside the location picker, `←` and `→` swap between the natural and the
      man-made places, and **that answers the structure question**. It was one
      decision being asked as two, in an order nothing told you about.
- [x] The hint line says which list is showing, since the list itself is the
      only other clue and both are short.
- [x] Flipping still drops a stranded location (M18's rule) but **without
      closing the picker** — here the list changing is the point rather than a
      reason to close. `afterToggle` and the switch share that reconcile step.
- [x] `Q` still toggles it from the panel, for anyone who wants it that way.
- [x] Those keys were inert inside a list as of M20, so this cost nothing
      anyone was using. It does mean `←`/`→` do something in one picker and
      nothing in the other two.

**Still open**

- ~~**`Tab` to walk the panel.**~~ Built as M23: the optional questions no
  longer need their letter remembered.
- The run assumes the required pair is the right place to start. If it turns
  out people want to count first most of the time, the chain is one line to
  reorder.

### Tab through the controls

Built, as M23 — but not the way it was sketched here. The note below is kept
because the reasoning changed on contact with the problem.

~~The idea: `Tab` moves to the next control in the panel and opens it,
`Shift-Tab` goes back.~~ It turned out `Tab` **already did** the walking: the
panel's controls are real buttons and inputs in DOM order, and DOM order is
layout order, so the browser was offering the whole row and nobody could see
it. What was missing was three smaller things — see M23.

The worry that `Tab` would have to be intercepted, and that intercepting it
breaks keyboard accessibility, was the right worry. The answer was to take
nothing.

---

## M23 — Tab walks the panel — **built**

`Tab` and `Shift-Tab` move through the nest panel in the order it is laid out,
`Enter` or `Space` opens or flips whatever is focused, and `Esc` hands focus
back so the walk continues. No key is taken from the browser, so `Shift-Tab`,
screen readers and the rest of the page keep working exactly as they did.

That is the whole feature, and almost none of it is new code, because the
browser was already doing it. Three things were in the way:

- [x] **You couldn't see where `Tab` had got to.** Every panel control now
      takes a white focus ring on `:focus-visible` — white because these
      controls are green when set, red when empty and amber when required, and
      a coloured ring would vanish against one of them. `:focus-visible`
      rather than `:focus`, so clicking something doesn't leave a ring behind.
- [x] **`Enter` on a focused button did two things at once.** The browser turns
      it into a click, and the label loop also read it as "edit notes" — so
      tabbing to a picker and pressing `Enter` opened the list and jumped to
      the notes box together. `Enter` and `Space` on a focused button now
      belong to that button.
- [x] **Activating a control by keyboard threw the walk away.** The toggles and
      the chick-stage button call `blur()` on click, to hand the arrows back to
      the label loop after a mouse click — which also fired on a keyboard
      activation, sending focus back to the top of the page every time you
      pressed `Space`. They now blur only for a real pointer click, which a
      `detail` of 0 distinguishes.
- [x] **`Esc` returns focus to the button that opened the list**, rather than
      dropping it, so a list opened from the walk hands the walk back. Only
      when the list actually had focus — closing one because the row changed
      underneath must not pull focus from wherever it has gone.

Chick stage needs no special case: it is `hidden` until there are chicks, and
hidden elements are not focusable, so it joins and leaves the order on its own.

**Still open**

- `Tab` from the last control carries on into the notes box and the rest of the
  page, rather than cycling within the panel. That is the ordinary behaviour
  and probably right, but a reviewer who tabs past the end has to `Shift-Tab`
  back rather than wrapping around.
- The focus ring is the same on all four control shapes. The counters already
  had their own white outline for the text cursor, so a focused-but-not-typing
  count box and a focused-and-typing one look alike.


## M24 — An open list covers the photo — **open, one attempt reverted**

M22 made the location list open by itself on every nest, which turned a
tolerable overlap into a constant one. Measured at 1440×900: the popup hangs
under its button at 320×424 over a media box of 1440×486 — **17% of it**, and
the middle-left of the image, which is the part you look at to answer the
question it is asking.

**Tried and undone:** moving an open list to a column down the right-hand side
while the media box gave up that width. It measured perfectly — 0% overlap,
and no loss of picture, since a fitted photo is limited by its height and the
box is far wider than it needs — but Stella didn't like it, so it is out. Don't
rebuild it without asking.

One thing worth keeping from the attempt: those rules have to come **after**
the base `.picker-pop` rule. A media query adds no specificity, so the plain
rule wins on source order — and the photo narrows beside a rail that isn't
there, which is exactly what makes it look like it worked.

**Second attempt, kept: make it shorter.** 424px → 272px, and 17% of the media
box down to 11%, without moving anything:

- [x] The explanatory hint above each filter is **gone**. It was two lines on
      every popup, on every nest, to explain a distinction the button labels
      already carry now that "anthropogenic" reads *man-made material*.
- [x] The location list's natural/man-made cue moved into the **filter's
      placeholder**, which shows while the box is empty — exactly when the cue
      is wanted — and costs no height at all.
- [x] The footer is down to one line, because what the filter box is for is
      written in the filter box. It was wrapping to two.
- [x] Tighter rows (24px from 27), tighter padding, and `max-height` down from
      46vh to 34vh. Nine terms still fit without scrolling, which is every
      list there is.

**Still to solve.** It is smaller, not gone. Ideas not yet tried:

- A **bottom sheet** — the list along the bottom, photo above it, so the
  overlap is at the edge of the frame rather than the middle.
- **Not opening it by itself**, which would give the overlap back its old
  rarity at the cost of M22's run.
- Leaving it: the reviewer has already looked at the photo to decide it is a
  nest, and `Esc` reopens the view.


## M25 — Duplicate images — **high priority**

Stella's, and the most important thing outstanding.

**First, what it means.** Three readings, and they are different pieces of
work, so this needs settling before anything is built:

1. **The same catalog number twice in one export.** A row repeated in the
   spreadsheet.
2. **The same photograph uploaded more than once**, under different catalog
   numbers — so it looks like two assets and is two rows.
3. **A burst of near-identical frames** of one nest, which is not really
   duplication so much as redundancy: ten shots, one nest, ten rows to label.

Reading 3 overlaps [M15](#m15--repeat-nests--parked) — repeat nests — but is
not the same thing: M15 is about recognising a nest across *different*
photographs, this is about the same photograph appearing more than once.

**A real bug sits under reading 1, whichever one was meant.** Nothing checks
for it. `catalog.rows` is the raw list from the file, so a repeated catalog
number is walked twice and labeled twice — but both `LabeledFile`s are keyed by
catalog number (`rowsById`), so the second answer silently overwrites the
first, and the output has one row where the input had two. No warning, and the
counts on the done screen disagree with the file. That is worth fixing on its
own, and it is small: `validateFieldnames` already has a warnings channel that
the welcome screen shows.

**Once the reading is settled, the questions it raises:**

- Should a duplicate be **detected and skipped**, **detected and shown** ("you
  have already labeled this one — here is what you said"), or **carried over**
  automatically?
- What counts as the same image for reading 2 — same photographer and date and
  dimensions? That is a guess, not a fact, so it probably has to be shown
  rather than acted on.
- Whatever it does must stay honest about what got reviewed: a skipped
  duplicate still needs a row in the output, or the spreadsheet comes back
  shorter than it went in.

## M26 — iPad, in the Chrome app — **low priority**

It does not run at all today. `isSupported()` in `storage.js` requires
`window.showDirectoryPicker`, and the File System Access API does not exist on
iOS — every browser on an iPad is WebKit underneath, Chrome included, so this
is not something Chrome can differ on. An iPad gets the "unsupported browser"
screen before it gets a file picker.

So this is not a styling job. What it needs:

- **A second way in and out.** Opening would be a plain `<input type="file">`,
  and saving a download or the share sheet rather than a folder. Autosave to a
  folder is simply unavailable; in-browser progress (IndexedDB) still works, so
  the work would be recoverable but only on that iPad.
- **A different set of gestures.** The whole app is keyboard-first — seven
  hotkeys, arrow navigation, type-to-filter. On glass there is no keyboard
  unless one is attached. Every control is already a real button and tappable,
  but the flow is built around keys, and the chained run would want thinking
  about as a touch gesture.
- **Bigger targets.** The chips are sized for a pointer.

Worth deciding *why* first: an iPad is a nicer screen for judging a photograph,
which is a real argument. But a keyboard-first app on a device without a
keyboard is a different app, not a port.

## M27 — Login and accounts — **low priority**

There is no server. The app is a static page on GitHub Pages, the spreadsheet
lives on the researcher's own machine, and work is saved to their own folder —
which is why it has no accounts and why it needs none to run.

Accounts would mean a backend, and that changes what this is. Worth being clear
about what they would buy, because some of it already exists:

- **Who labeled what** — already there. `reviewer` and `reviewers` carry it,
  from a name typed once in Preferences.
- **Stopping two people labeling the same sheet** — partly there. The app warns
  when it finds another name in a file you open. A real lock needs shared
  state.
- **A shared list of typed-in terms**, instead of one per browser. Wanted (see
  M13), and the smallest thing on this list — it needs a file two people can
  write, not accounts.
- **Getting finished files to one place** — OneDrive already does this, and it
  is where the identity really lives.

So the honest version of this item is probably not "login" but "somewhere
shared to put a handful of small files". If it turns out to be genuine accounts
— a hosted app people sign into, with the spreadsheets server-side — that is a
rewrite of the storage layer and should be its own plan, not a milestone here.

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
