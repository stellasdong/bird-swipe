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
export const LABEL_COLUMNS = [
  'nest_label', 'human_structure', 'anthropogenic', 'eggs',
  'notes', 'reviewed', 'reviewed_at', 'reviewer',
];

export const REVIEWED = 'TRUE';
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
    }
  }

  /** Copy label fields back onto rows already present in the labeled file. */
  _restoreFromLabeled() {
    for (const row of this.rows) {
      const prior = this.labeled.get(row[CATALOG_KEY] ?? '');
      if (prior && prior.reviewed === REVIEWED) {
        for (const col of LABEL_COLUMNS) row[col] = prior[col] ?? '';
      }
    }
  }

  // --- labeling -------------------------------------------------------------
  /** Record a decision for row `index`. `nest` is true / false / null. */
  setLabel(index, { nest, structure, anthropogenic = false, eggs = false,
                    reviewer = '', notes = '' }) {
    const row = this.rows[index];
    row.nest_label = nest == null ? '' : (nest ? 'yes' : 'no');
    row.human_structure = structure ? 'yes' : 'no';
    row.anthropogenic = anthropogenic ? 'yes' : 'no';
    row.eggs = eggs ? 'yes' : 'no';
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
    row.human_structure = ''; // no observations recorded on a skip
    row.anthropogenic = '';
    row.eggs = '';
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
    };
  }
}
