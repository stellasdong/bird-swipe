// Local folder access via the File System Access API.
//
// This is the module with all the sharp edges, and every one of them is a
// documented behavior rather than a guess:
//
//   * Chromium refuses to hand over ~, Desktop, Documents or Downloads
//     themselves — only their subfolders.
//   * The permission does not travel with a stored handle. Re-granting needs
//     transient user activation, so it must happen inside a click handler.
//   * Managed devices can disable the API outright via enterprise policy
//     (DefaultFileSystemWriteGuardSetting / FileSystemWriteBlockedForUrls).
//   * OneDrive Files-On-Demand can hand back a truncated placeholder stub. The
//     app rewrites whole files, so writing after a short read would replace a
//     good cloud copy with the truncation. See assertReadLooksComplete.

import { labeledName, nestName } from './catalog.js';

const DB_NAME = 'bird-swipe';
const DB_VERSION = 2;
const STORE = 'handles';
const PROGRESS = 'progress';

/** Folder roles. Kept apart so autosave and submit are independent grants. */
export const SUBMIT_DIR = 'submitDir';
export const AUTOSAVE_DIR = 'autosaveDir';

export const isSupported = () =>
  typeof window.showOpenFilePicker === 'function'
  && typeof window.showDirectoryPicker === 'function';

/** Thrown when a read looks truncated; the caller must not write over it. */
export class TruncatedReadError extends Error {}

// --- IndexedDB: remember the folder across reloads ---------------------------
function withStore(storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS);
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => { db.close(); resolve(req?.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

/**
 * Labeling progress, kept in the browser rather than on disk.
 *
 * Researchers download their own exports, so the file usually sits in
 * Downloads — a folder Chromium refuses to hand to a web page. Picking the
 * single file works, but a file handle gives no access to its parent, so there
 * is nowhere on disk to put work-in-progress until the researcher chooses where
 * to submit. Progress therefore lives in IndexedDB, keyed by file name, and only
 * finished work is written out.
 *
 * This exposes writeOutputs() so DebouncedWriter can target it exactly like a
 * Folder.
 */
export const Progress = {
  async writeOutputs(inputName, { labeledText, nestText }) {
    await withStore(PROGRESS, 'readwrite', store => store.put({
      inputName, labeledText, nestText, updatedAt: Date.now(),
    }, inputName));
  },
  load(inputName) {
    return withStore(PROGRESS, 'readonly', store => store.get(inputName));
  },
  async list() {
    const all = await withStore(PROGRESS, 'readonly', store => store.getAll());
    return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  remove(inputName) {
    return withStore(PROGRESS, 'readwrite', store => store.delete(inputName));
  },
};

const rememberHandle = (key, h) => withStore(STORE, 'readwrite', s => s.put(h, key));
const recallHandle = key => withStore(STORE, 'readonly', s => s.get(key));
const forgetHandle = key => withStore(STORE, 'readwrite', s => s.delete(key));

// --- the Files-On-Demand guard ----------------------------------------------
/**
 * Reject a read that looks like a OneDrive placeholder stub rather than the
 * real file. UTF-8 bytes are always >= character count, so a text length far
 * below the reported byte size means we did not get the whole file.
 */
export function assertReadLooksComplete(file, text) {
  if (file.size === 0) return; // genuinely empty, or a file we just created
  if (text.length === 0) {
    throw new TruncatedReadError(
      `${file.name} reports ${file.size} bytes but read as empty. This is usually a ` +
      `OneDrive cloud-only placeholder. Right-click the folder → "Always keep on ` +
      `this device", then reopen. Nothing has been written.`);
  }
  if (text.length * 4 < file.size) {
    throw new TruncatedReadError(
      `${file.name} reports ${file.size} bytes but only ${text.length} characters ` +
      `were read — it looks truncated. Refusing to write, because saving now would ` +
      `overwrite the full copy. Make the folder available offline and reopen.`);
  }
}

// --- the working folder ------------------------------------------------------
export class Folder {
  constructor(handle, key) {
    this.handle = handle;
    this.name = handle.name;
    this.key = key;
  }

  /** Prompt for a folder. Returns null if the user cancelled. */
  static async pick(key = SUBMIT_DIR) {
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite', id: key });
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw describePickerFailure(err);
    }
    await rememberHandle(key, handle).catch(() => {}); // non-fatal
    return new Folder(handle, key);
  }

  /** True when two folder roles point at the same directory. */
  async isSameAs(other) {
    if (!other) return false;
    try {
      return await this.handle.isSameEntry(other.handle);
    } catch {
      return false;
    }
  }

  /**
   * Reopen the previously chosen folder. Returns null when there is none.
   * `interactive` must be true only when called from a user gesture, since
   * requestPermission() needs transient activation.
   */
  static async restore({ key = SUBMIT_DIR, interactive = false } = {}) {
    let handle;
    try {
      handle = await recallHandle(key);
    } catch {
      return null;
    }
    if (!handle) return null;
    const folder = new Folder(handle, key);
    const state = await folder.permission();
    if (state === 'granted') return folder;
    if (!interactive) return { needsPermission: true, folder };
    return (await folder.requestPermission()) ? folder : { needsPermission: true, folder };
  }

  static async forget(key = SUBMIT_DIR) {
    await forgetHandle(key).catch(() => {});
  }

  permission() {
    return this.handle.queryPermission({ mode: 'readwrite' });
  }

  async requestPermission() {
    const state = await this.handle.requestPermission({ mode: 'readwrite' });
    return state === 'granted';
  }

  /**
   * Write the finished files into this folder. Flat, not nested: this is a
   * submission destination, and the `_labeled` / `_nest` suffixes already say
   * which is which to whoever collects them.
   */
  async writeOutputs(inputName, { labeledText, nestText }) {
    await writeFile(this.handle, labeledName(inputName), labeledText);
    await writeFile(this.handle, nestName(inputName), nestText);
    return [labeledName(inputName), nestName(inputName)];
  }

  /** Display path for the confirmation message. */
  outputPath(inputName, which = 'labeled') {
    return `${this.name}/${which === 'nest' ? nestName(inputName) : labeledName(inputName)}`;
  }
}

/**
 * Handles for the exports being worked on, so reopening one is a single
 * permission click rather than hunting through Downloads again. Kept apart from
 * the progress records so the debounced writer can put() without a read-modify-
 * write race.
 */
export const ExportHandles = {
  save(name, handle) {
    return withStore(STORE, 'readwrite', s => s.put(handle, `export:${name}`));
  },
  load(name) {
    return withStore(STORE, 'readonly', s => s.get(`export:${name}`));
  },
  remove(name) {
    return withStore(STORE, 'readwrite', s => s.delete(`export:${name}`));
  },
};

/** Re-grant read access to a stored file handle. Needs a user gesture. */
export async function ensureReadable(handle) {
  if (await handle.queryPermission({ mode: 'read' }) === 'granted') return true;
  return await handle.requestPermission({ mode: 'read' }) === 'granted';
}

/** Read a file's text, refusing a truncated placeholder read. */
export async function readText(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  assertReadLooksComplete(file, text);
  return text;
}

/** Pick a single Macaulay export. Works from Downloads, which a folder pick can't. */
export async function pickExport() {
  try {
    const [handle] = await window.showOpenFilePicker({
      id: 'bird-swipe-export',
      types: [{
        description: 'Macaulay export',
        accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
      }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw describePickerFailure(err);
  }
}

async function writeFile(dirHandle, name, text) {
  const fh = await dirHandle.getFileHandle(name, { create: true });
  // createWritable() stages to a temp file and swaps on close(), so a crash
  // mid-write can't leave a half-written file — same property as the desktop
  // app's temp-file + os.replace.
  const writable = await fh.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => {});
    throw err;
  }
}

function describePickerFailure(err) {
  if (err.name === 'SecurityError') {
    return new Error(
      'The folder picker needs to be opened from a click. Please press the button again.');
  }
  if (err.name === 'NotAllowedError') {
    return new Error(
      "Chrome wouldn't grant access to that folder. Two common causes: you picked your " +
      'home, Desktop, Documents or Downloads folder itself (pick a folder inside one of ' +
      'them instead), or this machine is managed and its policy disables local file ' +
      'access for websites.');
  }
  return err;
}

/**
 * Write to the browser store always, and mirror to a folder when one is set up.
 *
 * The mirror is deliberately best-effort: an unplugged drive or a revoked
 * permission must never stop someone labeling, so a failure there is reported
 * and swallowed rather than propagated. The browser store is the one that has
 * to succeed.
 */
export function mirrorSink(primary, secondary, { onMirrorError = null } = {}) {
  return {
    get mirroring() { return Boolean(secondary); },
    setMirror(folder) { secondary = folder; },
    async writeOutputs(inputName, payload) {
      await primary.writeOutputs(inputName, payload);
      if (!secondary) return;
      try {
        await secondary.writeOutputs(inputName, payload);
      } catch (err) {
        onMirrorError?.(err);
      }
    },
  };
}

// --- debounced writer --------------------------------------------------------
/**
 * Coalesces saves. The desktop app rewrote both output files on every keypress,
 * which is free on local disk but one upload per swipe inside a synced
 * SharePoint folder. Work is still never lost: every pending write is flushed
 * when the tab is hidden or closed.
 */
export class DebouncedWriter {
  constructor(folder, inputName, { delay = 1000, onError = null, onStateChange = null } = {}) {
    this.folder = folder;
    this.inputName = inputName;
    this.delay = delay;
    this.onError = onError;
    this.onStateChange = onStateChange;
    this._timer = null;
    this._pending = null;
    this._inFlight = null;
    this._blocked = false; // a truncated read means never write this session

    this._flushNow = () => { this.flush(); };
    document.addEventListener('visibilitychange', this._onHidden = () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    window.addEventListener('pagehide', this._flushNow);
  }

  /** Stop this writer from ever writing (used after a truncated read). */
  block() {
    this._blocked = true;
    this._pending = null;
    clearTimeout(this._timer);
  }

  get saving() {
    return Boolean(this._pending || this._inFlight);
  }

  /** Queue a save of the catalog's current contents. */
  schedule(catalog) {
    if (this._blocked) return;
    this._pending = {
      labeledText: catalog.labeled.serialize(),
      nestText: catalog.nest.serialize(),
    };
    this.onStateChange?.('pending');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), this.delay);
  }

  /** Write anything pending. Safe to call repeatedly. */
  async flush() {
    clearTimeout(this._timer);
    if (this._blocked || !this._pending) return;
    const payload = this._pending;
    this._pending = null;
    this._inFlight = payload;
    this.onStateChange?.('saving');
    try {
      await this.folder.writeOutputs(this.inputName, payload);
      this._inFlight = null;
      this.onStateChange?.(this._pending ? 'pending' : 'saved');
    } catch (err) {
      this._inFlight = null;
      // Put the work back so the next flush retries it.
      this._pending = this._pending ?? payload;
      this.onStateChange?.('error');
      this.onError?.(err);
    }
  }

  dispose() {
    clearTimeout(this._timer);
    document.removeEventListener('visibilitychange', this._onHidden);
    window.removeEventListener('pagehide', this._flushNow);
  }
}
