// bird-swipe basic: sort a local folder of images into sub-folders.
//
// Deliberately separate from the Macaulay app. No imports, no shared settings,
// no CSV. Each swiped image is moved into one of the folders the user has set
// up (yes and no by default; more can be added). A folder's name is its label
// on screen. Anything already sitting in one of those folders is skipped on
// reopen, so the work resumes for free.
//
// Needs the File System Access API: Chrome or Edge on a Mac or Windows PC.

const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;
const CONFIG_STORE = 'bird-swipe-basic:config';
const BAD_NAME = /[\/\\:*?"<>|\x00-\x1f]/;
const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];
const KEY_NAMES = {
  ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓',
  ' ': 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
};

// A config is { folders: [{ label, key }], undo, skip }. Each folder's label is
// the name of the folder images are moved into, so it must be a valid folder
// name on both Mac and Windows.
export const DEFAULT_CONFIG = {
  folders: [
    { label: 'yes', key: 'ArrowRight' },
    { label: 'no', key: 'ArrowLeft' },
  ],
  undo: 'ArrowUp',
  skip: 'ArrowDown',
};

const clone = c => JSON.parse(JSON.stringify(c));

/** Saved config if it is valid, otherwise the defaults. */
export function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_STORE) || 'null');
    if (saved && validateConfig(saved) === null) return saved;
  } catch {
    // Storage blocked or corrupt: the defaults are fine.
  }
  return clone(DEFAULT_CONFIG);
}

export function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_STORE, JSON.stringify(config));
  } catch {
    // Not saved: the config still applies for this visit.
  }
}

/** A message describing what is wrong with `config`, or null if it is usable. */
export function validateConfig(config) {
  if (!config || !Array.isArray(config.folders)) return 'Something is missing from the setup.';
  if (config.folders.length === 0) return 'Add at least one folder.';
  const labels = config.folders.map(f => (typeof f.label === 'string' ? f.label.trim() : ''));
  for (const label of labels) {
    if (!label) return 'Every folder needs a name.';
    if (BAD_NAME.test(label) || label === '.' || label === '..') {
      return `"${label}" can't be a folder name. Leave out / \\ : * ? " < > |`;
    }
  }
  const lower = labels.map(l => l.toLowerCase());
  const dup = lower.find((l, i) => lower.indexOf(l) !== i);
  if (dup !== undefined) {
    return `Two folders are called "${dup}". Names must differ, ignoring upper and lower case.`;
  }
  const keys = [...config.folders.map(f => f.key), config.undo, config.skip];
  if (keys.some(k => !k)) return 'Every folder, plus Undo and Skip, needs a key.';
  if (new Set(keys).size !== keys.length) return 'Two actions share a key. Each key can do one thing.';
  return null;
}

/**
 * What a key does: { folder: label }, 'undo', 'skip', or null for an unbound key.
 */
export function actionForKey(config, key) {
  const i = config.folders.findIndex(f => f.key === key);
  if (i >= 0) return { folder: config.folders[i].label };
  if (key === config.undo) return 'undo';
  if (key === config.skip) return 'skip';
  return null;
}

/**
 * Name of the action already using `key`, or null. `except` is the slot being
 * set: 'f0', 'f1', … for folders, or 'undo' / 'skip'.
 */
export function keyUsedBy(config, key, except) {
  const hits = [];
  config.folders.forEach((f, i) => {
    if (except !== `f${i}` && f.key === key) hits.push(f.label.trim() || `folder ${i + 1}`);
  });
  if (except !== 'undo' && config.undo === key) hits.push('Undo');
  if (except !== 'skip' && config.skip === key) hits.push('Skip');
  return hits[0] ?? null;
}

/** A short label for a KeyboardEvent.key value, e.g. "→" or "A". */
export function keyName(key) {
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

/** Images still to sort: everything in the folder not already filed under a name. */
export function pendingItems(items, filedNames) {
  return items.filter(i => !filedNames.has(i.name)).sort(byName);
}

// ------------------------------------------------------------- labels CSV

/** The file written into the chosen folder: one row per sorted photo. */
export const CSV_NAME = 'bird-swipe-basic-labels.csv';
export const CSV_COLUMNS = [
  'file', 'label', 'sorted_at', 'taken_at', 'file_modified',
  'latitude', 'longitude', 'camera_make', 'camera_model', 'size_bytes', 'type',
];

export function csvLine(values) {
  return values.map(v => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF. Returns arrays of cells. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** The rows already in the folder's labels CSV, keyed by file name. */
export async function readLabelRows(root) {
  const rows = new Map();
  let text;
  try {
    const file = await (await root.getFileHandle(CSV_NAME)).getFile();
    text = await file.text();
  } catch (e) {
    if (e.name === 'NotFoundError') return rows;
    throw e;
  }
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ''));
  if (!header) return rows;
  for (const cells of body) {
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    if (row.file) rows.set(row.file, row);
  }
  return rows;
}

/** Rewrite the whole labels CSV. A BOM at the front lets Excel read the UTF-8. */
export async function writeLabelRows(root, rows) {
  const lines = [csvLine(CSV_COLUMNS), ...[...rows.values()].map(r => csvLine(CSV_COLUMNS.map(c => r[c])))];
  const out = await root.getFileHandle(CSV_NAME, { create: true });
  const writable = await out.createWritable();
  await writable.write(`﻿${lines.join('\r\n')}\r\n`);
  await writable.close();
}

// ------------------------------------------------------- photo metadata

/** Metadata for one image file, in the columns the labels CSV uses. */
export async function describeFile(file) {
  // EXIF sits at the start of a JPEG, so the first 256 KB is enough to find it.
  const exif = readExif(await file.slice(0, 256 * 1024).arrayBuffer());
  return {
    taken_at: exif.taken ?? '',
    file_modified: new Date(file.lastModified).toISOString(),
    latitude: exif.latitude ?? '',
    longitude: exif.longitude ?? '',
    camera_make: exif.make ?? '',
    camera_model: exif.model ?? '',
    size_bytes: file.size,
    type: file.type || '',
  };
}

/** "2024:05:01 13:22:10" (EXIF) to "2024-05-01T13:22:10". EXIF has no time zone. */
export function exifDate(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s ?? '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}

/**
 * EXIF from the start of a JPEG: taken, make, model, latitude, longitude.
 * Anything missing or unreadable is left out, and other formats give {}.
 */
export function readExif(buf) {
  const out = {};
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return out;
    let p = 2;
    while (p + 4 <= v.byteLength && v.getUint8(p) === 0xff) {
      const marker = v.getUint8(p + 1);
      if (marker === 0xda) break; // start of image data: no EXIF after this
      const len = v.getUint16(p + 2);
      if (marker === 0xe1 && readAscii(v, p + 4, 6) === 'Exif\0\0') {
        parseTiff(v, p + 10, out);
        break;
      }
      p += 2 + len;
    }
  } catch {
    // Truncated or odd EXIF: keep whatever was read before the problem.
  }
  return out;
}

function readAscii(v, off, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(off + i));
  return s;
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function parseTiff(v, base, out) {
  const le = v.getUint16(base) === 0x4949; // "II" = little-endian
  const u16 = o => v.getUint16(base + o, le);
  const u32 = o => v.getUint32(base + o, le);
  // Offsets below are relative to the TIFF header at `base`.
  const entries = off => {
    const map = new Map();
    for (let i = 0, n = u16(off); i < n; i++) {
      const e = off + 2 + i * 12;
      map.set(u16(e), e);
    }
    return map;
  };
  const dataAt = e => (TYPE_SIZE[u16(e + 2)] * u32(e + 4) <= 4 ? e + 8 : u32(e + 8));
  const ascii = e => {
    const count = u32(e + 4);
    const at = dataAt(e);
    let s = '';
    for (let i = 0; i < count; i++) s += String.fromCharCode(v.getUint8(base + at + i));
    return s.replace(/\0+$/, '').trim();
  };
  const rationals = e => {
    const count = u32(e + 4);
    const at = dataAt(e);
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
    }
    return values;
  };
  const coord = (e, ref) => {
    const r = rationals(e);
    if (r.length < 3) return undefined;
    const deg = r[0] + r[1] / 60 + r[2] / 3600;
    return Number((ref === 'S' || ref === 'W' ? -deg : deg).toFixed(6));
  };

  const ifd0 = entries(u32(4));
  if (ifd0.has(0x010f)) out.make = ascii(ifd0.get(0x010f));
  if (ifd0.has(0x0110)) out.model = ascii(ifd0.get(0x0110));

  let dateStr;
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) {
    const sub = entries(u32(exifPtr + 8));
    if (sub.has(0x9003)) dateStr = ascii(sub.get(0x9003)); // DateTimeOriginal
  }
  if (!dateStr && ifd0.has(0x0132)) dateStr = ascii(ifd0.get(0x0132)); // DateTime
  out.taken = exifDate(dateStr);

  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const gps = entries(u32(gpsPtr + 8));
    if (gps.has(2)) {
      const ref = gps.has(1) ? ascii(gps.get(1)) : 'N';
      out.latitude = coord(gps.get(2), ref);
    }
    if (gps.has(4)) {
      const ref = gps.has(3) ? ascii(gps.get(3)) : 'E';
      out.longitude = coord(gps.get(4), ref);
    }
  }
}

function joinWarnings(...parts) {
  return parts.filter(Boolean).join(' ') || null;
}

// ------------------------------------------------------------------- DOM

if (typeof document !== 'undefined') init();

function init() {
  const $ = id => document.getElementById(id);
  const el = {
    welcome: $('welcome'),
    sorter: $('sorter'),
    done: $('done'),
    doneCounts: $('done-counts'),
    folderName: $('folder-name'),
    status: $('status'),
    openFolder: $('open-folder'),
    changeFolder: $('change-folder'),
    keysOpen: $('keys-open'),
    unsupported: $('unsupported'),
    error: $('error'),
    sortError: $('sort-error'),
    photo: $('photo'),
    placeholder: $('placeholder'),
    fileName: $('file-name'),
    actions: $('actions'),
    keys: $('keys'),
    rows: $('keys-rows'),
    addFolder: $('keys-add'),
    keysWarning: $('keys-warning'),
    keysReset: $('keys-reset'),
    keysCancel: $('keys-cancel'),
    keysSave: $('keys-save'),
  };

  const state = {
    config: loadConfig(),
    root: null,      // FileSystemDirectoryHandle the user picked
    queue: [],       // [{ name, handle }] still to sort, in order
    index: 0,        // position in queue
    history: [],     // [{ name, label }] per step; label is null for a skip, so undo just walks back
    counts: {},      // label -> number of images filed in that folder
    rows: new Map(), // file name -> CSV row, mirrors bird-swipe-basic-labels.csv
    busy: false,
    url: null,       // object URL of the photo on screen
    photoToken: 0,   // ignores a photo that finished loading after the user moved on
  };

  let undoBtn = null;
  let skipBtn = null;

  // The Folders & keys dialog works on a draft; nothing changes until Save.
  // Slots: 'f0', 'f1', … for folders, 'undo' and 'skip'.
  let draft = null;
  let capturing = null;

  if (!('showDirectoryPicker' in window)) {
    el.unsupported.hidden = false;
    el.openFolder.disabled = true;
  }

  el.openFolder.addEventListener('click', openFolder);
  el.changeFolder.addEventListener('click', openFolder);

  el.photo.addEventListener('load', () => {
    el.photo.hidden = false;
    el.placeholder.hidden = true;
  });
  el.photo.addEventListener('error', () => {
    el.photo.hidden = true;
    el.placeholder.textContent = "This browser can't show this file. Skip it, or sort it in Finder.";
    el.placeholder.hidden = false;
  });

  el.keysOpen.addEventListener('click', openKeys);
  el.keysCancel.addEventListener('click', () => closeKeys());
  el.keysSave.addEventListener('click', saveFromDialog);
  el.keysReset.addEventListener('click', () => {
    draft = clone(DEFAULT_CONFIG);
    capturing = null;
    el.keysWarning.hidden = true;
    renderRows();
  });
  el.addFolder.addEventListener('click', () => {
    draft.folders.push({ label: '', key: null });
    renderRows();
    const inputs = el.rows.querySelectorAll('.folder-row input');
    inputs[inputs.length - 1]?.focus();
  });
  el.keys.addEventListener('close', () => { capturing = null; });

  window.addEventListener('keydown', onKeydown);

  // ------------------------------------------------------------- folders

  async function openFolder() {
    let root;
    try {
      root = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bird-swipe-basic' });
    } catch (e) {
      if (e.name !== 'AbortError') showError(el.error, `Couldn't open that folder: ${e.message}`);
      return;
    }
    try {
      await start(root);
    } catch (e) {
      showError(el.error, `Couldn't read that folder: ${e.message}`);
    }
  }

  async function start(root) {
    const images = [];
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === 'file' && IMAGE_RE.test(name)) images.push({ name, handle });
    }
    const { filed, counts } = await scanFolders(root, state.config);

    state.root = root;
    state.queue = pendingItems(images, filed);
    state.index = 0;
    state.history = [];
    state.counts = counts;
    state.rows = await readLabelRows(root);
    el.folderName.textContent = root.name;
    el.changeFolder.hidden = false;
    el.keysOpen.hidden = false;
    el.error.hidden = true;
    el.welcome.hidden = true;
    renderActions();
    show();
  }

  /** Names already filed in any configured folder, and how many are in each. */
  async function scanFolders(root, config) {
    const filed = new Set();
    const counts = {};
    for (const { label } of config.folders) {
      counts[label] = 0;
      const sub = await childDir(root, label, false);
      if (!sub) continue;
      for await (const [name, handle] of sub.entries()) {
        if (handle.kind === 'file' && IMAGE_RE.test(name)) {
          filed.add(name);
          counts[label]++;
        }
      }
    }
    return { filed, counts };
  }

  async function childDir(root, name, create) {
    try {
      return await root.getDirectoryHandle(name, { create });
    } catch (e) {
      if (e.name === 'NotFoundError') return null;
      throw e;
    }
  }

  // ------------------------------------------------------------ sorting

  async function act(action) {
    if (state.busy || !state.root) return;
    state.busy = true;
    try {
      const warning = action === 'undo' ? await undo() : await sort(action);
      show();
      if (warning) showError(el.sortError, warning);
      else el.sortError.hidden = true;
    } catch (e) {
      showError(el.sortError, `Nothing was moved: ${e.message}`);
    } finally {
      state.busy = false;
    }
  }

  // `action` is { folder: label } or 'skip'. Returns a warning when the move
  // half-worked, otherwise null.
  async function sort(action) {
    const item = state.queue[state.index];
    if (!item) return null;
    let warning = null;
    let label = null;
    if (action !== 'skip') {
      label = action.folder;
      // Read the metadata before the file moves, while it is still here to read.
      const meta = await describeFile(await item.handle.getFile());
      warning = await moveFile(state.root, item.name, await childDir(state.root, label, true));
      state.counts[label] = (state.counts[label] || 0) + 1;
      state.rows.set(item.name, { file: item.name, label, sorted_at: new Date().toISOString(), ...meta });
      warning = joinWarnings(warning, await saveLabels());
    }
    state.history.push({ name: item.name, label });
    state.index++;
    return warning;
  }

  async function undo() {
    const last = state.history[state.history.length - 1];
    if (!last) return null;
    let warning = null;
    // Only step back once the file is back where it was, so a failed move
    // leaves the history as it was and the next press can try again.
    if (last.label !== null) {
      const dir = await childDir(state.root, last.label, false);
      if (dir) warning = await moveFile(dir, last.name, state.root);
      state.counts[last.label]--;
      state.rows.delete(last.name);
      warning = joinWarnings(warning, await saveLabels());
    }
    state.history.pop();
    state.index--;
    return warning;
  }

  /** Rewrite the labels CSV. The move has already happened, so a failure is a warning. */
  async function saveLabels() {
    try {
      await writeLabelRows(state.root, state.rows);
      return null;
    } catch (e) {
      return `The labels file couldn't be saved (${e.message}). It will be tried again on the next swipe.`;
    }
  }

  /**
   * Move one file between two folders: copy it across, then remove the
   * original. Refuses to overwrite a file already at the destination. If the
   * copy worked but the original can't be removed, the file is still safely
   * filed, so this returns a warning for the reviewer instead of failing.
   */
  async function moveFile(fromDir, name, toDir) {
    if (await fileExists(toDir, name)) {
      throw new Error(`${name} is already in ${toDir.name}/, so it was left alone.`);
    }
    const file = await (await fromDir.getFileHandle(name)).getFile();
    const out = await toDir.getFileHandle(name, { create: true });
    const writable = await out.createWritable();
    await writable.write(file);
    await writable.close();
    try {
      await fromDir.removeEntry(name);
      return null;
    } catch (e) {
      return `${name} is now in ${toDir.name}/, but the original couldn't be removed (${e.message}). Delete it by hand.`;
    }
  }

  async function fileExists(dir, name) {
    try {
      await dir.getFileHandle(name);
      return true;
    } catch (e) {
      if (e.name === 'NotFoundError') return false;
      throw e;
    }
  }

  // ------------------------------------------------------------- display

  /** Rebuild the sort buttons from the config: one per folder, then Undo and Skip. */
  function renderActions() {
    undoBtn = actionButton('Undo', 'undo', state.config.undo);
    skipBtn = actionButton('Skip', 'skip', state.config.skip);
    undoBtn.classList.add('utility');
    skipBtn.classList.add('utility');
    el.actions.replaceChildren(
      ...state.config.folders.map(f => actionButton(f.label, { folder: f.label }, f.key)),
      undoBtn,
      skipBtn,
    );
  }

  function actionButton(text, action, key) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action';
    btn.append(`${text} `);
    const kbd = document.createElement('kbd');
    kbd.textContent = keyName(key);
    btn.append(kbd);
    btn.addEventListener('click', () => {
      btn.blur(); // so Space or Enter can't also press it
      act(action);
    });
    return btn;
  }

  function show() {
    const item = state.queue[state.index];
    el.sorter.hidden = !item;
    el.done.hidden = !!item;
    if (undoBtn) undoBtn.disabled = state.history.length === 0;

    const left = state.queue.length - state.index;
    const filed = state.config.folders.map(f => `${state.counts[f.label] || 0} ${f.label}`);
    el.status.textContent = [`${left} to sort`, ...filed].join(' · ');

    if (!item) {
      el.doneCounts.textContent = `${filed.join(', ')}, all saved in the folder. Labels are in ${CSV_NAME}.`;
      setPhoto(null);
      return;
    }
    el.fileName.textContent = item.name;
    setPhoto(item);
  }

  async function setPhoto(item) {
    const token = ++state.photoToken;
    el.photo.hidden = true;
    el.placeholder.textContent = 'Loading…';
    el.placeholder.hidden = false;
    if (state.url) {
      URL.revokeObjectURL(state.url);
      state.url = null;
    }
    if (!item) return;
    try {
      const file = await item.handle.getFile();
      if (token !== state.photoToken) return;
      state.url = URL.createObjectURL(file);
      el.photo.src = state.url;
    } catch (e) {
      if (token !== state.photoToken) return;
      el.placeholder.textContent = `Couldn't open ${item.name}: ${e.message}`;
    }
  }

  // ---------------------------------------------------------------- keys

  function onKeydown(e) {
    if (el.keys.open) {
      if (capturing) captureKey(e);
      return;
    }
    if (!state.root || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return;
    const action = actionForKey(state.config, e.key);
    if (!action) return;
    e.preventDefault();
    act(action);
  }

  function openKeys() {
    draft = clone(state.config);
    capturing = null;
    el.keysWarning.hidden = true;
    renderRows();
    el.keys.showModal();
  }

  function closeKeys() {
    capturing = null;
    el.keys.close();
  }

  async function saveFromDialog() {
    const config = {
      folders: draft.folders.map(f => ({ label: f.label.trim(), key: f.key })),
      undo: draft.undo,
      skip: draft.skip,
    };
    const problem = validateConfig(config);
    if (problem) {
      showError(el.keysWarning, problem);
      return;
    }
    closeKeys();
    state.config = config;
    saveConfig(config);
    renderActions();
    if (state.root) {
      // Renaming or adding a folder changes what is already filed, so recount.
      try {
        state.counts = (await scanFolders(state.root, config)).counts;
      } catch (e) {
        showError(el.sortError, `Couldn't recount the folders: ${e.message}`);
      }
    }
    show();
  }

  function setKey(slot, key) {
    if (slot.startsWith('f')) draft.folders[Number(slot.slice(1))].key = key;
    else draft[slot] = key;
  }

  function renderRows() {
    const folderRows = draft.folders.map((f, i) => {
      const row = document.createElement('div');
      row.className = 'folder-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = f.label;
      input.placeholder = 'folder name';
      input.setAttribute('aria-label', `Folder ${i + 1} name`);
      input.addEventListener('input', () => { draft.folders[i].label = input.value; });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.title = 'Remove this folder';
      remove.addEventListener('click', () => {
        draft.folders.splice(i, 1);
        capturing = null;
        renderRows();
      });

      row.append(input, keyButton(`f${i}`, f.key), remove);
      return row;
    });

    const fixed = [['Undo', 'undo'], ['Skip', 'skip']].map(([text, slot]) => {
      const row = document.createElement('div');
      row.className = 'fixed-row';
      const name = document.createElement('span');
      name.textContent = text;
      row.append(name, keyButton(slot, draft[slot]));
      return row;
    });

    el.rows.replaceChildren(...folderRows, ...fixed);
  }

  function keyButton(slot, key) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'keybtn';
    btn.textContent = capturing === slot ? 'press a key…' : key ? keyName(key) : 'set key';
    btn.addEventListener('click', () => {
      capturing = slot;
      el.keysWarning.hidden = true;
      renderRows();
    });
    return btn;
  }

  function captureKey(e) {
    e.preventDefault();
    e.stopPropagation();
    if (MODIFIERS.includes(e.key)) return;
    if (e.key === 'Escape') {
      capturing = null;
      renderRows();
      return;
    }
    const clash = keyUsedBy(draft, e.key, capturing);
    if (clash) {
      showError(el.keysWarning, `${keyName(e.key)} is already used by ${clash}. Pick another key.`);
    } else {
      setKey(capturing, e.key);
      el.keysWarning.hidden = true;
    }
    capturing = null;
    renderRows();
  }
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = false;
}
