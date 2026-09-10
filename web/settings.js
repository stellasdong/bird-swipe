// Persisted user settings: reviewer name + customizable hotkeys.
//
// Port of bird_swipe/config.py, backed by localStorage instead of a JSON file
// in the platform config dir. Keys are stored as KeyboardEvent.key values
// ("ArrowRight", "q") so the stored value is readable and comparable directly
// against an event.

const STORE_KEY = 'bird-swipe:settings';

// Bump when the default hotkey scheme changes shape. Saved bindings from an
// older scheme are ignored (reset to the new defaults) rather than merged, so
// stale keys can't collide with reassigned defaults.
export const KEYS_VERSION = 2;

// action -> default KeyboardEvent.key. The three observation toggles each have
// a letter and a number binding (the number pad mirror), so both are rebindable.
export const DEFAULT_KEYS = {
  nest_yes: 'ArrowRight',
  nest_no: 'ArrowLeft',
  forward: 'ArrowDown',
  back: 'ArrowUp',
  notes: 'Enter',
  toggle_structure: 'q',
  toggle_structure_num: '1',
  toggle_anthropogenic: 'w',
  toggle_anthropogenic_num: '2',
  toggle_eggs: 'e',
  toggle_eggs_num: '3',
  close: 'Escape',
};

export const ACTION_ORDER = Object.keys(DEFAULT_KEYS);

export const ACTION_LABELS = {
  nest_yes: 'Nest = YES  (save + next)',
  nest_no: 'Nest = NO  (save + next)',
  forward: 'Forward  (skip if undecided)',
  back: 'Back  (previous item)',
  notes: 'Edit notes',
  toggle_structure: 'Human-made structure (letter)',
  toggle_structure_num: 'Human-made structure (number)',
  toggle_anthropogenic: 'Anthropogenic material (letter)',
  toggle_anthropogenic_num: 'Anthropogenic material (number)',
  toggle_eggs: 'Eggs present (letter)',
  toggle_eggs_num: 'Eggs present (number)',
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

// --- autosave ---------------------------------------------------------------
/**
 * Whether we've already offered to set up an autosave folder. Offered once on
 * first run; declining is remembered so nobody gets nagged every session.
 */
export const autosaveOffered = () => load().autosave_offered === true;

export function setAutosaveOffered(value = true) {
  const cfg = load();
  cfg.autosave_offered = Boolean(value);
  save(cfg);
}
