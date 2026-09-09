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

import { LABELED_DIRNAME, NEST_DIRNAME, labeledName, nestName } from './catalog.js';

const DB_NAME = 'bird-swipe';
const STORE = 'handles';
const HANDLE_KEY = 'workingDir';

export const isSupported = () => typeof window.showDirectoryPicker === 'function';

/** Thrown when a read looks truncated; the caller must not write over it. */
export class TruncatedReadError extends Error {}

// --- IndexedDB: remember the folder across reloads ---------------------------
function withStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req?.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

const rememberHandle = h => withStore('readwrite', s => s.put(h, HANDLE_KEY));
const recallHandle = () => withStore('readonly', s => s.get(HANDLE_KEY));
const forgetHandle = () => withStore('readwrite', s => s.delete(HANDLE_KEY));

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
  constructor(handle) {
    this.handle = handle;
    this.name = handle.name;
  }

  /** Prompt for a folder. Returns null if the user cancelled. */
  static async pick() {
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bird-swipe' });
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw describePickerFailure(err);
    }
    await rememberHandle(handle).catch(() => {}); // non-fatal
    return new Folder(handle);
  }

  /**
   * Reopen the previously chosen folder. Returns null when there is none.
   * `interactive` must be true only when called from a user gesture, since
   * requestPermission() needs transient activation.
   */
  static async restore({ interactive = false } = {}) {
    let handle;
    try {
      handle = await recallHandle();
    } catch {
      return null;
    }
    if (!handle) return null;
    const folder = new Folder(handle);
    const state = await folder.permission();
    if (state === 'granted') return folder;
    if (!interactive) return { needsPermission: true, folder };
    return (await folder.requestPermission()) ? folder : { needsPermission: true, folder };
  }

  static async forget() {
    await forgetHandle().catch(() => {});
  }

  permission() {
    return this.handle.queryPermission({ mode: 'readwrite' });
  }

  async requestPermission() {
    const state = await this.handle.requestPermission({ mode: 'readwrite' });
    return state === 'granted';
  }

  /** Spreadsheets sitting directly in the folder, newest name order. */
  async listExports() {
    const found = [];
    for await (const [name, handle] of this.handle.entries()) {
      if (handle.kind !== 'file') continue;
      if (!/\.(csv|xlsx|xlsm)$/i.test(name)) continue;
      if (/_labeled\.|_nest\./i.test(name)) continue; // our own output
      const file = await handle.getFile();
      found.push({ name, handle, size: file.size, lastModified: file.lastModified });
    }
    found.sort((a, b) => a.name.localeCompare(b.name));
    return found;
  }

  /** Read a file's text, refusing a truncated placeholder read. */
  async readText(fileHandle) {
    const file = await fileHandle.getFile();
    const text = await file.text();
    assertReadLooksComplete(file, text);
    return text;
  }

  async _outputDir(create) {
    const labeled = await this.handle.getDirectoryHandle(LABELED_DIRNAME, { create });
    const nest = await labeled.getDirectoryHandle(NEST_DIRNAME, { create });
    return { labeled, nest };
  }

  /**
   * Existing output for an export, or null for each file that isn't there yet.
   * A truncated read propagates — the caller must not start labeling over it.
   */
  async readOutputs(inputName) {
    const readIfPresent = async (dir, name) => {
      try {
        const fh = await dir.getFileHandle(name);
        return await this.readText(fh);
      } catch (err) {
        if (err.name === 'NotFoundError') return null;
        throw err;
      }
    };
    let dirs;
    try {
      dirs = await this._outputDir(false);
    } catch (err) {
      if (err.name === 'NotFoundError') return { labeledText: null, nestText: null };
      throw err;
    }
    return {
      labeledText: await readIfPresent(dirs.labeled, labeledName(inputName)),
      nestText: await readIfPresent(dirs.nest, nestName(inputName)),
    };
  }

  /** Write both output files. Creates labeled/ and labeled/nest/ as needed. */
  async writeOutputs(inputName, { labeledText, nestText }) {
    const { labeled, nest } = await this._outputDir(true);
    await writeFile(labeled, labeledName(inputName), labeledText);
    await writeFile(nest, nestName(inputName), nestText);
  }

  /** Display path for the done screen. */
  outputPath(inputName, which = 'labeled') {
    return which === 'nest'
      ? `${this.name}/${LABELED_DIRNAME}/${NEST_DIRNAME}/${nestName(inputName)}`
      : `${this.name}/${LABELED_DIRNAME}/${labeledName(inputName)}`;
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
