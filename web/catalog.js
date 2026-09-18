// Spreadsheet load / validate, plus in-memory logs of completed entries.
//
// Port of bird_swipe/core/catalog.py. Model is unchanged: the original export
// is never modified, and labels accumulate into two files keyed by ML catalog
// number —
//
//     <out>/labeled/<name>_labeled.csv     all completed entries
//     <out>/labeled/nest/<name>_nest.csv   only the nest=yes entries
//
// Unlike the Python version this module does no I/O. LabeledFile holds state
// and a dirty flag; storage.js decides when to write. That keeps the label
// logic testable without a filesystem, and lets writes be debounced — which
// matters because every commit rewrites a whole file, and in a synced
// SharePoint folder each rewrite is an upload.

import { parseTable, serializeTable } from './csv.js';

// Minimum columns we rely on. Missing any of these is a hard error.
export const REQUIRED_COLUMNS = [
  'ML Catalog Number', 'Format', 'Common Name', 'Scientific Name', 'Asset Tags',
];
export const CATALOG_KEY = 'ML Catalog Number';

// Columns bird-swipe appends. Order preserved when new to a file.
//
// eggs/chicks stay yes/no for continuity with already-labeled files, and are
// derived from the counts so the two can never disagree. anthropogenic is the
// same arrangement one step later: it was a toggle until a material list
// replaced it, and is now derived from anthropogenic_material.
//
// Every one of these but nest_label is nest-only: see NEST_ONLY_COLUMNS. On a reviewed row an
// unanswered count is written as 0 rather than left blank: the row was looked
// at, so "none seen" is a real observation. Blank counts therefore only ever
// appear on rows that were skipped or never reached.
export const LABEL_COLUMNS = [
  'nest_label', 'human_structure', 'anthropogenic',
  'eggs', 'egg_count', 'chicks', 'chick_count',
  'bird_present', 'substrate', 'anthropogenic_material', 'nest_location',
  'notes', 'reviewed', 'reviewed_at', 'reviewer',
];

// Questions that only make sense where there is a nest. They are answered in
// the nest-details panel, which the app opens when a row is marked nest = yes.
//
// Off a nest they are left blank. An earlier version wrote 'n/a' there, to
// keep blank meaning only "not answered"; nest_label already carries that
// distinction (no / skip / blank), so the filler was doing work the row
// already did. A reader handles two tokens: a value, or blank — and reads
// nest_label to learn why it is blank. See TODO.md.
// Every observation is nest-only now. Off a nest there is nothing to observe:
// no structure to judge, nothing to count, nowhere for a nest to sit. The row
// is one press and carries a decision, and that is all.
export const NEST_ONLY_COLUMNS = [
  'human_structure', 'bird_present',
  'eggs', 'egg_count', 'chicks', 'chick_count',
  'substrate', 'anthropogenic', 'anthropogenic_material', 'nest_location',
];

// Only ever read, never written: files labeled before that change still hold
// it, and it would otherwise come back as a substrate named "n/a".
export const LEGACY_NOT_APPLICABLE = 'n/a';

/** Blank out a legacy 'n/a' so old files load as though they had been blank. */
function dropLegacyNotApplicable(row) {
  for (const col of NEST_ONLY_COLUMNS) {
    if (row[col] === LEGACY_NOT_APPLICABLE) row[col] = '';
  }
}

// Three questions, not one. An earlier version asked a single "what is the
// nest on?", and its option list gave the game away by mixing branches,
// bridges, plastic and bare ground. They come apart cleanly:
//
//   substrate              what the nest is MADE OF, natural material only
//   anthropogenic_material what man-made material is in it
//   nest_location          where the nest physically SITS
//
// Each list is deliberately short. Anything missing is typed in, kept verbatim
// in the file, and remembered in that browser (see settings.js) so it comes
// back next time — which is also why no list needs an explicit "other" entry:
// a filter that matches nothing already is the other box.

// Multi-select: a nest is often twigs AND mud AND a fur lining, and making the
// reviewer choose one would throw away the other two.
export const SUBSTRATE_OPTIONS = [
  'twig', 'dried grass', 'mud / clay / feces', 'leaves', 'plant down',
  'animal fur', 'feathers',
  'none',
];

// Single-select. 'other' is listed because naming it is a prompt to look for
// it, not because the picker needs it.
export const ANTHROPOGENIC_OPTIONS = ['plastic', 'metal', 'other'];

// Where the nest sits, in two lists rather than one. human_structure is asked
// first and chooses between them, so the reviewer reads six or seven terms
// instead of fourteen, and a tree can never be offered as a man-made place.
//
// This is the opposite of the rule the substrate list follows, and
// deliberately so: substrate crosses the natural/man-made line freely — a mud
// nest on a bridge is ordinary — but a location does not. A nest sits in one
// place, and that place is either man-made or it isn't.
export const NATURAL_LOCATION_OPTIONS = [
  'tree', 'tree cavity', 'cactus', 'shrub', 'snag',
  'ground', 'cliff or rock ledge',
  'other',
];
export const MANMADE_LOCATION_OPTIONS = [
  'telephone pole', 'building or ledge', 'tower', 'bridge',
  'nest box or platform', 'sign',
  'other',
];

/** The location list the structure answer calls for. */
export function locationOptions(humanStructure) {
  return humanStructure ? MANMADE_LOCATION_OPTIONS : NATURAL_LOCATION_OPTIONS;
}

/**
 * Whether a recorded location belongs to a list. Used when the structure
 * answer is flipped: a term off the list now hidden is dropped, because
 * "man-made: tree" is not an answer anyone meant to give. Anything typed in
 * belongs to neither list and is kept — nothing can tell which side it is on,
 * and throwing away what someone typed is worse than leaving it standing.
 */
export function isListedLocation(term) {
  const t = String(term ?? '').trim().toLowerCase();
  if (!t || t === 'other') return false;
  return [...NATURAL_LOCATION_OPTIONS, ...MANMADE_LOCATION_OPTIONS]
    .some(o => o.toLowerCase() === t);
}

// Several answers in one cell, joined so a comma never has to be escaped to
// stay readable. The same separator M14 will use for prey.
export const MULTI_SEP = '; ';

/** A multi-select cell as a list of terms. Tolerates a plain single value. */
export function splitTerms(value) {
  return String(value ?? '').split(';').map(t => t.trim()).filter(Boolean);
}

/** Terms back into a cell: trimmed, de-duplicated case-insensitively, in order. */
export function joinTerms(terms) {
  const seen = new Set();
  const out = [];
  for (const term of (Array.isArray(terms) ? terms : splitTerms(terms))) {
    const value = String(term ?? '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(MULTI_SEP);
}

/**
 * One of the lists above narrowed by what's been typed. Matches at the start of
 * any word come first, so "br" offers branch and bridge before "nest box",
 * which only holds a "b" mid-word. `extra` carries the terms this browser has
 * remembered.
 */
export function filterTerms(options, query, extra = []) {
  const all = [...options, ...extra.filter(t => t && !options.includes(t))];
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return all;
  const starts = all.filter(
    t => t.toLowerCase().split(/[^a-z]+/).some(word => word.startsWith(q)));
  const inside = all.filter(t => !starts.includes(t) && t.toLowerCase().includes(q));
  return [...starts, ...inside];
}

export const REVIEWED = 'TRUE';

/**
 * A count box's contents as a number. Anything unparseable — empty, spaces,
 * a stray letter — is 0, which on a reviewed row means "looked, saw none".
 */
export function normalizeCount(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export const SKIPPED = 'skip'; // nest_label value for a skipped-but-reviewed item

export const LABELED_DIRNAME = 'labeled';
export const NEST_DIRNAME = 'nest';

// --- names ------------------------------------------------------------------
const splitExt = name => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
};

/** `ML__x.csv` -> `ML__x_labeled.csv` (extension kept, defaulting to .csv). */
export function labeledName(inputName) {
  const [stem, ext] = splitExt(inputName);
  return `${stem}_labeled${ext || '.csv'}`;
}

/** `ML__x.csv` -> `ML__x_nest.csv`. */
export function nestName(inputName) {
  const [stem, ext] = splitExt(inputName);
  return `${stem}_nest${ext || '.csv'}`;
}

// --- validation -------------------------------------------------------------
export class ValidationError extends Error {}

export function validateFieldnames(fieldnames) {
  const errors = [];
  const warnings = [];
  if (!fieldnames || !fieldnames.length) {
    return { errors: ['File has no header row.'], warnings: [], ok: false };
  }
  if (fieldnames[0] !== CATALOG_KEY) {
    errors.push(`First column must be "${CATALOG_KEY}", got "${fieldnames[0]}".`);
  }
  for (const col of REQUIRED_COLUMNS) {
    if (!fieldnames.includes(col)) errors.push(`Missing required column: "${col}".`);
  }
  // A genuine Macaulay export is wide; warn (don't fail) if it looks trimmed.
  const dataCols = fieldnames.filter(c => !LABEL_COLUMNS.includes(c));
  if (dataCols.length < 10) {
    warnings.push(
      `Only ${dataCols.length} data columns found; expected a full Macaulay export (~46).`);
  }
  return { errors, warnings, ok: errors.length === 0 };
}

// --- one output file --------------------------------------------------------
/**
 * One `<name>_labeled.csv` holding completed entries for a species file.
 * Rows are keyed by ML catalog number; re-labeling an asset updates its row.
 */
export class LabeledFile {
  constructor(name, text = null) {
    this.name = name;
    this.rowsById = new Map();
    this.fieldnames = [];
    this.dirty = false;
    // True once we have parsed a pre-existing file. Distinguishes "new file"
    // from "loaded file", which the truncation guard in storage.js needs.
    this.loaded = false;
    if (text != null) this.load(text);
  }

  load(text) {
    const { rows, fieldnames } = parseTable(text);
    this.fieldnames = fieldnames;
    for (const row of rows) {
      const key = row[CATALOG_KEY];
      if (key) this.rowsById.set(String(key), row);
    }
    this.loaded = true;
  }

  get(mlId) {
    return this.rowsById.get(String(mlId)) ?? null;
  }

  /** Insert or update a completed entry. */
  upsert(row) {
    const key = String(row[CATALOG_KEY]);
    for (const col of Object.keys(row)) { // grow the column union, preserving order
      if (!this.fieldnames.includes(col)) this.fieldnames.push(col);
    }
    this.rowsById.set(key, { ...row });
    this.dirty = true;
  }

  /** Remove an entry if present. */
  discard(mlId) {
    if (this.rowsById.delete(String(mlId))) this.dirty = true;
  }

  count() {
    return this.rowsById.size;
  }

  serialize() {
    return serializeTable(this.fieldnames, [...this.rowsById.values()]);
  }
}

// --- the catalog ------------------------------------------------------------
/** Rows of one Macaulay export, with completed labels held in two LabeledFiles. */
export class Catalog {
  constructor(rows, fieldnames, labeled, nest, inputName) {
    this.rows = rows;
    this.fieldnames = fieldnames;
    this.labeled = labeled;
    this.nest = nest;
    this.inputName = inputName;
    this._ensureLabelColumns();
  }

  /**
   * Build a catalog from the export's text plus whatever the two output files
   * already contain (null when they don't exist yet).
   */
  static open(inputName, inputText, { labeledText = null, nestText = null, resume = true } = {}) {
    const { rows, fieldnames } = parseTable(inputText);
    const validation = validateFieldnames(fieldnames);
    if (!validation.ok) throw new ValidationError(validation.errors.join('; '));

    const labeled = new LabeledFile(labeledName(inputName), labeledText);
    const nest = new LabeledFile(nestName(inputName), nestText);
    const catalog = new Catalog(rows, fieldnames, labeled, nest, inputName);
    if (resume) catalog._restoreFromLabeled();
    return { catalog, validation };
  }

  _ensureLabelColumns() {
    for (const col of LABEL_COLUMNS) {
      if (!this.fieldnames.includes(col)) this.fieldnames.push(col);
    }
    for (const row of this.rows) {
      for (const col of LABEL_COLUMNS) if (row[col] === undefined) row[col] = '';
      dropLegacyNotApplicable(row); // the input may itself be an old labeled file
    }
  }

  /** Copy label fields back onto rows already present in the labeled file. */
  _restoreFromLabeled() {
    for (const row of this.rows) {
      const prior = this.labeled.get(row[CATALOG_KEY] ?? '');
      if (prior && prior.reviewed === REVIEWED) {
        for (const col of LABEL_COLUMNS) row[col] = prior[col] ?? '';
        dropLegacyNotApplicable(row);
      }
    }
  }

  // --- labeling -------------------------------------------------------------
  /** Record a decision for row `index`. `nest` is true / false / null. */
  setLabel(index, { nest, structure,
                    eggCount = '', chickCount = '', birdPresent = false,
                    substrate = '', anthropogenicMaterial = '', nestLocation = '',
                    reviewer = '', notes = '' }) {
    const row = this.rows[index];
    const eggs = normalizeCount(eggCount);
    const chicks = normalizeCount(chickCount);
    const anthropogenic = joinTerms(anthropogenicMaterial);
    // A toggle has a default ("no" once the row is answered); a picker has
    // none, so an unanswered one stays blank — which still reads as "nobody
    // answered", exactly as blank does everywhere else. A count has a default
    // too: 0, because on a nest someone looked and saw none.
    //
    // anthropogenic is no longer asked: it is derived from whether a material
    // was named, the same way eggs is derived from egg_count, so the yes/no
    // and the detail can never disagree. It was a top-level toggle until the
    // material list replaced it, and it stays in the file for continuity with
    // spreadsheets labeled before that.
    const nestOnly = {
      human_structure: structure ? 'yes' : 'no',
      bird_present: birdPresent ? 'yes' : 'no',
      eggs: eggs > 0 ? 'yes' : 'no',
      egg_count: String(eggs),
      chicks: chicks > 0 ? 'yes' : 'no',
      chick_count: String(chicks),
      substrate: joinTerms(substrate),
      anthropogenic: anthropogenic ? 'yes' : 'no',
      anthropogenic_material: anthropogenic,
      nest_location: String(nestLocation ?? '').trim(),
    };
    row.nest_label = nest == null ? '' : (nest ? 'yes' : 'no');
    // Answered on a nest; blank off one, where the question didn't apply —
    // which is now every observation the app records.
    for (const col of NEST_ONLY_COLUMNS) {
      row[col] = nest === true ? (nestOnly[col] ?? '') : '';
    }
    row.notes = notes;
    row.reviewed = REVIEWED;
    row.reviewed_at = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
    row.reviewer = reviewer;

    this.labeled.upsert(row);
    if (nest) this.nest.upsert(row);
    else this.nest.discard(row[CATALOG_KEY]); // flipped to no / unset
  }

  /**
   * Mark row `index` skipped: reviewed, but flagged nest_label=skip. Counts as
   * reviewed (so resume passes over it) yet stays clearly marked, and can be
   * revisited from the done screen.
   */
  setSkip(index, { reviewer = '', notes = '' } = {}) {
    const row = this.rows[index];
    row.nest_label = SKIPPED;
    // No observations recorded on a skip — and since every observation is
    // nest-only, that is the whole list in one loop.
    for (const col of NEST_ONLY_COLUMNS) row[col] = '';
    row.notes = notes;
    row.reviewed = REVIEWED;
    row.reviewed_at = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
    row.reviewer = reviewer;

    this.labeled.upsert(row);
    this.nest.discard(row[CATALOG_KEY]); // a skip is never a nest
  }

  // --- queries --------------------------------------------------------------
  isReviewed(index) {
    return this.rows[index]?.reviewed === REVIEWED;
  }

  isSkipped(index) {
    return this.rows[index]?.nest_label === SKIPPED;
  }

  firstUnreviewed() {
    for (let i = 0; i < this.rows.length; i++) if (!this.isReviewed(i)) return i;
    return this.rows.length; // all done
  }

  skippedIndices() {
    return this.rows.map((_, i) => i).filter(i => this.isSkipped(i));
  }

  /** Index of the next skipped row after `i`, or null. */
  nextSkippedAfter(i) {
    for (let j = i + 1; j < this.rows.length; j++) if (this.isSkipped(j)) return j;
    return null;
  }

  /** Reviewers other than `me` who already have rows in the labeled file. */
  otherReviewers(me) {
    const seen = new Set();
    for (const row of this.labeled.rowsById.values()) {
      const who = (row.reviewer ?? '').trim();
      if (who && who !== me) seen.add(who);
    }
    return [...seen];
  }

  stats() {
    const count = fn => this.rows.reduce((n, r) => n + (fn(r) ? 1 : 0), 0);
    return {
      total: this.rows.length,
      reviewed: count(r => r.reviewed === REVIEWED),
      yes: count(r => r.nest_label === 'yes'),
      no: count(r => r.nest_label === 'no'),
      skipped: count(r => r.nest_label === SKIPPED),
      structure: count(r => r.human_structure === 'yes'),
      anthropogenic: count(r => r.anthropogenic === 'yes'),
      eggs: count(r => r.eggs === 'yes'),
      chicks: count(r => r.chicks === 'yes'),
      birds: count(r => r.bird_present === 'yes'),
      substrates: count(r => r.substrate && r.substrate !== LEGACY_NOT_APPLICABLE),
      locations: count(r => r.nest_location),
      eggTotal: this.rows.reduce((n, r) => n + normalizeCount(r.egg_count), 0),
      chickTotal: this.rows.reduce((n, r) => n + normalizeCount(r.chick_count), 0),
    };
  }
}
