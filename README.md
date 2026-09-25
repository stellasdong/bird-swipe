# bird-swipe

Swipe through Macaulay Library nest media and label each asset **nest yes/no**,
and then, only where there is a nest, everything else about it — **human-made
structure**, **eggs** and **chicks**, what it is **made of**, what **man-made
material** is in it and **where it sits** — driven by hotkeys, saving after
every entry.
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
2. Set up your two folders — they're the next thing on the screen, because
   everything after this depends on them.
3. The spreadsheets in your OneDrive folder are listed under **Spreadsheets in
   your OneDrive folder**. Click one to start.
   (**Open a spreadsheet…** still picks a file from anywhere, if you have one
   that isn't in the folder yet.)
4. Label it. Your progress is saved as you go, so you can close the tab and come
   back — the spreadsheet reappears under **In progress on this computer**.
5. When you reach the end you get two buttons:
   - **Save local** — writes the finished files into your local bird-swipe
     folder. Autosave has almost certainly done this already; this is the
     deliberate end-of-spreadsheet save.
   - **Save to OneDrive** — writes them into your folder in the shared project,
     which OneDrive then syncs up. Only finished work goes there — nothing
     half-labeled.

   Do both. They're independent, and each says which folder it used.

The browser asks permission the first time you pick the folder. Choose **Allow
on every visit** so later submissions are one click.

### The two folders

The welcome screen shows a card for each, side by side. **Set up both.**

**Local folder** — a copy on this computer, written as you label. Without one,
your work is kept only in the browser. **Save local** on the done screen writes
there too.

**OneDrive folder** — your folder in the shared project, so finished
spreadsheets reach the team. If you don't have one yet, **Don't have one? Set it
up** opens the instructions, which also point at this protocol and at Mei.

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
where each researcher has their own designated subfolder. Ask Mei for the link
if you don't have it.

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
| `→`       | nest = **YES** → save and open **nest details**; `→` again for the next item |
| `←`       | nest = **NO** → save + next |
| `↓`       | next item — an undecided one is recorded as `nest_label=skip` (counts as reviewed) |
| `↑`       | back to the previous item |
| `Q` / `1` | toggle **on a human-made structure** — and it chooses the location list |
| `W` / `2` | choose the **nest location** — where the nest sits |
| `E` / `3` | choose the **substrate** — what the nest is made of; takes several answers |
| `R` / `4` | choose the **man-made material** built into the nest — takes several answers |
| `A` / `5` | toggle **bird visible** |
| `S` / `6` | **count the eggs** — type a number, then `Enter` |
| `D` / `7` | **count the chicks** — type a number, then `Enter` |
| `F` / `8` | **chick stage** — only once you've counted a chick; press again to change |
| `H` / `9` | toggle **provisioning** — a parent actively feeding |
| `J` / `0` | choose the **prey** — only once provisioning is yes; takes several answers |
| `Z`       | **zoom** the photo to full size and back — or click it |
| `G`       | **jump** to another item — or click the `[12 / 194]` readout |
| `Tab`     | move through the nest details row — `Enter` or `Space` opens or flips what's focused |
| `Enter`   | jump to the notes box |
| `Esc`     | close the file (everything is already saved) |

**Marking a nest walks you through it.** `→` opens the panel *and* the location
list; picking a location opens substrate; finishing substrate hands you back the
panel. You never press a key whose only job is to open something, and the two
required questions are asked first, while you're still looking at the photo. A
whole nest can be five presses:

```
→        nest yes — the location list opens
→        (only if it's man-made — switches which places are offered)
1        telephone pole — substrate opens
1        twig
Enter    done with substrate
```

then `→` again to save and move on. `Esc` steps out of the run at any point if
you'd rather count the eggs first; the optional questions are all still there on
their own keys.

**A nest takes two presses; everything else takes one.** Every question this
app asks only makes sense where there is a nest — there is no structure to
judge, nothing to count and nowhere for a nest to sit on an image without one.
So all of them live in a **nest details** row that `→` opens: it marks
nest = YES and *stays on the image*, and `→` again saves and moves on. `←` (no)
and `↓` (next) stay a single key, which is where most images go, and those rows
record the decision and nothing else.

Every key below `↑` does nothing until the panel is open, so there is no way to
set an answer nobody can see. Stepping back onto a nest reopens the row with
your answers in it.

**Three questions about the nest, three lists.** `W`, `E` and `R` each open a
list; **`↑` and `↓` walk it**, typing narrows it, `Enter` records the highlighted
term or the top match, and `1`–`9` pick straight off the unfiltered list. If what you need isn't there, **type it in and
press `Enter`** — it goes into the spreadsheet exactly as you typed it, and it
joins that list on this computer so the next one is a pick rather than retyping.

| Key | Question | Means |
|---|---|---|
| `W` / `2` | **nest location** | where the nest **physically sits** — see below |
| `E` / `3` | **substrate** | what the nest is **made of** — twig, dried grass, mud / clay / feces, leaves, plant down, animal fur, feathers, or none |
| `R` / `4` | **man-made material** | man-made material built **into** the nest — twine, wire, plastic. Written to `anthropogenic_material` |

**Location and substrate are required.** They say **REQUIRED** in amber until
you answer them, and `→` won't leave a nest while either is empty — it opens
the first one instead and tells you what's wanted. Everything else on the row
is genuinely optional: there may be no bird in shot and no man-made material to
name, but where a nest is and what it's built from are the questions the
spreadsheet exists to answer.

Both lists carry **unclear** for a photo that doesn't show it, which is what
makes requiring them honest rather than a way of collecting guesses. It's a
different answer from **other**, which means the answer is real but isn't on
the list.

`←` (not a nest) and `↓` (skip) are never gated — they stay one press. A
requirement you can't get past just teaches people to skip rows.

**`←` and `→` switch which places you're offered**, and the filter box says
which you're looking at until you start typing. The location list starts on the
**natural** places (tree, tree cavity, cactus, shrub, snag, ground, cliff or
rock ledge); one press of `→` swaps it for the **man-made** ones (telephone
pole, building or ledge, tower, bridge, nest box or platform, sign), and the
line above the list tells you which you're looking at. You read seven terms
instead of fourteen, and a tree is never offered as a man-made place.

Doing that *answers* the human-made structure question — it's the same
decision, so you make it once, from inside the list it decides. `Q` still
toggles it from the panel if you'd rather.

Either way, a location that came off the list you just turned away from is
**dropped** — "man-made: tree" isn't an answer anyone means to give, and the
button goes visibly empty so you can pick again without closing anything.
Anything you typed yourself is kept, since nothing can tell which side of the
line it belongs to.

This is the opposite of the substrate rule, on purpose: a mud nest on a bridge
is ordinary, so substrate is one list that crosses the line freely. A location
doesn't cross it — a nest sits in one place, and that place either is man-made
or it isn't.

These were one question until it became clear it was three: "what is the nest
on?" can't be answered once when the honest answer is mud, on a telephone pole,
with plastic twine in it.

**Three questions that are easy to mix up.** A nest of twine on a telephone
pole is three different answers:

- **substrate** is the **natural** material the nest is built *from*
- **man-made material** is man-made material built *into* it — twine, wire
- **structure** and **location** are what it is *sitting on*

The column is still called `anthropogenic_material`, because spreadsheets
already carry that name.

**Substrate and man-made material take several answers.** A nest is often twigs
*and* mud *and* a fur lining, and can hold plastic twine *and* wire at once — so
picking adds a term and leaves the list open for the next one. Pick again to
remove it, `Enter` or `Esc` when you're done. They go into one cell separated by
`; `. Location takes a single answer and closes as soon as you pick, because a
nest is in one place.

You are not asked separately whether there is man-made material: naming one
answers it. The `anthropogenic` column still says `yes` / `no`, worked out from
what you picked, the same way `eggs` follows the egg count.

**`Enter` finishes a list.** With something typed, `Enter` records the top match
— that's how you pick. With the box empty it means *done* and closes the list,
which is what finishes a multi-select like substrate: picking clears the box
each time, so the whole gesture is `E`, `1`, `2`, `Enter`. It also means a bare
`Enter` can't quietly record whatever happens to be at the top of the list.

**The arrow keys belong to an open list.** `↑` and `↓` move the highlight
through it — outlined in amber, so you can tell where you are from what's
recorded in green — and `Enter` takes whatever is highlighted. `↑` off the top
clears the highlight, so `Enter` goes back to meaning *done*. `←` and `→` do
nothing to the image while a list is open; they just move the cursor in the
filter box.

That means you can't advance off an image with a list still open — press `Esc`
or `Enter` first. It's deliberate: stepping to the next photo out from under a
half-answered question was never what anyone meant, and a list you can only
reach by typing or by counting to nine is a list you can't browse. The count
boxes are unchanged — arrows still work straight out of those, so counting is
still `S`, a number, `→`.

Nothing is recorded until you confirm it: `Esc` closes a list and leaves the
answer exactly as it was, so a half-typed word can never land in the
spreadsheet as an answer.

**The keys run in the order the buttons do** — `Q W E R` along the top row,
then `A S D F` on the home row below. One block your left hand covers without
moving, so the panel can be answered straight down the row rather than
memorised. The numbers mirror them `1`–`8` in the same order, for a number pad.

The order is the order you would describe a nest in: where it is, what it is
built from, what is in it — and structure comes first because it decides which
list the location picker offers.

**Or don't learn the letters at all.** `Tab` moves along the nest details row
in the order you see it, `Shift-Tab` goes back, and `Enter` or `Space` opens or
flips whatever is focused — a white ring shows where you are. `Esc` closes a
list and hands you back to the button you opened it from, so the walk carries
on. It's the ordinary browser behaviour, so nothing about the rest of the page
changes.

Each control has a letter key and the matching number key, so a number pad works
too. They all appear as buttons in the nest details row — **green** when set,
**red** when not — and you can click them instead of using the keys. They always
show what is already saved for that item, so stepping back shows your earlier
answers rather than a blank slate.

**Eggs and chicks are counted, not just flagged.** Pressing `S` (or `D`) puts
the cursor in that box with the current number selected, so typing replaces it.
You don't have to press `Enter` first — `→`, `←`, `↑` and `↓` all work straight
from the box, so counting is `S`, a number, then `→`. A nest can hold both, and
both are optional; on a nest, leaving a box alone records as none seen. Off a
nest they aren't asked at all, and stay blank.

**Provisioning is about active feeding.** `H` marks that a parent is *actively
feeding* — not just present, and not just carrying something. Say yes and a
**prey** list appears on `J`: mammal, bird, reptile / amphibian, fish, other,
unclear. It takes several answers, since one image can show more than one item.

Use **unclear** when a parent is clearly feeding but you can't see what — that's
a different fact from leaving it blank, which means nobody answered. **Other**
covers anything off the list, invertebrates included. Answer `H` back to no and
the prey answer goes with it.

The column is `provisioning`, which in the literature usually means the wider
"bringing food to the nest". Here it means feeding, which is why the button
says both.

**Chick stage.** Once you've counted at least one chick, a chick-stage button
appears; press `F` to cycle it. **Early is downy, late is feathered** — the
definition is on the button so two people draw the line in the same place.
There's an **unclear** state for a brood you can't call, including one caught
mid-moult, so you never have to guess. Set the chick count back to zero and the
button goes away and takes its answer with it.

**Seen this nest before?** One nest often turns up ten times in a burst, and
again a month later. The **seen this nest before?** button sits next to the
nest YES / NO buttons — above the decision, because recognising a nest happens
while you're looking at the photograph, not after you've committed to calling it
one. It opens a contact sheet of the whole spreadsheet: click every photograph
that shows the same nest, then **Mark as one nest**. The nest's code shows
beside it, with how many other assets share it.

**It shows the whole spreadsheet**, scrollable, in file order, with the row you
came from marked and scrolled into view. Nothing is filtered out by guesswork:
two eBirders can photograph the same nest, and the coordinates are approximate,
so a rule built on either would hide real matches. There's a search box for when
you already know what you're after, and it starts empty.

Every tile carries the **recordist**, the **date**, the **coordinates** and
roughly **how far away** it is from the one you're on — that's the evidence,
offered rather than enforced. Distances are deliberately coarse (`same spot`,
`≈40 m away`, `≈2900 km away`), because the coordinates don't support more
precision than that.

**Every nest gets a code** — `AAAA`, `AAAB`, `AAAC` — handed out in the order
you find them, the first time you mark a row as a nest. Opening a spreadsheet
labeled before codes existed names its nests on the way in, so you never get a
file where some can be grouped and others can't. Grouping assets makes
them share one: the older code wins, so merging into a nest you've already named
keeps that name. Reopening the button on a nest that already has a group starts
from that group, so adding an eleventh photograph to ten is the same gesture.
**Ungroup** gives each one its own code back.

A code is the nest's name, so marking a row "no" and then "yes" again keeps it —
a mis-press can't rename a nest or break it out of a group you built by hand.

**Grouping fills the image you're on, straight away** — whichever order you do
it in. Group before deciding and the nest details row opens showing the
answers, ready to confirm; group after deciding and the open panel fills in
front of you. Either way the panel fills from the other image — structure,
location, substrate, material, counts — and says **filled in from nest AAAA —
check the counts**. Anything you'd already answered about *this* photograph is
kept: the nest's answers fill the gaps, they don't overrule you.

**And every later asset in the group arrives the same way.** Walk on to one and
its panel is already open and filled, saying **filled in from nest AAAA — check
the counts, then `→` to confirm**. Once a nest has been answered, the other
assets in its group start from those answers — structure, location, substrate,
material, the lot — so you don't retype the same nest ten times for a burst.
The panel says **filled in from nest AAAA — check the counts**, and the chip row
says **answers ready** before you've even decided.

Nothing is written by looking. You still walk through every asset and still
press `→` to save it, which is the point: **the counts, the chick stage and
whether a parent is feeding are exactly what changes between visits**, and
they're what you're there to correct. Eggs in May are chicks in June.

An asset that has already been reviewed is never overwritten — its answers are
your judgement about that photograph, and grouping it with others isn't a
reason to throw that away.

An asset you haven't reviewed yet can be grouped, but the grouping only reaches
the file when you label it — the tile says **not reviewed yet**, and the
confirmation tells you how many saved now and how many will save later.

**Zoom in before you count.** Photographs taken from a distance rarely show eggs
or chicks clearly at fit-to-window size. Press `Z` or click the photo and it
loads at full resolution — scroll to move around, press `Z` or click again to
fit.

**The blurb under the photo** names the **recordist** — the eBirder who took it
— and links their **eBird checklist**, which opens the whole outing: the other
photographs, the notes, what else was seen there. Recordist, date and checklist
together are how you recognise a nest you've labeled before.

**Media notes are shown in English** where the browser can manage it. The note
is what the eBirder wrote about the photograph, in whatever language they use,
and it is often the line that says whether it is a nest at all — so a note
detected as something other than English is translated, labelled **"Media notes
(translated from Spanish)"**, with **show original** next to it. The original is
one click away and is always what the spreadsheet holds; the translation is a
reading aid and is never written to a file.

The first note of a session needs one click on **translate to English** —
Chrome won't build a translation model without a gesture. After that it is
automatic for every note in that language. It needs **Chrome 138 or newer on
desktop**, and it runs entirely on your own machine: nothing is uploaded, which
is the only reason it's in here at all — field notes are the researcher's data.
On any browser without it, the note simply shows as written.

If a photo won't load, bird-swipe retries once by itself and then offers a
**Try again** button — so a patchy connection doesn't push you into skipping an
item you never actually saw.

A bar under the header fills as you review, and once you have a rhythm it
estimates how much longer the spreadsheet will take.

**Jumping around.** `G` (or clicking the `[12 / 194]` readout) takes a row
number or an ML catalog number, so you can get straight back to something you
want to change instead of pressing `↑` fifty times. It can also send you to the
first un-reviewed or first skipped item.

The notes box sits at one line and gives the height to the photo. It opens up
while you're typing, and stays open on any item that has a note, so stepping
back never hides one.

Hotkeys are rebindable in **Preferences…**. (Upgrading from an earlier version
resets them to the defaults above, because the scheme changed — eggs became a
count and chicks were added.) Reopening a file resumes at the
first **un-reviewed** asset (skipped items count as reviewed, so it won't jump
back to them — but the done screen has a **Review skipped items** button to
revisit them). Click a video to play/pause it. To add a **note**, press `Enter`
(or click the Notes box), type, then press `Enter` again to return to labeling —
the note is saved when you press YES/NO.

## If something goes wrong

**⚠ Report a problem** sits at the bottom centre of every screen. It turns amber
and counts up if the app hits an error — including a failed save.

It asks three short questions — what you were doing, what went wrong, and
whether it happens again — and all three are required, because the app can
describe its own state but only you can say what you saw. If an error was
caught, *what went wrong* is filled in for you.

To that it adds what makes a problem diagnosable: app version, browser, which
spreadsheet and row, whether the folders are still connected, and the actual
error with its stack. You see every line before anything leaves, and **nothing
from your spreadsheet is included**. Press **Copy report** and paste it into an
email to **Stella** — the first line is a ready-made subject.

If an error does happen, your labeling is still saved: the app says so, and
carries on.

## How labels are saved

The original export is never modified. While you label, your work is kept **in
the browser on your own computer**, plus an autosave folder if you set one up.
Nothing is shared yet. Keeping the browser copy is what lets you open an export
straight from Downloads without granting access to any folder.

**Save local** and **Save to OneDrive** each write the same two files into the
folder you chose for them:

```
labeled/<name>_labeled.csv        all completed entries
labeled/nest/<name>_nest.csv      only the nest=yes entries
```

The `nest/` subfolder is the point of the split: it collects only the
nest-positive rows across every spreadsheet, so they can be picked up as a
group. Autosave writes the same two paths inside your local folder as you label.

Each row gets these columns appended to the original ones:

| Column | Meaning |
|---|---|
| `nest_label` | `yes` / `no` / `skip` |
| `human_structure` | `yes` / `no` — also chooses which location list is offered |
| `bird_present` | `yes` / `no` |
| `substrate` | what the nest is **made of** — one or more terms from the list or typed in, separated by `; ` |
| `anthropogenic_material` | the **man-made** material in it — one or more of plastic, metal, other, or typed in, separated by `; ` |
| `anthropogenic` | `yes` / `no` — derived from `anthropogenic_material`, so they can't disagree |
| `nest_location` | where the nest **sits** — a term from whichever list `human_structure` selected, or typed in |
| `eggs`, `chicks` | `yes` / `no` — derived from the counts, so they can't disagree |
| `egg_count`, `chick_count` | a number |
| `chick_stage` | `early` (downy), `late` (feathered) or `unclear` — only where chicks were counted |
| `provisioning` | `yes` / `no` — a parent **actively feeding**, not merely carrying food |
| `prey_group` | what is being fed — one or more of mammal, bird, reptile / amphibian, fish, other, unclear, separated by `; `; only where `provisioning=yes` |
| `notes`, `reviewed`, `reviewed_at` | |
| `reviewer` | whoever answered the row **last** |
| `reviewers` | **everyone** who has answered it, in the order they first did, separated by `; ` |
| `nest_id` | which nest this is — a four-letter code (`AAAA`, `AAAB`, …) given to every nest, shared by every asset grouped as one. Unique within one spreadsheet; it means nothing across files |

**Every column but `nest_label` is nest-only**, and blank wherever there was no
nest to ask about. `nest_label` in the same row says which kind of blank it is:
`no` means there was no nest, `skip` means nothing was answered, and a blank one
means the row was never reached.

Structure, eggs and chicks were asked on every image until recently, so files
labeled before that carry `yes`/`no`/`0` for them on non-nest rows. Those values
stay as they are; only rows relabeled from now on go blank. Older files may also
hold `n/a` in the nest-only columns from an earlier scheme — the app reads that
as blank and never writes it again.

Both files are keyed by ML catalog number; flipping a row out of "nest=yes"
removes it from the nest file.

> **Reading the counts.** On a row marked `nest_label=yes`, a count of `0`
> means none were seen — someone looked. A **blank** count means the question
> was never put: the row is not a nest, was skipped, or was never reached. So
> `0` and blank both mean "no eggs here", but only `0` is an observation.

> **Reading a blank column.** Every column but `nest_label` only applies where
> there is a nest, so off one they are all blank — and `nest_label` in the same
> row says which kind of blank it is: `no` (no nest to ask about), `skip`
> (nothing answered), or blank (never reached). Read the pair, not the column
> alone. An earlier version wrote `n/a` instead; files labeled then still open,
> and the app reads that as blank.

> **Save when you finish a spreadsheet.** Without a local folder, in-progress
> work lives only in that browser on that computer: it survives closing the tab,
> quitting the browser and restarting the machine, but **clearing your browsing
> data will delete it**. Choosing a local folder (above) removes that risk.

Because each researcher works on their own spreadsheet and submits a finished
file, two people never write the same file at once. If the app does spot labels
from someone else in a file you open, it warns you.

When a row *is* answered twice — one person walks the spreadsheet, another
corrects a call — both names are kept. `reviewer` is whoever went last, which
is what you want when chasing a mistake; `reviewers` is everyone who has
touched it, which is what you want when asking who agreed. A correction adds a
name, it never replaces one. Rows labeled before this column existed fill it in
the first time they are answered again.

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

Open **http://localhost:8000/web/test.html** — 228 assertions covering the CSV
parser, the label scheme, the nest-only columns, the three term lists and their
filter, resume, the truncation guard,
the debounced writer,
the in-browser progress store, autosave mirroring, the output folder layout and
the problem report, plus round-trips of every real export in `test/`. The page title shows a ✓ or ✗
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
web/settings.js   reviewer name, hotkeys, remembered picker terms  (was config.py)
web/channel.js    real app or dev preview, and which storage each gets
```

No build step and no dependencies — the files that ship are the files in the
repo. `csv.js` is hand-written rather than vendored so the app works offline and
carries no third-party code.

### Deploying

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `web/` to
GitHub Pages on every push to `main`; that push *is* the release. One-time
setup: **Settings → Pages → Source: GitHub Actions**.

### The dev preview

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
- [x] M8 — egg and chick counts
- [x] M9 — save local and save to OneDrive as separate, explicit steps
- [x] M10 — error catching and a problem report researchers can email
- [x] M11 — zoom, faster counting, and colour-blind-safe toggles
