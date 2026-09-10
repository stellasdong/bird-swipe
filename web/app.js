// The label loop: hotkey labeling with save-as-you-go and resume.
//
// Port of bird_swipe/ui/main_window.py. The Qt version needed a thread pool, a
// per-photo worker thread, stale-result guards and manual rescaling; <img> and
// <video> provide all of that natively, so what is left here is the label loop
// itself.

import {
  Catalog, CATALOG_KEY, REVIEWED, SKIPPED, ValidationError, labeledName, nestName,
} from './catalog.js';
import { assetPageUrl, photoUrl, videoUrl } from './macaulay.js';
import {
  DebouncedWriter, ExportHandles, Folder, Progress, TruncatedReadError,
  ensureReadable, isSupported, pickExport, readText,
} from './storage.js';
import {
  ACTION_LABELS, ACTION_ORDER, DEFAULT_KEYS, actionForEvent, duplicateKey,
  getKeys, getReviewer, keyDisplay, setKeys, setReviewer,
} from './settings.js';

export const VERSION = '3.0.0';
const BUILD = '__BUILD__'; // replaced with the short git SHA at deploy time

const $ = id => document.getElementById(id);

const el = {
  screens: {
    welcome: $('screen-welcome'), label: $('screen-label'), done: $('screen-done'),
  },
  unsupported: $('unsupported'),
  welcomeBody: $('welcome-body'),
  welcomeError: $('welcome-error'),
  reviewer: $('reviewer'),
  openExport: $('open-export'),
  prefsWelcome: $('prefs-welcome'),
  folderInfo: $('folder-info'),
  resumeBlock: $('resume-block'),
  fileList: $('file-list'),
  version: $('version'),

  rowTitle: $('row-title'),
  progress: $('progress'),
  saveState: $('save-state'),
  nestChip: $('nest-chip'),
  toggles: {
    structure: $('t-structure'),
    anthropogenic: $('t-anthropogenic'),
    eggs: $('t-eggs'),
  },
  media: $('media'),
  mediaPlaceholder: $('media-placeholder'),
  photo: $('photo'),
  video: $('video'),
  meta: $('meta'),
  notes: $('notes'),
  notesLabel: $('notes-label'),
  legend: $('legend'),

  doneTitle: $('done-title'),
  doneCounts: $('done-counts'),
  doneObservations: $('done-observations'),
  doneSkipped: $('done-skipped'),
  reviewSkipped: $('review-skipped'),
  submit: $('submit'),
  downloadCopy: $('download-copy'),
  submitResult: $('submit-result'),
  donePaths: $('done-paths'),
  doneHint: $('done-hint'),
  doneOpenAnother: $('done-open-another'),

  prefs: $('prefs'),
  keygrid: $('keygrid'),
  prefsWarning: $('prefs-warning'),
  prefsReset: $('prefs-reset'),
  prefsCancel: $('prefs-cancel'),
  prefsSave: $('prefs-save'),
};

const TOGGLE_FIELDS = { structure: 'human_structure', anthropogenic: 'anthropogenic', eggs: 'eggs' };
const TOGGLE_LABELS = {
  structure: 'human-made structure',
  anthropogenic: 'anthropogenic material',
  eggs: 'eggs present',
};
// Both the letter and number binding of a toggle map to the same field.
const TOGGLE_ACTIONS = {
  toggle_structure: 'structure', toggle_structure_num: 'structure',
  toggle_anthropogenic: 'anthropogenic', toggle_anthropogenic_num: 'anthropogenic',
  toggle_eggs: 'eggs', toggle_eggs_num: 'eggs',
};

const state = {
  sink: Progress,   // where in-progress work is kept (swapped in dev mode)
  catalog: null,
  inputName: null,
  writer: null,
  idx: 0,
  reviewingSkipped: false, // walking only skipped items from the done screen
  reviewHistory: [],       // breadcrumb of visited items in that pass
  keys: getKeys(),
  currentId: null,
};

// ------------------------------------------------------------------ screens
function show(name) {
  for (const [key, node] of Object.entries(el.screens)) node.hidden = key !== name;
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = false;
}

// ------------------------------------------------------------------ dev mode
/**
 * `?dev=../test/export.csv` loads an export over HTTP and keeps progress in
 * memory, so the label loop can be driven without the native file picker. This
 * mirrors the desktop app's habit of opening a bundled test/ file when run with
 * no arguments (bird_swipe/app.py:_default_input).
 */
const memorySink = {
  outputs: { labeledText: null, nestText: null },
  writeCount: 0,
  async writeOutputs(inputName, payload) {
    this.outputs = { ...payload };
    this.writeCount += 1;
    window.__devOutputs = this.outputs; // inspectable from the console
    console.log(`[dev] write #${this.writeCount} for ${inputName}`);
  },
};

async function startDevMode(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const text = await response.text();
  const name = url.split('/').pop();
  state.sink = memorySink;
  el.folderInfo.textContent =
    `Dev mode: ${name} loaded over HTTP. Progress is kept in memory only.`;
  el.folderInfo.hidden = false;
  // A stand-in for a FileSystemFileHandle: readText() only needs getFile().
  await beginLabeling({ name, getFile: async () => new File([text], name) }, name);
}

// ------------------------------------------------------------------ welcome
async function initWelcome() {
  el.version.textContent = BUILD.startsWith('__') ? VERSION : `${VERSION} (${BUILD})`;
  el.reviewer.value = getReviewer();
  el.reviewer.addEventListener('change', () => setReviewer(el.reviewer.value));

  const devFile = new URLSearchParams(location.search).get('dev');
  if (devFile) {
    try {
      await startDevMode(devFile);
    } catch (err) {
      showError(el.welcomeError, `Dev mode failed: ${err.message}`);
    }
    return;
  }

  if (!isSupported()) {
    el.unsupported.hidden = false;
    el.welcomeBody.hidden = true;
    return;
  }
  await refreshResumeList();
}

el.openExport.addEventListener('click', async () => {
  el.welcomeError.hidden = true;
  try {
    const handle = await pickExport();
    if (!handle) return;
    await ExportHandles.save(handle.name, handle).catch(() => {}); // non-fatal
    await beginLabeling(handle, handle.name);
  } catch (err) {
    showError(el.welcomeError, err.message);
  }
});

/** Spreadsheets with unfinished work saved in this browser. */
async function refreshResumeList() {
  let entries = [];
  try {
    entries = await Progress.list();
  } catch { /* private mode, blocked storage — just offer the picker */ }
  el.resumeBlock.hidden = entries.length === 0;
  el.fileList.textContent = '';
  for (const entry of entries) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const name = document.createElement('span');
    name.textContent = entry.inputName;
    const meta = document.createElement('span');
    meta.className = 'meta';
    const rows = Math.max(0, entry.labeledText.split('\r\n').length - 2);
    meta.textContent = `${rows} labeled · ${relativeTime(entry.updatedAt)}`;
    button.append(name, meta);
    button.addEventListener('click', () => resumeEntry(entry));
    li.append(button);
    el.fileList.append(li);
  }
}

function relativeTime(ms) {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Reopen a spreadsheet we have progress for, re-granting read access. */
async function resumeEntry(entry) {
  el.welcomeError.hidden = true;
  try {
    const handle = await ExportHandles.load(entry.inputName);
    if (handle && await ensureReadable(handle)) {
      await beginLabeling(handle, entry.inputName);
      return;
    }
    // The handle is gone or access was refused — ask for the file again. The
    // saved labels are keyed by name, so they still apply.
    const picked = await pickExport();
    if (!picked) return;
    if (picked.name !== entry.inputName) {
      showError(el.welcomeError,
        `That's ${picked.name}, but the saved progress is for ${entry.inputName}. ` +
        `Pick that file to carry on, or label this one from the start.`);
      return;
    }
    await ExportHandles.save(picked.name, picked).catch(() => {});
    await beginLabeling(picked, entry.inputName);
  } catch (err) {
    showError(el.welcomeError, err.message);
  }
}

// --------------------------------------------------------------- open a file
async function beginLabeling(fileHandle, inputName) {
  setReviewer(el.reviewer.value);

  let inputText, saved;
  try {
    inputText = await readText(fileHandle);
    saved = await Progress.load(inputName).catch(() => null);
  } catch (err) {
    // A truncated read is the Files-On-Demand hazard: never build on it.
    showError(el.welcomeError, err instanceof TruncatedReadError
      ? err.message
      : `Couldn't open ${inputName}: ${err.message}`);
    return;
  }

  let catalog;
  try {
    ({ catalog } = Catalog.open(inputName, inputText, {
      labeledText: saved?.labeledText ?? null,
      nestText: saved?.nestText ?? null,
    }));
  } catch (err) {
    showError(el.welcomeError, err instanceof ValidationError
      ? `${inputName} doesn't look like a Macaulay export.\n${err.message}`
      : err.message);
    return;
  }

  state.catalog = catalog;
  state.inputName = inputName;
  state.idx = catalog.firstUnreviewed();
  state.reviewingSkipped = false;
  state.reviewHistory = [];
  state.writer?.dispose();
  state.writer = new DebouncedWriter(state.sink, inputName, {
    onError: err => setSaveState('error', err.message),
    onStateChange: setSaveState,
  });

  const others = catalog.otherReviewers(getReviewer());
  if (others.length) {
    alertBanner(`Heads up: this file already has labels from ${others.join(', ')}. ` +
                `Two people labeling one spreadsheet will overwrite each other.`);
  }
  showCurrent();
}

let bannerTimer = null;
function alertBanner(message) {
  el.notesLabel.textContent = message;
  el.notesLabel.style.color = '#fcd34d';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(resetNotesLabel, 12000);
}
function resetNotesLabel() {
  el.notesLabel.textContent = `Notes  (click to edit · ${keyDisplay(state.keys.notes)} to return)`;
  el.notesLabel.style.color = '';
}

function setSaveState(kind, detail) {
  const text = { pending: 'unsaved…', saving: 'saving…', saved: 'saved', error: 'save failed' };
  el.saveState.textContent = text[kind] ?? '';
  el.saveState.className = `save-state ${kind}`;
  el.saveState.title = detail ?? '';
}

// ---------------------------------------------------------------- rendering
function showCurrent() {
  const { catalog } = state;
  if (!catalog) { show('welcome'); return; }
  if (state.idx >= catalog.rows.length) { showDone(); return; }

  show('label');
  const row = catalog.rows[state.idx];
  const mlId = row[CATALOG_KEY];
  const total = catalog.rows.length;
  const stats = catalog.stats();

  el.rowTitle.textContent = `${row['Common Name'] ?? ''} · ${row['Scientific Name'] ?? ''}`;
  el.progress.textContent =
    `[${state.idx + 1} / ${total}]   reviewed ${stats.reviewed}` +
    (state.reviewingSkipped ? '   ·   reviewing skipped' : '');
  document.title = `bird-swipe · [${state.idx + 1}/${total}] · ML ${mlId}`;

  showAsset(mlId, row.Format ?? '');
  renderMeta(row);
  el.notes.value = row.notes ?? '';
  for (const [field, column] of Object.entries(TOGGLE_FIELDS)) {
    setToggle(field, row[column] === 'yes');
  }
  updateChip(row);
  prefetchUpcoming();
  resetNotesLabel();
  renderLegend();
}

function setToggle(field, on) {
  const node = el.toggles[field];
  node.setAttribute('aria-pressed', String(on));
}
const toggleOn = field => el.toggles[field].getAttribute('aria-pressed') === 'true';

function renderToggleLabels() {
  for (const field of Object.keys(TOGGLE_FIELDS)) {
    const letter = keyDisplay(state.keys[`toggle_${field}`]);
    const number = keyDisplay(state.keys[`toggle_${field}_num`]);
    el.toggles[field].textContent = '';
    el.toggles[field].append(
      TOGGLE_LABELS[field] + '  ',
      Object.assign(document.createElement('span'),
        { className: 'key', textContent: `(${letter}/${number})` }));
  }
}

function updateChip(row) {
  const label = row.nest_label ?? '';
  const map = {
    yes: ['nest: YES ✓', 'yes'],
    no: ['nest: NO ✗', 'no'],
    [SKIPPED]: ['nest: SKIPPED', 'skip'],
  };
  const [text, cls] = map[label] ?? ['nest: — (unlabeled)', ''];
  el.nestChip.textContent = text;
  el.nestChip.className = `chip ${cls}`.trim();
}

function renderMeta(row) {
  const mlId = row[CATALOG_KEY];
  el.meta.textContent = '';
  const head = document.createElement('div');
  const strong = document.createElement('b');
  strong.textContent = `ML ${mlId}`;
  const link = document.createElement('a');
  link.href = assetPageUrl(mlId);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = assetPageUrl(mlId);
  head.append(strong, ' · ', link);
  el.meta.append(head);

  const inline = document.createElement('div');
  for (const key of ['Format', 'Caption', 'Behaviors', 'Date', 'Locality', 'Asset Tags']) {
    if (!row[key]) continue;
    const b = document.createElement('b');
    b.textContent = `${key}: `;
    inline.append(b, `${row[key]}   `);
  }
  if (inline.childNodes.length) el.meta.append(inline);

  for (const key of ['Observation Details', 'Media notes']) { // each on its own line
    if (!row[key]) continue;
    const line = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${key}: `;
    line.append(b, row[key]);
    el.meta.append(line);
  }
}

function renderLegend() {
  const k = state.keys;
  const parts = [
    [keyDisplay(k.nest_yes), 'YES'], [keyDisplay(k.nest_no), 'NO'],
    [keyDisplay(k.forward), 'next'], [keyDisplay(k.back), 'back'],
    [keyDisplay(k.notes), 'notes'],
    [`${keyDisplay(k.toggle_structure)}/${keyDisplay(k.toggle_structure_num)}`, 'structure'],
    [`${keyDisplay(k.toggle_anthropogenic)}/${keyDisplay(k.toggle_anthropogenic_num)}`, 'anthro'],
    [`${keyDisplay(k.toggle_eggs)}/${keyDisplay(k.toggle_eggs_num)}`, 'eggs'],
    [keyDisplay(k.close), 'close file'],
  ];
  el.legend.textContent = '';
  for (const [key, label] of parts) {
    const span = document.createElement('span');
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    span.append(kbd, ' ' + label);
    el.legend.append(span);
  }
  if (state.catalog?.rows[state.idx]?.Format === 'Video') {
    const span = document.createElement('span');
    span.textContent = '· click video to play/pause';
    el.legend.append(span);
  }
}

// -------------------------------------------------------------------- media
function showAsset(mlId, format) {
  state.currentId = mlId;
  stopVideo();
  if (format === 'Video') {
    stopPhoto();
    el.mediaPlaceholder.hidden = false;
    el.mediaPlaceholder.textContent = `Loading video ${mlId}…`;
    el.video.hidden = false;
    el.video.src = videoUrl(mlId);
    el.video.play().catch(() => {}); // autoplay may be refused; the click still works
    return;
  }
  el.video.hidden = true;
  el.photo.hidden = true;
  el.mediaPlaceholder.hidden = false;
  el.mediaPlaceholder.textContent = `Loading ${mlId}…`;
  el.photo.src = photoUrl(mlId);
}

/**
 * True when an <img> event belongs to the asset still on screen. Swiping fast
 * abandons in-flight loads, and a late event from one of those would otherwise
 * paint the previous bird over the current one — the same stale-result guard
 * the Qt version needed (media_view.py:120).
 */
const photoIsCurrent = () =>
  state.currentId !== null && el.photo.getAttribute('src') === photoUrl(state.currentId);

function stopPhoto() {
  el.photo.hidden = true;
  el.photo.removeAttribute('src'); // cancels the in-flight request
}

el.photo.addEventListener('load', () => {
  if (!photoIsCurrent()) return;
  el.mediaPlaceholder.hidden = true;
  el.photo.hidden = false;
});
el.photo.addEventListener('error', () => {
  if (!photoIsCurrent()) return; // an aborted load is not a failure
  el.photo.hidden = true;
  el.mediaPlaceholder.hidden = false;
  el.mediaPlaceholder.textContent = `Couldn't load ML ${state.currentId}. Check your connection.`;
});
el.video.addEventListener('loadeddata', () => { el.mediaPlaceholder.hidden = true; });
el.video.addEventListener('click', () => {
  if (el.video.paused) el.video.play().catch(() => {}); else el.video.pause();
});
el.video.addEventListener('error', () => {
  el.video.hidden = true;
  el.mediaPlaceholder.hidden = false;
  el.mediaPlaceholder.textContent = `Couldn't play video ML ${state.currentId}.`;
});

function stopVideo() {
  if (!el.video.src) return;
  el.video.pause();
  el.video.removeAttribute('src'); // drop the stream so rapid swiping doesn't buffer
  el.video.load();
}

const prefetched = new Set();
function prefetchUpcoming(n = 3) {
  const { catalog } = state;
  let found = 0;
  for (let i = state.idx + 1; i < catalog.rows.length && found < n; i++) {
    const row = catalog.rows[i];
    if (row.Format === 'Video') continue; // only photos are prefetchable
    const id = row[CATALOG_KEY];
    found++;
    if (prefetched.has(id)) continue;
    prefetched.add(id);
    new Image().src = photoUrl(id); // warms the browser's HTTP cache
  }
}

// ----------------------------------------------------------------- labeling
function commit(nest) {
  state.catalog.setLabel(state.idx, {
    nest,
    structure: toggleOn('structure'),
    anthropogenic: toggleOn('anthropogenic'),
    eggs: toggleOn('eggs'),
    reviewer: getReviewer(),
    notes: el.notes.value.trim(),
  });
  state.writer.schedule(state.catalog);
  advance();
}

/** Advance one item. An undecided item is recorded as a skip on the way out. */
function forward() {
  if (!state.catalog.isReviewed(state.idx)) {
    state.catalog.setSkip(state.idx, {
      reviewer: getReviewer(),
      notes: el.notes.value.trim(),
    });
    state.writer.schedule(state.catalog);
  }
  advance();
}

function advance() {
  if (state.reviewingSkipped) {
    const next = state.catalog.nextSkippedAfter(state.idx);
    if (next === null) { // no skips left -> back to the done screen
      state.reviewingSkipped = false;
      state.reviewHistory = [];
      state.idx = state.catalog.rows.length;
    } else {
      state.reviewHistory.push(next);
      state.idx = next;
    }
  } else {
    state.idx += 1;
  }
  showCurrent();
}

function goBack() {
  if (state.reviewingSkipped) {
    // Walk back through items visited this pass — even ones since labeled (so
    // no longer "skip") — via a breadcrumb stack.
    if (state.reviewHistory.length <= 1) return;
    state.reviewHistory.pop();
    state.idx = state.reviewHistory.at(-1);
  } else {
    if (state.idx <= 0) return;
    state.idx -= 1;
  }
  showCurrent();
}

function startReviewSkipped() {
  const skipped = state.catalog.skippedIndices();
  if (!skipped.length) return;
  state.reviewingSkipped = true;
  state.reviewHistory = [skipped[0]];
  state.idx = skipped[0];
  showCurrent();
}

async function closeFile() {
  await state.writer?.flush();
  state.writer?.dispose();
  state.writer = null;
  state.catalog = null;
  state.inputName = null;
  stopVideo();
  document.title = 'bird-swipe';
  show('welcome');
  await refreshResumeList();
}

// -------------------------------------------------------------------- done
function showDone() {
  state.reviewingSkipped = false;
  stopVideo();
  show('done');
  document.title = 'bird-swipe · done';
  const s = state.catalog.stats();
  el.doneTitle.textContent = `All ${s.total} assets reviewed 🎉`;
  el.doneCounts.textContent =
    `nest yes: ${s.yes}   ·   nest no: ${s.no}   ·   skipped: ${s.skipped}`;
  el.doneObservations.textContent =
    `human-made structure: ${s.structure}   ·   anthropogenic: ${s.anthropogenic}` +
    `   ·   eggs: ${s.eggs}`;

  el.doneSkipped.textContent = s.skipped
    ? `${s.skipped} skipped — use the button below to review them.` : '';
  el.reviewSkipped.hidden = !s.skipped;
  el.reviewSkipped.textContent =
    `Review ${s.skipped} skipped item${s.skipped === 1 ? '' : 's'}`;

  el.donePaths.textContent =
    `${state.catalog.labeled.count()} completed entries · ${state.catalog.nest.count()} nests`;
  el.doneHint.textContent =
    `Press ${keyDisplay(state.keys.back)} to revisit the last item, ` +
    `or ${keyDisplay(state.keys.close)} to close this file.`;
  el.submitResult.hidden = true;
  el.submit.disabled = false;
  state.writer?.flush();
}

// ------------------------------------------------------------------- submit
/**
 * Copy the finished files into the designated SharePoint folder. Work in
 * progress never goes there — only a deliberate submit does — so the folder
 * holds completed evaluations and nothing half-done.
 */
async function submitToSharePoint() {
  el.submitResult.hidden = true;
  el.submit.disabled = true;
  try {
    await state.writer?.flush();

    // Reuse the folder if it's still granted; otherwise ask. Both paths are
    // inside this click, which is the user gesture requestPermission needs.
    let folder = await Folder.restore({ interactive: true }).catch(() => null);
    if (!(folder instanceof Folder)) folder = await Folder.pick();
    if (!folder) { el.submit.disabled = false; return; } // cancelled

    const written = await folder.writeOutputs(state.inputName, {
      labeledText: state.catalog.labeled.serialize(),
      nestText: state.catalog.nest.serialize(),
    });
    showResult('info',
      `Sent to ${folder.name}: ${written.join(' and ')}. ` +
      `OneDrive will sync it up to SharePoint shortly.`);
  } catch (err) {
    showResult('error', `Couldn't send: ${err.message}`);
  } finally {
    el.submit.disabled = false;
  }
}

function showResult(kind, message) {
  el.submitResult.className = `notice ${kind}`;
  el.submitResult.textContent = message;
  el.submitResult.hidden = false;
}

/** Escape hatch: save the finished files without granting any folder access. */
function downloadCopy() {
  const files = [
    [labeledName(state.inputName), state.catalog.labeled.serialize()],
    [nestName(state.inputName), state.catalog.nest.serialize()],
  ];
  for (const [name, text] of files) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  showResult('info', `Downloaded ${files.map(f => f[0]).join(' and ')}.`);
}

el.submit.addEventListener('click', submitToSharePoint);
el.downloadCopy.addEventListener('click', downloadCopy);
el.reviewSkipped.addEventListener('click', startReviewSkipped);
el.doneOpenAnother.addEventListener('click', closeFile);

// -------------------------------------------------------------------- input
for (const [field, node] of Object.entries(el.toggles)) {
  node.addEventListener('click', () => {
    setToggle(field, !toggleOn(field));
    node.blur(); // keep arrow keys with the label loop
  });
}

el.notes.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { // Enter -> back to the loop
    event.preventDefault();
    el.notes.blur();
  } else if (event.key === 'Escape') { // never let Esc bubble up and close the file
    event.preventDefault();
    el.notes.blur();
  }
  event.stopPropagation();
});

document.addEventListener('keydown', event => {
  if (el.prefs.open) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  const action = actionForEvent(event, state.keys);
  if (!action) return;

  if (action === 'close') {
    event.preventDefault();
    if (state.catalog) closeFile();
    return;
  }
  if (!state.catalog) return;

  if (action === 'back') { event.preventDefault(); goBack(); return; }
  if (state.idx >= state.catalog.rows.length) return; // on the done screen

  event.preventDefault();
  if (action in TOGGLE_ACTIONS) {
    const field = TOGGLE_ACTIONS[action];
    setToggle(field, !toggleOn(field));
  } else if (action === 'notes') {
    el.notes.focus();
  } else if (action === 'forward') {
    forward();
  } else if (action === 'nest_yes') {
    commit(true);
  } else if (action === 'nest_no') {
    commit(false);
  }
});

// Last line of defence: the writer flushes on pagehide, but warn if a save is
// genuinely still outstanding.
window.addEventListener('beforeunload', event => {
  if (state.writer?.saving) {
    event.preventDefault();
    event.returnValue = '';
  }
});

// -------------------------------------------------------------- preferences
let draftKeys = null;
let capturing = null;

function openPrefs() {
  draftKeys = { ...state.keys };
  el.prefsWarning.hidden = true;
  renderKeygrid();
  el.prefs.showModal();
}

function renderKeygrid() {
  el.keygrid.textContent = '';
  for (const action of ACTION_ORDER) {
    const label = document.createElement('label');
    label.textContent = ACTION_LABELS[action];
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = keyDisplay(draftKeys[action]);
    button.addEventListener('click', () => {
      if (capturing) capturing.button.textContent = keyDisplay(draftKeys[capturing.action]);
      capturing = { action, button };
      button.textContent = 'press a key…';
      button.classList.add('capturing');
      button.focus();
    });
    el.keygrid.append(label, button);
  }
}

el.prefs.addEventListener('keydown', event => {
  if (!capturing) return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key !== 'Escape') draftKeys[capturing.action] = event.key;
  capturing.button.textContent = keyDisplay(draftKeys[capturing.action]);
  capturing.button.classList.remove('capturing');
  capturing = null;
});

el.prefsReset.addEventListener('click', () => {
  draftKeys = { ...DEFAULT_KEYS };
  capturing = null;
  el.prefsWarning.hidden = true;
  renderKeygrid();
});

el.prefsCancel.addEventListener('click', () => { capturing = null; el.prefs.close(); });

el.prefsSave.addEventListener('click', () => {
  const dup = duplicateKey(draftKeys);
  if (dup) {
    const [name, actions] = dup;
    showError(el.prefsWarning,
      `"${keyDisplay(name)}" is bound to multiple actions: ` +
      `${actions.map(a => ACTION_LABELS[a]).join(', ')}. Give each action a distinct key.`);
    return;
  }
  setKeys(draftKeys);
  state.keys = getKeys();
  capturing = null;
  el.prefs.close();
  renderToggleLabels();
  if (state.catalog) showCurrent();
});

el.prefsWelcome.addEventListener('click', openPrefs);

// --------------------------------------------------------------------- boot
renderToggleLabels();
initWelcome();
