// Persisted user settings: reviewer name + customizable hotkeys.
//
// Port of bird_swipe/config.py, backed by localStorage instead of a JSON file
// in the platform config dir. Keys are stored as KeyboardEvent.key values
// ("ArrowRight", "q") so the stored value is readable and comparable directly
// against an event.

import { scoped } from './channel.js';

const STORE_KEY = `${scoped('bird-swipe')}:settings`;

// Bump when the default hotkey scheme changes shape. Saved bindings from an
// older scheme are ignored (reset to the new defaults) rather than merged, so
// stale keys can't collide with reassigned defaults.
//
// Adding a *new* action doesn't need a bump: getKeys() merges saved bindings
// over the defaults, so an action nobody has a saved binding for simply takes
// its default. Only changing what an existing action means does.
export const KEYS_VERSION = 3;

// action -> default KeyboardEvent.key. The three observation toggles each have
// a letter and a number binding (the number pad mirror), so both are rebindable.
export const DEFAULT_KEYS = {
  nest_yes: 'ArrowRight',
  nest_no: 'ArrowLeft',
  forward: 'ArrowDown',
  back: 'ArrowUp',
  notes: 'Enter',
  // Every question below is a nest-details question, reachable only once a row
  // is marked nest = yes: off a nest there is nothing to observe.
  //
  // They are listed in the order they appear on screen, and keyed in that same
  // order: Q W E R along the top row, then A S D on the home row below it. One
  // block the left hand covers without moving — a single run of seven would
  // have reached out to T Y U, which is a hand shift halfway through the
  // panel. The numbers stay 1-7 in the same order for the number-pad mirror.
  //
  // The order is the order you'd describe a nest in: where it is, what it's
  // built from, what's in it. Structure comes first because it decides which
  // location list the next question offers.
  toggle_structure: 'q',
  toggle_structure_num: '1',
  pick_location: 'w',
  pick_location_num: '2',
  pick_substrate: 'e',
  pick_substrate_num: '3',
  pick_anthropogenic: 'r',
  pick_anthropogenic_num: '4',
  toggle_bird: 'a',
  toggle_bird_num: '5',
  count_eggs: 's',
  count_eggs_num: '6',
  count_chicks: 'd',
  count_chicks_num: '7',
  zoom: 'z',
  jump: 'g',
  close: 'Escape',
};

export const ACTION_ORDER = Object.keys(DEFAULT_KEYS);

export const ACTION_LABELS = {
  nest_yes: 'Nest = YES  (save + next)',
  nest_no: 'Nest = NO  (save + next)',
  forward: 'Forward  (skip if undecided)',
  back: 'Back  (previous item)',
  notes: 'Edit notes',
  toggle_structure: 'Human-made structure — nest details (letter)',
  toggle_structure_num: 'Human-made structure — nest details (number)',
  pick_location: 'Nest location — nest details (letter)',
  pick_location_num: 'Nest location — nest details (number)',
  pick_substrate: 'Substrate / material — nest details (letter)',
  pick_substrate_num: 'Substrate / material — nest details (number)',
  pick_anthropogenic: 'Anthropogenic material — nest details (letter)',
  pick_anthropogenic_num: 'Anthropogenic material — nest details (number)',
  toggle_bird: 'Bird visible — nest details (letter)',
  toggle_bird_num: 'Bird visible — nest details (number)',
  count_eggs: 'Egg count — nest details (letter)',
  count_eggs_num: 'Egg count — nest details (number)',
  count_chicks: 'Chick count — nest details (letter)',
  count_chicks_num: 'Chick count — nest details (number)',
  zoom: 'Zoom the photo in / out',
  jump: 'Jump to another item',
  // The desktop app quit here. A web page can't close its own tab, so this
  // closes the file and returns to the welcome screen instead.
  close: 'Close file  (everything is already saved)',
};

// Prettier glyphs for the on-screen legend; other keys show their name as-is.
const KEY_GLYPHS = {
  ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓',
  Enter: 'Enter', Escape: 'Esc', ' ': 'Space',
};

/** Legend-friendly label for a key name (arrows become their glyph). */
export const keyDisplay = name => KEY_GLYPHS[name] ?? (name?.length === 1 ? name.toUpperCase() : name);

// localStorage can throw in private modes / with site data blocked; never let
// a settings problem take down labeling.
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(cfg) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('Could not persist settings:', e);
  }
}

// --- hotkeys ----------------------------------------------------------------
/** Merge saved key names over the defaults, ignoring an older keymap scheme. */
export function getKeys() {
  const keys = { ...DEFAULT_KEYS };
  const cfg = load();
  if (cfg.keys_version !== KEYS_VERSION) return keys; // pre-rework config
  for (const [action, name] of Object.entries(cfg.keys ?? {})) {
    if (action in keys && typeof name === 'string' && name) keys[action] = name;
  }
  return keys;
}

export function setKeys(keys) {
  const cfg = load();
  cfg.keys = Object.fromEntries(
    Object.keys(DEFAULT_KEYS).filter(a => a in keys).map(a => [a, keys[a]]));
  cfg.keys_version = KEYS_VERSION;
  save(cfg);
}

/**
 * Look up the action bound to a keyboard event. Letter bindings are matched
 * case-insensitively so Caps Lock doesn't silently break labeling.
 */
export function actionForEvent(event, keys) {
  const pressed = event.key;
  for (const [action, bound] of Object.entries(keys)) {
    if (bound === pressed) return action;
    if (bound.length === 1 && pressed.length === 1
        && bound.toLowerCase() === pressed.toLowerCase()) return action;
  }
  return null;
}

/** Returns [name, actions] for the first key bound to more than one action. */
export function duplicateKey(keys) {
  const seen = new Map();
  for (const [action, name] of Object.entries(keys)) {
    seen.set(name, [...(seen.get(name) ?? []), action]);
  }
  for (const [name, actions] of seen) if (actions.length > 1) return [name, actions];
  return null;
}

// --- reviewer ---------------------------------------------------------------
/**
 * The name stamped into the reviewer column. The desktop app only accepted this
 * as a CLI flag, so in the frozen (double-clicked) app it was always empty —
 * which stops mattering the moment output lands in a shared folder.
 */
export function getReviewer() {
  const v = load().reviewer;
  return typeof v === 'string' ? v : '';
}

export function setReviewer(name) {
  const cfg = load();
  cfg.reviewer = String(name ?? '').trim();
  save(cfg);
}


// --- remembered picker terms -------------------------------------------------
// A term typed into a picker instead of picked off its list is written to the
// spreadsheet verbatim and remembered here, so the second one is a pick rather
// than retyping. Kept per field: what someone types as a nest location has no
// business turning up in the material list.
//
// Deliberately per-browser. A list shared between researchers would have to
// live in the OneDrive folder, and two people writing it at once is a
// different job — meanwhile the column stays honest either way, because the
// file records what was typed, not a reference into some list.
const REMEMBERED_LIMIT = 40;

function rememberedAll() {
  const cfg = load();
  const terms = (cfg.terms && typeof cfg.terms === 'object') ? { ...cfg.terms } : {};
  // Terms remembered before substrate was split into three questions were
  // answers to "what is the nest on?", which is now nest_location. Moved once
  // rather than dropped, so nobody's typed-in terms vanish.
  if (Array.isArray(cfg.substrates) && cfg.substrates.length && !terms.nest_location) {
    terms.nest_location = cfg.substrates;
  }
  return terms;
}

export function getRememberedTerms(field) {
  const v = rememberedAll()[field];
  return Array.isArray(v) ? v.filter(t => typeof t === 'string' && t) : [];
}

/** Replace one field's remembered list outright (Preferences, and the tests). */
export function setRememberedTerms(field, terms) {
  const cfg = load();
  cfg.terms = rememberedAll();
  cfg.terms[field] = (Array.isArray(terms) ? terms : [])
    .map(t => String(t ?? '').trim())
    .filter(Boolean)
    .slice(0, REMEMBERED_LIMIT);
  delete cfg.substrates; // migrated into cfg.terms above
  save(cfg);
}

/** Most recent first, no duplicates, oldest dropped past the limit. */
export function rememberTerm(field, term) {
  const value = String(term ?? '').trim();
  if (!value) return;
  const cfg = load();
  cfg.terms = rememberedAll();
  const kept = getRememberedTerms(field).filter(
    t => t.toLowerCase() !== value.toLowerCase());
  cfg.terms[field] = [value, ...kept].slice(0, REMEMBERED_LIMIT);
  delete cfg.substrates;
  save(cfg);
}
