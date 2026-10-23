// bird-swipe basic: sort a local folder of images into yes/ and no/.
//
// Deliberately separate from the Macaulay app. No imports, no shared settings,
// no CSV. Each swiped image is copied into yes/ or no/ inside the chosen
// folder; the originals are never moved or changed. Anything already sitting in
// yes/ or no/ is skipped on reopen, so the work resumes for free.
//
// Needs the File System Access API: Chrome or Edge on a Mac or Windows PC.

const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

// The four things a key can do. Yes and no sort; undo steps back; skip moves
// on without copying anything.
export const ACTIONS = ['yes', 'no', 'undo', 'skip'];
export const LABELS = { yes: 'Yes', no: 'No', undo: 'Undo', skip: 'Skip' };
export const DEFAULT_KEYS = {
  yes: 'ArrowRight',
  no: 'ArrowLeft',
  undo: 'ArrowUp',
  skip: 'ArrowDown',
};

const KEYS_STORE = 'bird-swipe-basic:keys';
const KEY_NAMES = {
  ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓',
  ' ': 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
};
const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta'];

/** Saved bindings over the defaults. Anything unreadable falls back to defaults. */
export function loadKeys() {
  const keys = { ...DEFAULT_KEYS };
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS_STORE) || '{}');
    for (const a of ACTIONS) {
      if (typeof saved[a] === 'string' && saved[a]) keys[a] = saved[a];
    }
  } catch {
    // Storage blocked or corrupt: the defaults are fine.
  }
  return keys;
}

export function saveKeys(keys) {
  try {
    localStorage.setItem(KEYS_STORE, JSON.stringify(keys));
  } catch {
    // Not saved: the new keys still work for this visit.
  }
}

/** A short label for a KeyboardEvent.key value, e.g. "→" or "A". */
export function keyName(key) {
  if (KEY_NAMES[key]) return KEY_NAMES[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

/** The other action already bound to `key`, or null. */
export function clashWith(keys, action, key) {
  return ACTIONS.find(a => a !== action && keys[a] === key) ?? null;
}

export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

/** Images still to sort: everything in the folder not already filed under a name. */
export function pendingItems(items, filedNames) {
  return items.filter(i => !filedNames.has(i.name)).sort(byName);
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
    btn: Object.fromEntries(ACTIONS.map(a => [a, $(`btn-${a}`)])),
    keys: $('keys'),
    keygrid: $('keygrid'),
    keysWarning: $('keys-warning'),
    keysReset: $('keys-reset'),
    keysCancel: $('keys-cancel'),
    keysSave: $('keys-save'),
  };

  const state = {
    root: null,      // FileSystemDirectoryHandle the user picked
    queue: [],       // [{ name, handle }] still to sort, in order
    index: 0,        // position in queue
    history: [],     // [{ name, choice }], one per step taken, so undo just walks back
    counts: { yes: 0, no: 0 },
    keys: loadKeys(),
    busy: false,
    url: null,       // object URL of the photo on screen
    photoToken: 0,   // ignores a photo that finished loading after the user moved on
  };

  // Draft bindings in the Keys dialog; only committed on Save.
  let draft = null;
  let capturing = null;

  if (!('showDirectoryPicker' in window)) {
    el.unsupported.hidden = false;
    el.openFolder.disabled = true;
  }

  el.openFolder.addEventListener('click', openFolder);
  el.changeFolder.addEventListener('click', openFolder);

  for (const a of ACTIONS) {
    el.btn[a].addEventListener('click', () => {
      el.btn[a].blur(); // so Space or Enter can't also press it
      act(a);
    });
  }

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
  el.keysSave.addEventListener('click', saveKeysFromDialog);
  el.keysReset.addEventListener('click', () => {
    draft = { ...DEFAULT_KEYS };
    capturing = null;
    el.keysWarning.hidden = true;
    renderKeys();
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

    const filed = new Set();
    const counts = { yes: 0, no: 0 };
    for (const dir of ['yes', 'no']) {
      const sub = await childDir(root, dir, false);
      if (!sub) continue;
      for await (const [name, handle] of sub.entries()) {
        if (handle.kind === 'file' && IMAGE_RE.test(name)) {
          filed.add(name);
          counts[dir]++;
        }
      }
    }

    state.root = root;
    state.queue = pendingItems(images, filed);
    state.index = 0;
    state.history = [];
    state.counts = counts;
    el.folderName.textContent = root.name;
    el.changeFolder.hidden = false;
    el.keysOpen.hidden = false;
    el.error.hidden = true;
    el.welcome.hidden = true;
    show();
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
      if (action === 'undo') await undo();
      else await sort(action);
      el.sortError.hidden = true;
      show();
    } catch (e) {
      showError(el.sortError, `Nothing was changed: ${e.message}`);
    } finally {
      state.busy = false;
    }
  }

  async function sort(action) {
    const item = state.queue[state.index];
    if (!item) return;
    if (action !== 'skip') {
      // Copy first, and only then count it: if the write fails the image
      // stays on screen and the next press tries again.
      const dir = await childDir(state.root, action, true);
      const file = await item.handle.getFile();
      const out = await dir.getFileHandle(item.name, { create: true });
      const writable = await out.createWritable();
      await writable.write(file);
      await writable.close();
      state.counts[action]++;
    }
    state.history.push({ name: item.name, choice: action });
    state.index++;
  }

  async function undo() {
    const last = state.history.pop();
    if (!last) return;
    state.index--;
    if (last.choice !== 'skip') {
      const dir = await childDir(state.root, last.choice, false);
      if (dir) await dir.removeEntry(last.name);
      state.counts[last.choice]--;
    }
  }

  function show() {
    const item = state.queue[state.index];
    el.sorter.hidden = !item;
    el.done.hidden = !!item;
    el.btn.undo.disabled = state.history.length === 0;

    for (const a of ACTIONS) {
      el.btn[a].querySelector('kbd').textContent = keyName(state.keys[a]);
    }

    const left = state.queue.length - state.index;
    el.status.textContent = `${left} to sort · ${state.counts.yes} yes · ${state.counts.no} no`;

    if (!item) {
      el.doneCounts.textContent =
        `${state.counts.yes} yes and ${state.counts.no} no, all saved in the folder.`;
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
    const action = ACTIONS.find(a => state.keys[a] === e.key);
    if (!action) return;
    e.preventDefault();
    act(action);
  }

  function openKeys() {
    draft = { ...state.keys };
    capturing = null;
    el.keysWarning.hidden = true;
    renderKeys();
    el.keys.showModal();
  }

  function closeKeys() {
    capturing = null;
    el.keys.close();
  }

  function saveKeysFromDialog() {
    state.keys = { ...draft };
    saveKeys(state.keys);
    closeKeys();
    show();
  }

  function renderKeys() {
    el.keygrid.replaceChildren(...ACTIONS.map(a => {
      const label = document.createElement('span');
      label.textContent = LABELS[a];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'keybtn';
      btn.textContent = capturing === a ? 'press a key…' : keyName(draft[a]);
      btn.addEventListener('click', () => {
        capturing = a;
        el.keysWarning.hidden = true;
        renderKeys();
      });
      return [label, btn];
    }).flat());
  }

  function captureKey(e) {
    e.preventDefault();
    e.stopPropagation();
    if (MODIFIERS.includes(e.key)) return;
    if (e.key === 'Escape') {
      capturing = null;
      renderKeys();
      return;
    }
    const clash = clashWith(draft, capturing, e.key);
    if (clash) {
      showError(el.keysWarning, `${keyName(e.key)} is already ${LABELS[clash].toLowerCase()}. Pick another key.`);
    } else {
      draft[capturing] = e.key;
      el.keysWarning.hidden = true;
    }
    capturing = null;
    renderKeys();
  }
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = false;
}
