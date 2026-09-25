// The label loop: hotkey labeling with save-as-you-go and resume.
//
// Port of bird_swipe/ui/main_window.py. The Qt version needed a thread pool, a
// per-photo worker thread, stale-result guards and manual rescaling; <img> and
// <video> provide all of that natively, so what is left here is the label loop
// itself.

import {
  Catalog, CATALOG_KEY, REVIEWED, SKIPPED, ValidationError, labeledName, nestName,
  normalizeCount, filterTerms, joinTerms, splitTerms,
  SUBSTRATE_OPTIONS, ANTHROPOGENIC_OPTIONS, locationOptions, isListedLocation,
  CHICK_STAGES, PREY_OPTIONS,
} from './catalog.js';
import {
  PHOTO_SIZE_DEFAULT, PHOTO_SIZE_HIGH, assetPageUrl, checklistUrl, photoUrl,
  videoUrl,
} from './macaulay.js';
import {
  canTranslate, languageName, NeedsGestureError, Translators,
} from './translate.js';
import {
  AUTOSAVE_DIR, DebouncedWriter, ExportHandles, Folder, Progress,
  TruncatedReadError, ensureReadable, isSupported, mirrorSink, pickExport, readText,
} from './storage.js';
import {
  buildReport, copyText, errorCount, installErrorHandlers, lastError, missingAnswers,
  recordError,
} from './report.js';
import {
  ACTION_LABELS, ACTION_ORDER, DEFAULT_KEYS, actionForEvent, duplicateKey,
  getKeys, getReviewer, getRememberedTerms, keyDisplay, rememberTerm,
  setKeys, setReviewer,
} from './settings.js';
import { IS_DEV } from './channel.js';

export const VERSION = '3.0.0';
const BUILD = '__BUILD__'; // replaced with the short git SHA at deploy time

// Where the written protocol lives. Fill this in and the setup dialog links to
// it; leave it empty and the dialog names the protocol without linking, so the
// app never shows a dead link.
const PROTOCOL_URL = '';

const $ = id => document.getElementById(id);

// Bind defensively: a missing control must never be what takes the app down.
// Defined up here, with the other helpers, because `const` is not hoisted —
// a listener registered above this line throws before the app can boot, which
// has now happened twice.
const on = (node, event, handler) => node?.addEventListener(event, handler);

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
  autosaveChoose: $('autosave-choose'),
  autosaveOff: $('autosave-off'),
  autosaveStatus: $('autosave-status'),
  onedriveChoose: $('onedrive-choose'),
  onedriveHelpOpen: $('onedrive-help-open'),
  submitStatus: $('submit-status'),
  submitTarget: $('submit-target'),
  exportsBlock: $('exports-block'),
  exportsList: $('exports-list'),
  resumeBlock: $('resume-block'),
  fileList: $('file-list'),
  version: $('version'),
  devBadge: $('dev-badge'),

  rowTitle: $('row-title'),
  progress: $('progress'),
  progressTrack: $('progress-track'),
  progressFill: $('progress-fill'),
  pace: $('pace'),
  jump: $('jump'),
  jumpInput: $('jump-input'),
  jumpError: $('jump-error'),
  jumpGo: $('jump-go'),
  jumpCancel: $('jump-cancel'),
  jumpUnreviewed: $('jump-unreviewed'),
  jumpSkipped: $('jump-skipped'),
  saveState: $('save-state'),
  nestYes: $('nest-yes'),
  nestNo: $('nest-no'),
  nestSkip: $('nest-skip'),
  toggles: {
    structure: $('t-structure'),
    bird: $('t-bird'),
    provisioning: $('t-provisioning'),
  },
  nestDetails: $('nest-details'),
  detailsHint: $('details-hint'),
  dupesOpen: $('dupes-open'),
  dupes: $('dupes'),
  dupesGrid: $('dupes-grid'),
  dupesSearch: $('dupes-search'),
  dupesSameRecordist: $('dupes-same-recordist'),
  dupesSamePlace: $('dupes-same-place'),
  dupesCount: $('dupes-count'),
  dupesCancel: $('dupes-cancel'),
  dupesUngroup: $('dupes-ungroup'),
  dupesSave: $('dupes-save'),
  chickStage: $('y-chick-stage'),
  // Listed in panel order throughout this file: location, substrate, material.
  pickers: {
    nest_location: {
      wrap: $('p-location'), button: $('location-open'), pop: $('location-pop'),
      filter: $('location-filter'), list: $('location-list'), foot: $('location-foot'),
    },
    substrate: {
      wrap: $('p-substrate'), button: $('substrate-open'), pop: $('substrate-pop'),
      filter: $('substrate-filter'), list: $('substrate-list'), foot: $('substrate-foot'),
    },
    anthropogenic_material: {
      wrap: $('p-anthropogenic'), button: $('anthropogenic-open'), pop: $('anthropogenic-pop'),
      filter: $('anthropogenic-filter'), list: $('anthropogenic-list'), foot: $('anthropogenic-foot'),
    },
    prey_group: {
      wrap: $('p-prey'), button: $('prey-open'), pop: $('prey-pop'),
      filter: $('prey-filter'), list: $('prey-list'), foot: $('prey-foot'),
    },
  },
  counters: {
    eggs: { box: $('c-eggs'), input: $('count-eggs') },
    chicks: { box: $('c-chicks'), input: $('count-chicks') },
  },
  media: $('media'),
  mediaPlaceholder: $('media-placeholder'),
  mediaMessage: $('media-message'),
  mediaRetry: $('media-retry'),
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
  saveLocal: $('save-local'),
  localTarget: $('local-target'),
  submitResult: $('submit-result'),
  onedriveHelp: $('onedrive-help'),
  onedriveHelpClose: $('onedrive-help-close'),
  onedriveHelpPick: $('onedrive-help-pick'),
  donePaths: $('done-paths'),
  doneHint: $('done-hint'),
  doneOpenAnother: $('done-open-another'),

  reportOpen: $('report-open'),
  reportLabel: $('report-label'),
  report: $('report'),
  reportDoing: $('report-doing'),
  reportWrong: $('report-wrong'),
  reportRepeats: $('report-repeats'),
  reportText: $('report-text'),
  reportStatus: $('report-status'),
  reportCopy: $('report-copy'),
  reportClose: $('report-close'),
  prefs: $('prefs'),
  keygrid: $('keygrid'),
  prefsWarning: $('prefs-warning'),
  prefsReset: $('prefs-reset'),
  prefsCancel: $('prefs-cancel'),
  prefsSave: $('prefs-save'),
};

// Panel order again: structure leads, bird sits after the three lists.
const TOGGLE_FIELDS = {
  structure: 'human_structure',
  bird: 'bird_present',
  provisioning: 'provisioning',
};
const TOGGLE_LABELS = {
  // "structure" is about what the nest is ON, which is why it chooses the
  // location list. The material it is built FROM is a separate question.
  structure: 'on a human-made structure',
  bird: 'bird visible',
  // Stella's question is "are the parent birds actively feeding?", and the
  // column she confirmed is `provisioning` — which conventionally means
  // bringing food to the nest, a wider thing. The label carries both so the
  // definition travels with the name it is stored under.
  provisioning: 'provisioning — actively feeding',
};
// Both the letter and number binding of a toggle map to the same field.
const TOGGLE_ACTIONS = {
  toggle_structure: 'structure', toggle_structure_num: 'structure',
  toggle_bird: 'bird',
  toggle_bird_num: 'bird',
  toggle_provisioning: 'provisioning', toggle_provisioning_num: 'provisioning',
};
// Every toggle lives in the nest-details panel now, so this is all of them.
// Kept as a set rather than dropped: it is what stops a key setting a value on
// a row where the panel is closed and nobody could see it.
const NEST_ONLY_TOGGLES = new Set(['structure', 'bird', 'provisioning']);

// The three list questions, all nest-only, all answered by the same picker.
// They were one question until it became clear it was three: what the nest is
// made of, what man-made material is in it, and where it sits. Anthropogenic
// material used to be a top-level yes/no toggle; the list replaced it, and the
// old column is now derived from this one in catalog.js.
const PICKERS = {
  // The only picker whose list changes: man-made structure is answered first
  // and chooses between two shorter lists, so a tree is never offered as a
  // man-made place and the reviewer reads seven terms instead of fourteen.
  nest_location: {
    label: 'location',
    options: () => locationOptions(toggleOn('structure')),
    multi: false, key: 'pick_location', numKey: 'pick_location_num',
    // Typed terms are remembered against the list that was showing, so a
    // man-made one doesn't come back while the natural list is up.
    memory: () => (toggleOn('structure') ? 'nest_location_manmade'
                                         : 'nest_location_natural'),
  },
  substrate: {
    label: 'substrate',
    options: SUBSTRATE_OPTIONS, multi: true,
    key: 'pick_substrate', numKey: 'pick_substrate_num',
  },
  // "anthropogenic" is the word the column keeps, because three spreadsheets
  // already carry it. On screen it says what it means: this is the man-made
  // material the nest is built from — the twine and wire woven into it — and
  // not the man-made thing it is sitting on, which is the structure toggle
  // and the location picker between them.
  // Multi-select for the same reason substrate is: a nest can hold plastic
  // twine and wire at once, and making the reviewer choose one would throw the
  // other away. It was single-select until Stella asked; nothing in the file
  // format had to change, because the cell was already being written through
  // joinTerms.
  anthropogenic_material: {
    label: 'man-made material',
    options: ANTHROPOGENIC_OPTIONS, multi: true,
    key: 'pick_anthropogenic', numKey: 'pick_anthropogenic_num',
  },
  // The second half of the feeding question — "if visible, what kind?" — so it
  // only exists once provisioning says yes. Multi-select: one image can show
  // more than one item.
  prey_group: {
    label: 'prey', options: PREY_OPTIONS, multi: true,
    key: 'pick_prey', numKey: 'pick_prey_num',
    shownWhen: () => toggleOn('provisioning'),
  },
};
const PICKER_NAMES = Object.keys(PICKERS);

// Two of them are not optional. Everything else about a nest can honestly be
// left unanswered — there may be no bird in shot, no man-made material to
// name — but where a nest is and what it is built from are the questions the
// spreadsheet exists to answer, and a picker that sits quietly red reads as an
// option nobody minds you skipping. These say REQUIRED instead, and the
// advance key won't leave the row until they hold something.
//
// Both lists carry "unclear" for the photo that doesn't show it. Requiring an
// answer without that would only buy confident-looking guesses.
const REQUIRED_PICKERS = ['nest_location', 'substrate'];

// Chick stage is three states rather than two, so it cycles rather than
// toggling: blank -> early -> late -> unclear -> blank. The definition rides
// on the label, because two reviewers drawing the downy/feathered line
// differently is how this column goes wrong.
const CHICK_STAGE_TEXT = {
  early: 'early (downy)',
  late: 'late (feathered)',
  unclear: 'unclear',
};
// A picker's list and its remembered-terms key can both depend on another
// answer, so they are resolved when the list is drawn rather than at startup.
const pickerOptions = name => {
  const o = PICKERS[name].options;
  return typeof o === 'function' ? o() : o;
};
const pickerMemory = name => {
  const m = PICKERS[name].memory;
  return typeof m === 'function' ? m() : (m ?? name);
};
// Both the letter and number binding of a picker open the same list.
const PICKER_ACTIONS = Object.fromEntries(PICKER_NAMES.flatMap(
  name => [[PICKERS[name].key, name], [PICKERS[name].numKey, name]]));

// Navigation actions that may be triggered from inside a count box.
const ESCAPES_COUNT_BOX = new Set(['nest_yes', 'nest_no', 'forward', 'back']);

const COUNTER_FIELDS = { eggs: 'egg_count', chicks: 'chick_count' };
const COUNTER_LABELS = { eggs: 'eggs', chicks: 'chicks' };
// Letter and number bindings both focus the same count box.
const COUNTER_ACTIONS = {
  count_eggs: 'eggs', count_eggs_num: 'eggs',
  count_chicks: 'chicks', count_chicks_num: 'chicks',
};

const state = {
  sink: Progress,       // where in-progress work is kept (swapped in dev mode)
  autosave: null,       // optional Folder mirrored to as you label
  mirror: null,         // the composite sink wrapping Progress + autosave
  catalog: null,
  inputName: null,
  writer: null,
  idx: 0,
  reviewingSkipped: false, // walking only skipped items from the done screen
  reviewHistory: [],       // breadcrumb of visited items in that pass
  keys: getKeys(),
  currentId: null,
  zoomed: false,
  paceLog: [],   // when each item was reviewed this session, for the estimate
  wantedSrc: null,  // the media URL currently being asked for
  attempts: 0,      // how many times this asset has been tried
  // The current row's answer to each list question, always held as an array so
  // single- and multi-select differ only in how many entries are allowed.
  picks: Object.fromEntries(PICKER_NAMES.map(name => [name, []])),
  chickStage: '',   // '', 'early', 'late' or 'unclear'
  dupePicks: new Set(), // row indices selected in the contact sheet
  openPicker: null, // which picker is showing its list, if any
  pickerRows: [],   // what the open picker is currently offering
  pickerCursor: -1, // highlighted row in that list; -1 is "none yet"
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
  if (el.devBadge) el.devBadge.hidden = !IS_DEV;
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
  await restoreAutosave();
  await renderSubmitTarget();
  await refreshExportList();
  await refreshResumeList();
}

// ------------------------------------------------------- submit destination
/**
 * Show where finished work will go, before the researcher commits to it.
 *
 * Everyone picks their own destination and nothing can verify it is the right
 * one — the app has no notion of SharePoint, only of a folder someone chose —
 * so the least it can do is say which folder that is. Note the browser exposes
 * only the folder's leaf name, so two folders of the same name in different
 * places look identical here.
 */
async function renderSubmitTarget() {
  const stored = await Folder.restore().catch(() => null);
  const name = stored instanceof Folder ? stored.name : stored?.folder?.name ?? null;

  // The welcome card carries its own buttons, so its line is state only.
  if (el.submitStatus) {
    el.submitStatus.textContent = '';
    if (name) {
      el.submitStatus.append('Sending finished work to ', quoted(name), '.');
      el.onedriveChoose.textContent = 'Change folder';
    } else {
      el.submitStatus.append(notSet('Not set up'), " — finished work won't reach the team yet.");
      el.onedriveChoose.textContent = 'Choose OneDrive folder…';
    }
  }

  // The done-screen card sits beside its button, so it carries the small controls.
  if (el.submitTarget) {
    el.submitTarget.textContent = '';
    if (name) {
      el.submitTarget.append('OneDrive folder: ', quoted(name), ' ');
      el.submitTarget.append(smallButton('Change', changeSubmitFolder));
    } else {
      el.submitTarget.append('OneDrive folder: ', notSet('not set up yet'),
                             " — you'll choose it the first time. ");
    }
    el.submitTarget.append(
      smallButton('How do I set this up?', () => el.onedriveHelp.showModal()));
  }
}

function smallButton(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function changeSubmitFolder() {
  try {
    const folder = await Folder.pick(); // one activation, spent on the picker
    if (!folder) return;
    await renderSubmitTarget();
    await refreshExportList();
    announce('info', `OneDrive folder is now “${folder.name}”.`);
  } catch (err) {
    announce('error', err.message);
  }
}

/** Report to whichever screen is actually showing. */
function announce(kind, message) {
  if (!el.screens.done.hidden) { showResult(kind, message); return; }
  if (kind === 'error') { showError(el.welcomeError, message); return; }
  el.welcomeError.hidden = true;
}

// ----------------------------------------------------------------- autosave
/**
 * Optional: mirror in-progress work to a folder on disk as well as to the
 * browser. Offered once; declining is remembered. Never required, and a
 * failure here never blocks labeling.
 */
async function restoreAutosave() {
  const restored = await Folder.restore({ key: AUTOSAVE_DIR }).catch(() => null);
  if (restored instanceof Folder) {
    state.autosave = restored;
    renderAutosaveStatus();
  } else if (restored?.needsPermission) {
    // Re-granting needs a click, so the card offers one rather than failing silently.
    renderAutosaveStatus({ needsPermission: true, name: restored.folder.name });
  } else {
    renderAutosaveStatus();
  }
}

/**
 * The local-folder card. Both cards state where they stand and carry one
 * button, so neither folder reads as more required than the other — and the
 * copy says outright that labeling works with neither.
 */
function renderAutosaveStatus(pending = null) {
  if (!el.autosaveStatus) return;
  el.autosaveStatus.textContent = '';

  if (pending?.needsPermission) {
    el.autosaveStatus.append(quoted(pending.name), ' needs permission again.');
    el.autosaveChoose.textContent = 'Reconnect';
    el.autosaveChoose.dataset.reconnect = 'true';
    el.autosaveOff.hidden = false;
    return;
  }
  delete el.autosaveChoose.dataset.reconnect;

  if (state.autosave) {
    el.autosaveStatus.append('Saving to ', quoted(state.autosave.name), ' as you label.');
    el.autosaveChoose.textContent = 'Change folder';
    el.autosaveOff.hidden = false;
    return;
  }
  el.autosaveStatus.append(notSet('Not set'), ' — work is kept in this browser only.');
  el.autosaveChoose.textContent = 'Choose local folder…';
  el.autosaveOff.hidden = true;
}

function quoted(name) {
  const b = document.createElement('b');
  b.textContent = `“${name}”`;
  return b;
}

function notSet(text) {
  const span = document.createElement('span');
  span.className = 'none';
  span.textContent = text;
  return span;
}

async function chooseAutosave() {
  el.welcomeError.hidden = true;
  try {
    const folder = await Folder.pick(AUTOSAVE_DIR);
    if (!folder) return;
    const submitFolder = await Folder.restore().catch(() => null);
    if (submitFolder instanceof Folder && await folder.isSameAs(submitFolder)) {
      showError(el.welcomeError,
        'That is the folder you submit finished work to. Pick a different one, ' +
        'so half-labeled files never land there.');
      await Folder.forget(AUTOSAVE_DIR);
      return;
    }
    state.autosave = folder;
    state.mirror?.setMirror(folder);
    renderAutosaveStatus();
  } catch (err) {
    showError(el.welcomeError, err.message);
  }
}

el.autosaveChoose.addEventListener('click', async () => {
  if (el.autosaveChoose.dataset.reconnect) {
    const folder = await Folder.restore({ key: AUTOSAVE_DIR, interactive: true });
    state.autosave = folder instanceof Folder ? folder : null;
    if (state.autosave) state.mirror?.setMirror(state.autosave);
    else await Folder.forget(AUTOSAVE_DIR);
    renderAutosaveStatus();
    return;
  }
  await chooseAutosave();
});

el.autosaveOff.addEventListener('click', async () => {
  await Folder.forget(AUTOSAVE_DIR);
  state.autosave = null;
  state.mirror?.setMirror(null);
  renderAutosaveStatus();
});

el.onedriveChoose.addEventListener('click', changeSubmitFolder);
el.onedriveHelpOpen.addEventListener('click', () => el.onedriveHelp.showModal());

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

/**
 * The exports waiting in the OneDrive folder — where the spreadsheets to review
 * now come from, rather than each researcher's Downloads. Silent when there is
 * no folder yet or nothing in it; "Open a spreadsheet…" still covers a file
 * from anywhere.
 */
async function refreshExportList() {
  let entries = [];
  try {
    const stored = await Folder.restore();
    if (stored instanceof Folder) entries = await stored.listExports();
  } catch { /* no access yet, or the folder went away — the picker still works */ }

  el.exportsBlock.hidden = entries.length === 0;
  el.exportsList.textContent = '';
  for (const entry of entries) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const name = document.createElement('span');
    name.textContent = entry.name;
    button.append(name);
    button.addEventListener('click', async () => {
      el.welcomeError.hidden = true;
      try {
        await ExportHandles.save(entry.name, entry.handle).catch(() => {});
        await beginLabeling(entry.handle, entry.name);
      } catch (err) {
        showError(el.welcomeError, err.message);
      }
    });
    li.append(button);
    el.exportsList.append(li);
  }
}

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
    const handle = await ExportHandles.load(entry.inputName).catch(() => null);

    // One activation-consuming call per click: either re-grant the remembered
    // handle, or open the picker — never both (see acquireSubmitFolder).
    if (handle) {
      if (await ensureReadable(handle)) {
        await beginLabeling(handle, entry.inputName);
        return;
      }
      await ExportHandles.remove(entry.inputName).catch(() => {});
      showError(el.welcomeError,
        `Access to ${entry.inputName} wasn't granted. Click it again to pick the ` +
        `file yourself — your saved labels for it are kept.`);
      return;
    }

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
  state.mirror = mirrorSink(state.sink, state.autosave, {
    onMirrorError: err => {
      // The browser copy still succeeded, so this is a warning, not a failure.
      console.warn('autosave failed:', err);
      alertBanner(`Autosave to “${state.autosave?.name}” failed (${err.message}). ` +
                  `Your work is still saved in this browser.`);
    },
  });
  state.writer = new DebouncedWriter(state.mirror, inputName, {
    onError: err => { noteHandledError('autosave/progress write failed', err); setSaveState('error', err.message); },
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

  el.rowTitle.textContent = `${row['Common Name'] ?? ''} · ${row['Scientific Name'] ?? ''}`;
  renderProgressReadout();
  document.title = `bird-swipe · [${state.idx + 1}/${total}] · ML ${mlId}`;

  showAsset(mlId, row.Format ?? '');
  renderMeta(row);
  el.notes.value = row.notes ?? '';
  refreshNotesSize();
  for (const [field, column] of Object.entries(TOGGLE_FIELDS)) {
    setToggle(field, row[column] === 'yes');
  }
  for (const [field, column] of Object.entries(COUNTER_FIELDS)) {
    setCount(field, row[column] ?? '');
  }
  closePicker(); // never carry an open list onto the next item
  // Legacy 'n/a' is already dropped as the file loads, so these are values or blanks.
  for (const name of PICKER_NAMES) setPick(name, row[name] ?? '');
  setChickStage(row.chick_stage ?? '');
  updateChip(row);
  showNestDetails(row);
  renderNestLabels();
  prefetchUpcoming();
  resetNotesLabel();
  renderLegend();
}

/**
 * The bar tracks *reviewed*, not position: what's left to do, rather than where
 * the cursor happens to be. Someone stepping back through finished items hasn't
 * undone any work, and the bar shouldn't say they have.
 */
function renderProgress(stats, total) {
  const pct = total ? (stats.reviewed / total) * 100 : 0;
  el.progressFill.style.width = `${pct}%`;
  el.progressTrack.setAttribute('aria-valuenow', Math.round(pct));
  el.progressTrack.setAttribute('aria-valuetext',
    `${stats.reviewed} of ${total} reviewed`);
  el.pace.textContent = remainingEstimate(total - stats.reviewed);
}

/**
 * Time left, from the median gap between recent reviews.
 *
 * Median rather than mean so one trip to the kettle doesn't wreck the figure,
 * and nothing is shown until there's enough to be worth saying — a guess from
 * two data points is worse than silence.
 */
function remainingEstimate(itemsLeft) {
  if (itemsLeft <= 0 || state.paceLog.length < 5) return '';
  const gaps = state.paceLog.slice(1).map((t, i) => t - state.paceLog[i]).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median > 60_000) return ''; // long pauses: they aren't in a rhythm to project
  const mins = Math.round((median * itemsLeft) / 60_000);
  if (mins < 1) return 'under a minute left';
  if (mins < 60) return `about ${mins} min left`;
  return `about ${Math.floor(mins / 60)} h ${mins % 60} min left`;
}

/** Called wherever an item becomes reviewed, so the estimate reflects real pace. */
function notePace() {
  state.paceLog.push(Date.now());
  if (state.paceLog.length > 12) state.paceLog.shift();
}

function setToggle(field, on) {
  const node = el.toggles[field];
  node.setAttribute('aria-pressed', String(on));
}
const toggleOn = field => el.toggles[field].getAttribute('aria-pressed') === 'true';

/**
 * Follow-on work after a toggle is flipped by hand.
 *
 * Man-made structure chooses which location list is offered, so flipping it
 * strands a location that came off the list now hidden — "man-made: tree" is
 * not an answer anyone meant to give. That value is dropped and the picker
 * goes back to empty, which is visible immediately since the reviewer is
 * looking straight at it.
 *
 * Anything typed in is kept: nothing can tell which side of the line a typed
 * term sits on, and throwing away what someone typed is the worse mistake.
 */
function afterToggle(field) {
  // Answering "no" to feeding takes the prey answer with it, the same way a
  // zero chick count takes the stage, so a stale one can't sit under a no.
  if (field === 'provisioning') {
    if (state.openPicker === 'prey_group' && !toggleOn('provisioning')) closePicker();
    renderConditionalPickers();
    return;
  }
  if (field !== 'structure') return;
  reconcileLocation();
  closePicker();               // its list just changed underneath it
}

/**
 * Drop a recorded location that belongs to the list the structure answer has
 * just turned away from. Split out from afterToggle because the location
 * picker can switch lists with itself open (left/right inside it), and there
 * the list changing is the point rather than a reason to close.
 */
function reconcileLocation() {
  const [current] = state.picks.nest_location;
  if (current && isListedLocation(current)
      && !pickerOptions('nest_location').some(
           o => o.toLowerCase() === current.toLowerCase())) {
    state.picks.nest_location = [];
  }
  renderPickerButton('nest_location');
}

/**
 * Natural or man-made, from inside the location list. It answers the structure
 * question as a side effect, which is the point: the two were one decision
 * being asked as two, and getting them in the wrong order meant picking off
 * the wrong list and doing it again. Left and right are otherwise inert in a
 * list, so this costs no key anyone was using.
 */
function switchLocationList() {
  // Only ever reachable from the location filter, which only has focus while
  // that list is open — but it re-renders whichever list is open, so say so
  // rather than trusting the caller.
  if (state.openPicker !== 'nest_location') return;
  setToggle('structure', !toggleOn('structure'));
  reconcileLocation();
  state.pickerCursor = -1;     // a different list underneath it
  renderPickerList();
  saveOpenRow();
}

/** Show a saved count. Blank stays blank so a skipped row doesn't read as 0. */
function setCount(field, value) {
  const { input } = el.counters[field];
  input.value = value === '' || value == null ? '' : String(normalizeCount(value) || 0);
  refreshCounter(field);
}

const countOf = field => el.counters[field].input.value;

/** Red until there is at least one, matching how the toggles read. */
function refreshCounter(field) {
  const { box, input } = el.counters[field];
  box.dataset.empty = String(normalizeCount(input.value) === 0);
}

function renderCounterLabels() {
  for (const field of Object.keys(COUNTER_FIELDS)) {
    const letter = keyDisplay(state.keys[`count_${field}`]);
    const number = keyDisplay(state.keys[`count_${field}_num`]);
    const label = el.counters[field].box.querySelector('.counter-label');
    label.textContent = '';
    label.append(
      COUNTER_LABELS[field] + '  ',
      Object.assign(document.createElement('span'),
        { className: 'key', textContent: `(${letter}/${number})` }));
  }
}

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

/**
 * The panel is open exactly when the row is a nest, so it can never be
 * answered for something that isn't one — and a saved yes reopens it with its
 * answers, the same way the main toggles already show what's stored.
 */
function renderProgressReadout() {
  const total = state.catalog.rows.length;
  const stats = state.catalog.stats();
  el.progress.textContent =
    `[${state.idx + 1} / ${total}]   reviewed ${stats.reviewed}` +
    (state.reviewingSkipped ? '   ·   reviewing skipped' : '');
  renderProgress(stats, total);
}

function showNestDetails(row) {
  const isNest = (row?.nest_label ?? '') === 'yes';
  el.nestDetails.hidden = !isNest;
  if (isNest) {
    const missing = missingRequired();
    el.detailsHint.textContent = missing.length
      ? `${missing.map(n => PICKERS[n].label).join(' and ')} still needed`
      : `${keyDisplay(state.keys.nest_yes)} again to save and move on`;
    renderPickerButtons();
    renderConditionalPickers();
    renderChickStage();
  }
}


// ------------------------------------------------------------- the pickers
// Three questions answered from lists that are meant to grow, so they are
// answered by typing rather than by memorising a number: the key opens the
// list, typing narrows it, Enter or a digit confirms. Nothing is recorded
// until it is confirmed — a navigation key closes the list and leaves the
// answer exactly as it was, so a half-typed filter can never land in the
// spreadsheet as a real answer.
//
// Digits pick only from the unfiltered list, which is why they are numbered
// only while the box is empty: once you are typing, a digit is part of what
// you typed, so a term like "I-35 bridge" stays possible.
//
// Substrate is multi-select — a nest is often twigs and mud and fur — so
// confirming a term there toggles it and leaves the list open for the next
// one. The other two take a single answer and close on confirm.

/** Load one picker from a row's cell. Multi-select cells hold "a; b; c". */
function setPick(name, value) {
  const terms = splitTerms(value);
  state.picks[name] = PICKERS[name].multi ? terms : terms.slice(0, 1);
  renderPickerButton(name);
}

/** One picker's answer as it goes into the file. */
function pickValue(name) {
  return joinTerms(state.picks[name]);
}

function renderPickerButton(name) {
  const { label } = PICKERS[name];
  const node = el.pickers[name];
  const value = pickValue(name);
  const required = REQUIRED_PICKERS.includes(name);
  node.wrap.dataset.empty = String(value === '');
  node.button.textContent = '';
  node.button.append(
    value ? `${label}: ${value}  `
          : (required ? `${label} — REQUIRED  ` : `${label}  `),
    Object.assign(document.createElement('span'), {
      className: 'key',
      textContent: `(${keyDisplay(state.keys[PICKERS[name].key])}`
        + `/${keyDisplay(state.keys[PICKERS[name].numKey])})`,
    }));
}

function renderPickerButtons() {
  for (const name of PICKER_NAMES) renderPickerButton(name);
}

/**
 * Hide a picker whose question doesn't apply yet, and drop what it held. Only
 * prey has one: asking what is being fed before anyone has said feeding is
 * happening is asking for a guess. Hidden elements aren't focusable, so it
 * leaves the Tab order on its own.
 */
function renderConditionalPickers() {
  for (const name of PICKER_NAMES) {
    const shown = PICKERS[name].shownWhen?.() ?? true;
    el.pickers[name].wrap.hidden = !shown;
    if (!shown && state.picks[name].length) {
      state.picks[name] = [];
      renderPickerButton(name);
    }
  }
}

/**
 * Chick stage, cycled one key at a time. It only exists where chicks were
 * counted, so the control hides itself when the count is zero and the value
 * goes with it — catalog.js writes blank there too, so a stale "late" cannot
 * survive under a nest with no chicks in it.
 */
function setChickStage(value) {
  state.chickStage = CHICK_STAGES.includes(value) ? value : '';
  renderChickStage();
}

function cycleChickStage() {
  if (el.nestDetails.hidden || el.chickStage.hidden) return;
  const order = ['', ...CHICK_STAGES];
  const next = order[(order.indexOf(state.chickStage) + 1) % order.length];
  setChickStage(next);
  saveOpenRow();
}

function renderChickStage() {
  const counted = normalizeCount(countOf('chicks')) > 0;
  el.chickStage.hidden = !counted;
  if (!counted && state.chickStage) setChickStage('');
  el.chickStage.dataset.empty = String(state.chickStage === '');
  el.chickStage.textContent = '';
  el.chickStage.append(
    state.chickStage
      ? `chick stage: ${CHICK_STAGE_TEXT[state.chickStage]}  `
      : 'chick stage  ',
    Object.assign(document.createElement('span'), {
      className: 'key',
      textContent: `(${keyDisplay(state.keys.cycle_chick_stage)}`
        + `/${keyDisplay(state.keys.cycle_chick_stage_num)})`,
    }));
}

/**
 * Open the next required question that hasn't been answered, if there is one.
 *
 * This is what makes a nest cheap: marking one opens the location list without
 * being asked, confirming that opens substrate, and the reviewer never presses
 * a key whose only job is to open something. The required run chains; nothing
 * else does, so the optional questions stay out of the way until they're
 * wanted. Esc breaks out of it — it closes a list and chains nothing, which is
 * how you get to the counts first if that's the order you like.
 */
function chainToNextRequired() {
  const [next] = missingRequired();
  if (next) openPicker(next);
}

/** The required questions still sitting empty, in the order they appear. */
const missingRequired = () =>
  REQUIRED_PICKERS.filter(name => pickValue(name) === '');

/**
 * Called when the advance key is pressed on a nest that isn't finished. Rather
 * than only refusing, it puts the reviewer where the work is: the first empty
 * one opens, all of them are marked, and the hint says what is wanted. `←` and
 * `↓` are deliberately not gated — "this isn't a nest" and "I'm not answering
 * this one" have to stay one press, or the requirement just teaches people to
 * skip rows.
 */
function promptForRequired(missing) {
  for (const name of missing) el.pickers[name].wrap.dataset.missing = 'true';
  setTimeout(() => {
    for (const name of missing) delete el.pickers[name].wrap.dataset.missing;
  }, 1800);
  const names = missing.map(n => PICKERS[n].label);
  const keys = missing.map(n => keyDisplay(state.keys[PICKERS[n].key]));
  el.detailsHint.textContent =
    `${names.join(' and ')} needed before moving on `
    + `(${keys.join(', ')}) — each list has “unclear” if the photo doesn't show it`;
  openPicker(missing[0]);
}

/**
 * A click made with the mouse, rather than the browser turning a keypress on a
 * focused button into one. Those arrive with detail 0.
 *
 * The difference matters because a mouse click should hand the keyboard back
 * to the label loop — the pointer is where the reviewer's attention is — while
 * a keyboard activation has to leave focus exactly where it was, or Tab starts
 * again from the top of the page every time you press Space.
 */
const fromPointer = event => event.detail > 0;

const pickerOpen = () => state.openPicker !== null;

function openPicker(name) {
  if (el.nestDetails.hidden) return; // nothing to answer on a non-nest row
  if (el.pickers[name].wrap.hidden) return; // its question hasn't come up yet
  if (state.openPicker && state.openPicker !== name) closePicker();
  const node = el.pickers[name];
  state.openPicker = name;
  node.pop.hidden = false;
  node.button.setAttribute('aria-expanded', 'true');
  node.filter.value = '';
  state.pickerCursor = -1;
  renderPickerList();
  node.filter.focus();
}

function closePicker() {
  const name = state.openPicker;
  if (!name) return;
  const node = el.pickers[name];
  // Hand focus back to the button that opened it, so Tab carries on from
  // where the reviewer was rather than restarting at the top of the page.
  // Only when the list actually had focus: closing one because the row
  // changed underneath must not pull focus from wherever it has gone.
  const hadFocus = document.activeElement === node.filter;
  node.pop.hidden = true;
  node.button.setAttribute('aria-expanded', 'false');
  node.filter.blur();
  state.openPicker = null;
  if (hadFocus) node.button.focus();
}

function renderPickerList() {
  const name = state.openPicker;
  if (!name) return;
  const { multi } = PICKERS[name];
  const options = pickerOptions(name);
  const node = el.pickers[name];
  const query = node.filter.value;
  const numbered = query.trim() === '';
  const chosen = state.picks[name];
  state.pickerRows = filterTerms(options, query, getRememberedTerms(pickerMemory(name)));
  node.list.textContent = '';
  if (state.pickerCursor >= state.pickerRows.length) {
    state.pickerCursor = state.pickerRows.length - 1;
  }

  state.pickerRows.forEach((term, i) => {
    const li = document.createElement('li');
    li.id = `${name}-opt-${i}`;
    li.setAttribute('role', 'option');
    const on = chosen.some(t => t.toLowerCase() === term.toLowerCase());
    // Green marks what is recorded, in both kinds of list, so stepping back
    // onto a labeled item shows its answers in place. Where the arrow keys
    // have walked to is a separate mark: it moves, and it records nothing
    // until Enter.
    li.setAttribute('aria-selected', String(on));
    if (i === state.pickerCursor) li.dataset.cursor = 'true';
    if (numbered && i < 9) {
      li.append(Object.assign(document.createElement('span'),
        { className: 'num', textContent: String(i + 1) }));
    } else {
      li.append(Object.assign(document.createElement('span'), { className: 'num' }));
    }
    li.append(term);
    if (on) {
      li.append(Object.assign(document.createElement('span'),
        { className: 'current', textContent: 'recorded' }));
    }
    li.addEventListener('mousedown', event => {
      event.preventDefault(); // keep focus in the filter box
      confirmTerm(term);
    });
    node.list.append(li);
  });

  const at = node.list.children[state.pickerCursor];
  node.filter.setAttribute('aria-activedescendant', at ? at.id : '');
  if (at) at.scrollIntoView({ block: 'nearest' });

  const typed = query.trim();
  const exact = state.pickerRows.some(t => t.toLowerCase() === typed.toLowerCase());
  // With nothing typed there is no match to take, so Enter means "done" —
  // which is the only way out of a multi-select list besides Esc, and reads
  // less like a cancel. Esc still works and still records nothing further.
  const offer = state.pickerRows[state.pickerCursor]
    ?? (typed ? state.pickerRows[0] : undefined);
  // Which of the two location lists is showing, and how to swap them, put in
  // the filter's placeholder rather than on a line of its own: it shows while
  // the box is empty, which is exactly when the cue is wanted, and costs no
  // height at all. The popup hangs over the photo, and every line of it is
  // picture the reviewer can't see.
  node.filter.placeholder = name === 'nest_location'
    ? (toggleOn('structure') ? 'man-made places · ←→ for natural'
                             : 'natural places · ←→ for man-made')
    : 'type to narrow, or type anything new';

  // Kept to one line. What the filter box is for is written in the filter box.
  node.foot.textContent = offer
    ? `Enter records “${offer}” · ↑↓ move · Esc`
    : (typed
        ? `Enter adds “${typed}” · ↑↓ move · Esc`
        : '↑↓ move · 1–9 pick · Enter when done');
}

/**
 * Record a term. On a multi-select picker this toggles it and stays open, so
 * twigs-and-mud-and-fur is three presses and no reopening; elsewhere it
 * replaces the answer and closes. Anything typed is kept for next time.
 */
function confirmTerm(term) {
  const name = state.openPicker;
  const value = String(term ?? '').trim();
  if (!name || !value) return;
  const { multi } = PICKERS[name];

  if (multi) {
    const chosen = state.picks[name];
    const at = chosen.findIndex(t => t.toLowerCase() === value.toLowerCase());
    if (at >= 0) chosen.splice(at, 1);
    else chosen.push(value);
  } else {
    state.picks[name] = [value];
  }

  rememberTerm(pickerMemory(name), value); // so the second one is a pick
  renderPickerButton(name);
  delete el.pickers[name].wrap.dataset.missing;
  if (multi) {
    el.pickers[name].filter.value = ''; // ready for the next one
    // and the highlight goes with it: the list underneath has just changed
    // back to the full one, and leaving the cursor behind would make the next
    // Enter toggle a row nobody is looking at instead of finishing.
    state.pickerCursor = -1;
    renderPickerList();
  } else {
    closePicker();
    // Answering one required question opens the next, so the run carries
    // itself. Optional pickers chain nothing: finishing one means you went
    // looking for it, and being handed another list would be a surprise.
    if (REQUIRED_PICKERS.includes(name)) chainToNextRequired();
  }
  saveOpenRow();
}

/**
 * Keep the file in step with a panel answer. The row is already marked yes —
 * that is the only way the panel is open — so this re-records it in place
 * rather than waiting for the reviewer to press → again.
 */
function saveOpenRow() {
  if (state.catalog?.rows[state.idx]?.nest_label === 'yes') commit(true, false);
}

function updateChip(row) {
  const label = row.nest_label ?? '';
  el.nestYes.setAttribute('aria-pressed', String(label === 'yes'));
  el.nestNo.setAttribute('aria-pressed', String(label === 'no'));
  el.nestSkip.hidden = label !== SKIPPED;
}

/** Labels on the nest buttons follow whatever the keys are bound to. */
function renderNestLabels() {
  el.nestYes.textContent = `nest YES ✓  (${keyDisplay(state.keys.nest_yes)})`;
  el.nestNo.textContent = `nest NO ✗  (${keyDisplay(state.keys.nest_no)})`;
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

  // Recordist, date and checklist sit together, because that is how a
  // reviewer recognises a nest they have seen before: the same person, out
  // on the same day, on the same list. The checklist is a link — one click
  // is the whole outing, which is worth more than the S-number itself.
  const inline = document.createElement('div');
  for (const key of ['Format', 'Caption', 'Behaviors',
                     'Recordist', 'Recordist 2', 'Date', 'eBird Checklist ID',
                     'Locality', 'Asset Tags']) {
    if (!row[key]) continue;          // every field shows only when present
    const b = document.createElement('b');
    if (key === 'eBird Checklist ID') {
      b.textContent = 'Checklist: ';
      const a = document.createElement('a');
      a.href = checklistUrl(row[key]);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = row[key];
      inline.append(b, a, `   `);
      continue;
    }
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
    if (key === 'Media notes') offerTranslation(line, b, row[key], mlId);
  }
}

// ------------------------------------------------------------- translation
// Media notes are written by whoever uploaded the asset, in whatever language
// they use, and are often the one line that says whether it is a nest. So they
// are shown in English where that is possible — with the original one click
// away, because the original is the record and a machine translation is not.
//
// Chrome wants a user gesture before it will build a model, so the first note
// in a language cannot translate itself. Rather than assume that, this tries,
// and puts up a button only when Chrome actually refuses. Once a click has
// bought the model, every later note in that language translates on sight.
const translators = new Translators();

/** Swap a rendered note between the original and its translation. */
function showNote(line, label, { original, english, language, showing }) {
  const name = languageName(language);
  line.textContent = '';
  label.textContent = showing === 'english'
    ? `Media notes (translated from ${name}): `
    : `Media notes (${name}): `;
  line.append(label, showing === 'english' ? english : original);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'link-btn';
  button.textContent = showing === 'english'
    ? `show original (${name})` : 'show translation';
  button.addEventListener('click', () => showNote(line, label, {
    original, english, language,
    showing: showing === 'english' ? 'original' : 'english',
  }));
  line.append(' ', button);
}

/**
 * Translate one note in place, if this browser can and the note isn't English.
 *
 * Everything here is best-effort: a browser without the APIs, a language with
 * no model, a detection too weak to trust, or an outright failure all leave
 * the note exactly as the eBirder wrote it. `mlId` guards against a slow
 * translation landing on whatever row the reviewer has since moved to.
 */
async function offerTranslation(line, label, text, mlId) {
  if (!canTranslate()) return;
  const stale = () => state.catalog?.rows[state.idx]?.[CATALOG_KEY] !== mlId;

  const run = async () => {
    const language = await translators.detect(text);
    if (!language) return true;             // English, or too unsure to act
    const english = await translators.translate(text, language);
    if (stale() || !english || english === text) return true;
    showNote(line, label, { original: text, english, language, showing: 'english' });
    return true;
  };

  try {
    await run();
  } catch (err) {
    if (!(err instanceof NeedsGestureError)) {
      noteHandledError('translate media notes failed', err);
      return;
    }
    // Chrome wants a click first. Offer one; it is also the gesture.
    if (stale()) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-btn';
    button.textContent = 'translate to English';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'translating…';
      try {
        await run();
      } catch (e) {
        noteHandledError('translate media notes failed', e);
        button.textContent = 'translation unavailable';
      }
    });
    line.append(' ', button);
  }
}

function renderLegend() {
  const k = state.keys;
  const parts = [
    [keyDisplay(k.nest_yes), 'YES'], [keyDisplay(k.nest_no), 'NO'],
    [keyDisplay(k.forward), 'next'], [keyDisplay(k.back), 'back'],
    [keyDisplay(k.notes), 'notes'],
    // Same order as the panel itself, so the legend can be read straight
    // across rather than hunted through.
    [`${keyDisplay(k.toggle_structure)}/${keyDisplay(k.toggle_structure_num)}`, 'structure'],
    [`${keyDisplay(k.pick_location)}/${keyDisplay(k.pick_location_num)}`, 'location'],
    [`${keyDisplay(k.pick_substrate)}/${keyDisplay(k.pick_substrate_num)}`, 'substrate'],
    [`${keyDisplay(k.pick_anthropogenic)}/${keyDisplay(k.pick_anthropogenic_num)}`, 'anthro'],
    [`${keyDisplay(k.toggle_bird)}/${keyDisplay(k.toggle_bird_num)}`, 'bird'],
    [`${keyDisplay(k.count_eggs)}/${keyDisplay(k.count_eggs_num)}`, 'eggs'],
    [`${keyDisplay(k.count_chicks)}/${keyDisplay(k.count_chicks_num)}`, 'chicks'],
    [`${keyDisplay(k.cycle_chick_stage)}/${keyDisplay(k.cycle_chick_stage_num)}`,
     'chick stage'],
    [`${keyDisplay(k.toggle_provisioning)}/${keyDisplay(k.toggle_provisioning_num)}`,
     'feeding'],
    [`${keyDisplay(k.pick_prey)}/${keyDisplay(k.pick_prey_num)}`, 'prey'],
    [keyDisplay(k.zoom), state.zoomed ? 'zoom out' : 'zoom in'],
    [keyDisplay(k.jump), 'jump to…'],
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
  state.attempts = 0;
  // Reset the zoom *state* without touching src — loadMedia is the only thing
  // that assigns it. Two owners of el.photo.src raced here, and the loser's URL
  // no longer matched state.wantedSrc, so every error looked stale and was
  // swallowed: a broken image sat on "Loading…" for ever.
  state.zoomed = false;
  el.media.classList.remove('zoomed');
  el.media.scrollTop = 0;
  el.media.scrollLeft = 0;
  stopVideo();
  loadMedia(format);
}

/**
 * (Re)start the fetch for the current asset. Used for first load and retries.
 *
 * Retries carry a counter in the query string. Assigning an identical src is a
 * no-op — the browser doesn't refetch, so no second error ever arrives and the
 * placeholder sits on "Loading…" for good. The first attempt stays clean so the
 * CDN cache still does its job.
 */
function loadMedia(format = state.catalog?.rows[state.idx]?.Format ?? '') {
  const mlId = state.currentId;
  el.mediaRetry.hidden = true;
  const bust = url => (state.attempts ? `${url}?retry=${state.attempts}` : url);

  if (format === 'Video') {
    stopPhoto();
    state.wantedSrc = bust(videoUrl(mlId));
    showMessage(`Loading video ${mlId}…`);
    el.video.hidden = false;
    el.video.src = state.wantedSrc;
    el.video.play().catch(() => {}); // autoplay may be refused; the click still works
    return;
  }
  el.video.hidden = true;
  el.photo.hidden = true;
  state.wantedSrc = bust(photoUrl(mlId, state.zoomed ? PHOTO_SIZE_HIGH : PHOTO_SIZE_DEFAULT));
  showMessage(`Loading ${mlId}…`);
  el.photo.src = state.wantedSrc;
}

function showMessage(text, retry = false) {
  el.mediaPlaceholder.hidden = false;
  el.mediaMessage.textContent = text;
  el.mediaRetry.hidden = !retry;
}

/**
 * A failed image used to be a dead end: the only way past it was the forward
 * key, which records a skip — so a patchy connection quietly wrote non-decisions
 * into the data. One silent retry covers the ordinary blip; after that it asks,
 * rather than deciding on the researcher's behalf.
 */
function mediaFailed(what) {
  if (state.attempts < 1) {
    state.attempts += 1;
    showMessage(`${what} didn't load. Retrying…`);
    setTimeout(() => { if (state.currentId) loadMedia(); }, 1200);
    return;
  }
  showMessage(
    `${what} still won't load. Check your connection — the photos come from ` +
    `Cornell's servers, so this is usually the network rather than the app.`,
    true);
}

on(el.mediaRetry, 'click', () => { state.attempts += 1; loadMedia(); });

/**
 * Swap between the fit-to-window image and the full-resolution one.
 *
 * Counting eggs or chicks in a nest photographed from distance needs real
 * magnification — the CDN serves a 2400px copy, and until now the app only ever
 * asked for 1200. Zoomed, the image sits at its natural size and the frame
 * scrolls.
 */
function setZoom(on, origin = null) {
  const row = state.catalog?.rows[state.idx];
  if (on && (!row || row.Format === 'Video')) return; // photos only
  if (state.zoomed === Boolean(on)) return;
  state.zoomed = Boolean(on);
  el.media.classList.toggle('zoomed', state.zoomed);
  renderLegend(); // the legend is the one cue that stays put while the image scrolls

  state.attempts = 0;
  loadMedia();    // single owner of el.photo.src

  if (!state.zoomed) { el.media.scrollTop = 0; el.media.scrollLeft = 0; return; }

  // Keep whatever they clicked under the pointer, rather than jumping to a corner.
  requestAnimationFrame(() => {
    const frame = el.media.getBoundingClientRect();
    const fx = origin ? (origin.x - frame.left) / frame.width : 0.5;
    const fy = origin ? (origin.y - frame.top) / frame.height : 0.5;
    el.media.scrollLeft = fx * el.media.scrollWidth - frame.width / 2;
    el.media.scrollTop = fy * el.media.scrollHeight - frame.height / 2;
  });
}

/**
 * True when an <img> event belongs to the asset still on screen. Swiping fast
 * abandons in-flight loads, and a late event from one of those would otherwise
 * paint the previous bird over the current one.
 */
const photoIsCurrent = () =>
  state.wantedSrc !== null && el.photo.getAttribute('src') === state.wantedSrc;

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
  mediaFailed(`ML ${state.currentId}`);
});

el.video.addEventListener('loadeddata', () => { el.mediaPlaceholder.hidden = true; });

el.photo.addEventListener('click', event => {
  setZoom(!state.zoomed, { x: event.clientX, y: event.clientY });
});

el.video.addEventListener('click', () => {
  if (el.video.paused) el.video.play().catch(() => {}); else el.video.pause();
});
el.video.addEventListener('error', () => {
  if (el.video.getAttribute('src') !== state.wantedSrc) return; // stale
  el.video.hidden = true;
  mediaFailed(`Video ML ${state.currentId}`);
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
/**
 * Record the decision for the current row. `move` false keeps us on it — see
 * nestYes(), where the first press has to stay put so the nest-details panel
 * can be answered.
 */
function commit(nest, move = true) {
  state.catalog.setLabel(state.idx, {
    nest,
    structure: toggleOn('structure'),
    eggCount: countOf('eggs'),
    chickCount: countOf('chicks'),
    birdPresent: toggleOn('bird'),
    substrate: pickValue('substrate'),
    anthropogenicMaterial: pickValue('anthropogenic_material'),
    nestLocation: pickValue('nest_location'),
    chickStage: state.chickStage,
    provisioning: toggleOn('provisioning'),
    preyGroup: pickValue('prey_group'),
    reviewer: getReviewer(),
    notes: el.notes.value.trim(),
  });
  state.writer.schedule(state.catalog);
  if (!move) { // same row, now answerable in more detail
    const row = state.catalog.rows[state.idx];
    showNestDetails(row);
    updateChip(row);
    renderProgressReadout(); // the row counts as reviewed from this moment
    return;
  }
  notePace();
  advance();
}

/**
 * Nest = YES. The questions in the nest-details panel only apply where there
 * is a nest, so the first press commits the yes and *stays*, opening the
 * panel; the second press moves on. A nest therefore costs two presses and a
 * non-nest stays one, which is where the volume is. Stepping back onto a row
 * already marked yes lands in the second state, so → moves on from it.
 */
function nestYes() {
  const alreadyYes = state.catalog.rows[state.idx]?.nest_label === 'yes';
  // The first press opens the panel and answers nothing, so it can't be
  // blocked. The second is the one that leaves the row, and that is where the
  // required questions are enforced.
  if (alreadyYes) {
    const missing = missingRequired();
    if (missing.length) { promptForRequired(missing); return; }
  }
  commit(true, alreadyYes);
  // Marking a nest opens the first thing it owes, rather than presenting a
  // panel of seven buttons and leaving the reviewer to remember which two
  // matter. Only on the press that opens the panel — stepping back onto a
  // half-finished nest shouldn't have a list jump out during navigation.
  if (!alreadyYes) chainToNextRequired();
}

/**
 * Save the nest-details panel before leaving the row it belongs to. The flow
 * deliberately parks the reviewer on the row they have just marked yes, so
 * moving off it with ↓ or ↑ would otherwise throw away an answer they can see
 * set on the screen. Nothing to do on a row that isn't a nest.
 */
function flushNestDetails() {
  const row = state.catalog?.rows[state.idx];
  if (row?.nest_label !== 'yes') return;
  commit(true, false); // same row, saved
}

/** Advance one item. An undecided item is recorded as a skip on the way out. */
function forward() {
  flushNestDetails();
  if (!state.catalog.isReviewed(state.idx)) {
    state.catalog.setSkip(state.idx, {
      reviewer: getReviewer(),
      notes: el.notes.value.trim(),
    });
    state.writer.schedule(state.catalog);
    notePace();
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
  flushNestDetails();
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
  await refreshExportList();
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
    `   ·   bird visible: ${s.birds}   ·   provisioning: ${s.provisioning}` +
    `   ·   substrate recorded: ${s.substrates}` +
    `   ·   location recorded: ${s.locations}` +
    `   ·   images with eggs: ${s.eggs} (${s.eggTotal} counted)` +
    `   ·   images with chicks: ${s.chicks} (${s.chickTotal} counted)`;

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
  el.saveLocal.disabled = false;
  renderSubmitTarget();
  renderLocalTarget();
  state.writer?.flush();
}

// -------------------------------------------------------------- saving out
/**
 * Write the finished files into the local folder — the same one autosave uses,
 * and the same labeled/ + labeled/nest/ shape.
 *
 * Autosave has almost certainly written this already; this is the deliberate
 * end-of-spreadsheet save, and it doubles as the way to set a local folder up
 * if someone declined the offer on first run.
 */
async function saveLocal() {
  el.submitResult.hidden = true;
  el.saveLocal.disabled = true;
  try {
    let folder = state.autosave;
    if (!folder) {
      folder = await Folder.pick(AUTOSAVE_DIR); // one activation, on the picker
      if (!folder) return;
      state.autosave = folder;
      state.mirror?.setMirror(folder);
    }
    await state.writer?.flush();
    const written = await writeFinished(folder);
    showResult('info', `Saved locally to “${folder.name}”: ${written.join(' and ')}.`);
    renderAutosaveStatus();
    renderLocalTarget();
  } catch (err) {
    noteHandledError('save local failed', err);
    showResult('error', `Couldn't save locally: ${err.message}`);
  } finally {
    el.saveLocal.disabled = false;
  }
}

/**
 * Write the finished files into the OneDrive folder, so they sync up to the
 * shared project. If no folder has been chosen yet we can't tell whether
 * OneDrive is even installed — a web page can't see the filesystem — so we show
 * the setup instructions instead of an unexplained folder picker.
 */
async function saveToOneDrive() {
  el.submitResult.hidden = true;
  el.submit.disabled = true;
  try {
    const stored = await Folder.restore(); // no activation used
    if (!stored) { el.onedriveHelp.showModal(); return; } // never set up

    const folder = await resolveFolder(stored);
    if (!folder) return; // told the user what to do next

    await state.writer?.flush();
    const written = await writeFinished(folder);
    showResult('info',
      `Saved to “${folder.name}”: ${written.join(' and ')}. ` +
      `OneDrive will sync it to the shared project shortly — open the folder ` +
      `online to confirm it arrived.`);
    await renderSubmitTarget();
  } catch (err) {
    noteHandledError('save to OneDrive failed', err);
    showResult('error', `Couldn't save to OneDrive: ${err.message}`);
  } finally {
    el.submit.disabled = false;
  }
}

/**
 * Turn a restored handle into a usable folder, spending the click's transient
 * activation on at most one thing. Both requestPermission() and the pickers
 * need that activation and the first consumes it, so they can never be chained
 * within a single click.
 */
async function resolveFolder(stored) {
  if (stored instanceof Folder) return stored;
  if (await stored.folder.requestPermission()) return stored.folder;
  await Folder.forget();
  showResult('warn',
    `Access to “${stored.folder.name}” wasn't granted, so it has been forgotten. ` +
    `Click Save to OneDrive again to choose a folder.`);
  return null;
}

const writeFinished = folder => folder.writeOutputs(state.inputName, {
  labeledText: state.catalog.labeled.serialize(),
  nestText: state.catalog.nest.serialize(),
});

function showResult(kind, message) {
  el.submitResult.className = `notice ${kind}`;
  el.submitResult.textContent = message;
  el.submitResult.hidden = false;
}

function renderLocalTarget() {
  el.localTarget.textContent = '';
  if (state.autosave) {
    const strong = document.createElement('b');
    strong.textContent = `“${state.autosave.name}”`;
    el.localTarget.append('Local folder: ', strong, ' — autosaved as you label.');
    return;
  }
  const none = document.createElement('span');
  none.className = 'none';
  none.textContent = 'not set yet';
  el.localTarget.append('Local folder: ', none, " — you'll choose it the first time.");
}

// --- the OneDrive setup dialog ---
el.onedriveHelpClose.addEventListener('click', () => el.onedriveHelp.close());
el.onedriveHelpPick.addEventListener('click', async () => {
  el.onedriveHelp.close();
  try {
    const folder = await Folder.pick(); // SUBMIT_DIR
    if (!folder) return;
    await renderSubmitTarget();
    await refreshExportList();
    announce('info', `OneDrive folder set to “${folder.name}”.`);
  } catch (err) {
    announce('error', err.message);
  }
});

el.submit.addEventListener('click', saveToOneDrive);
el.saveLocal.addEventListener('click', saveLocal);

el.reviewSkipped.addEventListener('click', startReviewSkipped);
el.doneOpenAnother.addEventListener('click', closeFile);

// -------------------------------------------------------------------- input
// Clicking a nest button does exactly what its arrow key does: commit the
// decision with the observation toggles as they stand, then advance.
for (const [node, value] of [[el.nestYes, true], [el.nestNo, false]]) {
  node.addEventListener('click', event => {
    if (!state.catalog || state.idx >= state.catalog.rows.length) return;
    if (fromPointer(event)) node.blur(); // keep arrow keys with the label loop
    if (value) nestYes(); else commit(false);
  });
}

/**
 * Focus a count box and select what's there, so typing replaces the old number
 * rather than appending to it — pressing E then 3 on a nest already marked 2
 * should mean three eggs, not twenty-three.
 */
function focusCount(field) {
  if (el.nestDetails.hidden) return; // counts are nest-only, like everything else
  const { input } = el.counters[field];
  input.focus();
  input.select();
}

for (const [field, { box, input }] of Object.entries(el.counters)) {
  box.addEventListener('click', () => focusCount(field));
  input.addEventListener('input', () => {
    refreshCounter(field);
    if (field === 'chicks') renderChickStage(); // appears once there is a chick
  });
  input.addEventListener('keydown', event => {
    // Enter and Esc both return to the label loop; Esc must not reach the
    // document handler and close the file mid-count.
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      input.blur();
      event.stopPropagation();
      return;
    }

    // Let the navigation keys work from inside the box, so counting doesn't
    // cost an extra keystroke: E, 3, → instead of E, 3, Enter, →. Only
    // non-printable keys qualify, so digits still type even if someone has
    // rebound an action to one.
    const action = actionForEvent(event, state.keys);
    if (event.key.length > 1 && ESCAPES_COUNT_BOX.has(action)) {
      event.preventDefault();
      input.blur();          // commit() reads the value, so blur first
      event.stopPropagation();
      runLabelAction(action);
      return;
    }
    event.stopPropagation();
  });
  input.addEventListener('blur', () => {
    refreshCounter(field);
    if (field === 'chicks') renderChickStage();
  });
}


// The pickers' own keys. The filter box has focus while one is open, so the
// document handler ignores everything — these are the only keys that matter.
for (const name of PICKER_NAMES) {
  const node = el.pickers[name];

  node.button.addEventListener('click', () => {
    if (state.openPicker === name) closePicker(); else openPicker(name);
  });

  node.filter.addEventListener('input', () => {
    state.pickerCursor = -1; // the list underneath it just changed
    renderPickerList();
  });

  node.filter.addEventListener('keydown', event => {
    event.stopPropagation(); // never let a filter keystroke reach the label loop

    if (event.key === 'Escape') { // close, recording nothing further
      event.preventDefault();
      closePicker();
      return;
    }

    // Up and down walk the list. While a list is open the arrows belong to it,
    // not to the label loop: moving to the next image out from under a
    // half-answered question was never what the reviewer meant, and a list you
    // can only reach with digits or by typing is a list you can't browse.
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const last = state.pickerRows.length - 1;
      if (last < 0) return;
      state.pickerCursor = event.key === 'ArrowDown'
        ? Math.min(state.pickerCursor + 1, last)
        // Up off the top returns to no selection, so Enter goes back to
        // meaning "done" rather than trapping you on the first row.
        : Math.max(state.pickerCursor - 1, -1);
      renderPickerList();
      return;
    }

    // In the location list, left and right switch between the natural and the
    // man-made places — answering the structure question from inside the list
    // it decides. Everywhere else they are left alone to move the caret, which
    // is what a text box should do.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (name !== 'nest_location') return;
      event.preventDefault();
      switchLocationList();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const typed = node.filter.value.trim();
      // Whatever the arrows have walked to wins: it is the thing highlighted
      // on screen, so it is what Enter is visibly offering.
      if (state.pickerCursor >= 0) {
        confirmTerm(state.pickerRows[state.pickerCursor]);
        return;
      }
      // Nothing typed means there is no match being offered, so Enter is
      // "done" rather than "take the first one". That is what finishes a
      // multi-select list — picking clears the filter each time, so the
      // gesture is E, 1, 2, Enter — and it stops a bare Enter on a
      // single-select list quietly recording whatever happens to be at the
      // top. Esc still closes and records nothing further.
      if (!typed) {
        closePicker();
        if (REQUIRED_PICKERS.includes(name)) chainToNextRequired();
        return;
      }
      // The first match is the offer; with no matches at all, what was typed is
      // the answer — that is the "other, type it in" path, and it needs no
      // separate control.
      confirmTerm(state.pickerRows[0] || typed);
      return;
    }

    // Digits pick, but only from the unnumbered full list: once there is a
    // filter, a digit is part of what is being typed.
    if (/^[1-9]$/.test(event.key) && node.filter.value.trim() === '') {
      const pick = state.pickerRows[Number(event.key) - 1];
      if (pick) {
        event.preventDefault();
        confirmTerm(pick);
      }
      return;
    }

  });
}

el.chickStage.addEventListener('click', event => {
  cycleChickStage();
  if (fromPointer(event)) el.chickStage.blur(); // arrows back to the label loop
});

for (const [field, node] of Object.entries(el.toggles)) {
  node.addEventListener('click', event => {
    if (NEST_ONLY_TOGGLES.has(field) && el.nestDetails.hidden) return;
    setToggle(field, !toggleOn(field));
    if (fromPointer(event)) node.blur(); // keep arrow keys with the label loop
    afterToggle(field);
    if (NEST_ONLY_TOGGLES.has(field)) saveOpenRow();
  });
}

/**
 * Notes are the exception, so the box sits at one line and gives the height to
 * the photo — but it opens whenever it holds something, so stepping back to an
 * item never hides a note. Driven from here rather than :placeholder-shown,
 * which doesn't reliably recalculate when the value is set programmatically,
 * and setting it programmatically is exactly what showing a row does.
 */
function refreshNotesSize() {
  el.notes.classList.toggle('filled', el.notes.value.trim() !== '');
}

el.notes.addEventListener('input', refreshNotesSize);
el.notes.addEventListener('blur', refreshNotesSize);

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
  if (el.prefs.open || el.jump.open || el.report.open || el.onedriveHelp.open
      || el.dupes.open) return;
  if (pickerOpen()) return; // the picker owns the keyboard while it is open
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  // Enter and Space on a focused button belong to that button — the browser
  // turns them into a click. Without this they would also run whatever the
  // label loop binds them to, so tabbing to a picker and pressing Enter would
  // open the list and jump to the notes box at the same time.
  if (target instanceof HTMLButtonElement
      && (event.key === 'Enter' || event.key === ' ')) return;

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
  runLabelAction(action);
});

function runLabelAction(action) {
  if (action in TOGGLE_ACTIONS) {
    const field = TOGGLE_ACTIONS[action];
    // A nest-details key does nothing until the row is a nest: the panel is
    // hidden, so flipping it would set a value nobody can see.
    if (NEST_ONLY_TOGGLES.has(field) && el.nestDetails.hidden) return;
    setToggle(field, !toggleOn(field));
    afterToggle(field);
    if (NEST_ONLY_TOGGLES.has(field)) saveOpenRow();
  } else if (action in PICKER_ACTIONS) {
    openPicker(PICKER_ACTIONS[action]);
  } else if (action === 'cycle_chick_stage' || action === 'cycle_chick_stage_num') {
    cycleChickStage();
  } else if (action === 'zoom') {
    setZoom(!state.zoomed);
  } else if (action === 'jump') {
    openJump();
  } else if (action in COUNTER_ACTIONS) {
    focusCount(COUNTER_ACTIONS[action]);
  } else if (action === 'notes') {
    el.notes.focus();
  } else if (action === 'back') {
    goBack();
  } else if (action === 'forward') {
    forward();
  } else if (action === 'nest_yes') {
    nestYes();
  } else if (action === 'nest_no') {
    commit(false);
  }
}

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
  renderCounterLabels();
  if (state.catalog) showCurrent();
});

el.prefsWelcome.addEventListener('click', openPrefs);

// Link the protocol only if we have a URL for it — a dead link is worse than
// naming the document and letting someone ask for it.
if (PROTOCOL_URL) {
  const ref = $('protocol-ref');
  if (ref) {
    const link = document.createElement('a');
    link.href = PROTOCOL_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'project protocol';
    ref.replaceWith(link);
  }
}

// --------------------------------------------------------------- jump to it
/**
 * Reaching a known item used to mean pressing back a hundred times. Accepts a
 * row number or an ML catalog number, because which one someone has to hand
 * depends on whether they're looking at the app or the spreadsheet.
 */
function openJump() {
  if (!state.catalog) return;
  el.jumpError.hidden = true;
  el.jumpInput.value = '';
  const skipped = state.catalog.skippedIndices().length;
  el.jumpSkipped.textContent = skipped
    ? `First skipped (${skipped})` : 'No skipped items';
  el.jumpSkipped.disabled = skipped === 0;
  el.jump.showModal();
  el.jumpInput.focus();
}

function goToIndex(index) {
  state.reviewingSkipped = false;
  state.reviewHistory = [];
  state.idx = Math.max(0, Math.min(index, state.catalog.rows.length));
  el.jump.close();
  showCurrent();
}

function resolveJump(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { error: 'Type a row number or an ML catalog number.' };
  if (!/^\d+$/.test(text)) return { error: 'Numbers only — a row number or an ML catalog number.' };

  const total = state.catalog.rows.length;
  const asRow = Number(text);

  // An ML number search first when it can't be a row: catalog numbers are long,
  // row numbers are small, so only the small range is ambiguous.
  const byMl = state.catalog.rows.findIndex(r => String(r[CATALOG_KEY]) === text);
  if (byMl !== -1) return { index: byMl };
  if (asRow >= 1 && asRow <= total) return { index: asRow - 1 };

  return {
    error: asRow > total
      ? `This spreadsheet has ${total} items, and no ML ${text} in it.`
      : `No ML ${text} in this spreadsheet.`,
  };
}

function submitJump() {
  const { index, error } = resolveJump(el.jumpInput.value);
  if (error) {
    el.jumpError.textContent = error;
    el.jumpError.hidden = false;
    return;
  }
  goToIndex(index);
}

on(el.progress, 'click', openJump);
on(el.jumpGo, 'click', submitJump);
on(el.jumpCancel, 'click', () => el.jump.close());
on(el.jumpInput, 'keydown', event => {
  event.stopPropagation();
  if (event.key === 'Enter') { event.preventDefault(); submitJump(); }
});
on(el.jumpUnreviewed, 'click', () => goToIndex(state.catalog.firstUnreviewed()));
on(el.jumpSkipped, 'click', () => {
  const skipped = state.catalog.skippedIndices();
  if (skipped.length) goToIndex(skipped[0]);
});

// ----------------------------------------------------- identify duplicates
// One nest is often photographed ten times in a burst, and again a month
// later. The reviewer is the one who recognises it — no comparison of pixels
// is going to beat someone who has just looked at both — so the app's job is
// to put the candidates in front of them and record what they say.
//
// Every tile carries the recordist and the coordinates, because that is the
// evidence: the same eBirder standing in the same place is most of what makes
// two photographs probably one nest. The filters default to the first of those
// for the same reason.

/** Metres between two coordinates. Flat-earth maths, fine at this range. */
function metresApart(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return Infinity;
  const mPerDeg = 111_320;
  const dy = (a.lat - b.lat) * mPerDeg;
  const dx = (a.lon - b.lon) * mPerDeg * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  return Math.hypot(dx, dy);
}

const coordsOf = row => ({
  lat: Number.parseFloat(row?.Latitude), lon: Number.parseFloat(row?.Longitude),
});

/** The rows worth showing, given the filters and what the reviewer typed. */
function dupeCandidates() {
  const rows = state.catalog?.rows ?? [];
  const here = rows[state.idx];
  if (!here) return [];
  const query = el.dupesSearch.value.trim().toLowerCase();
  const home = coordsOf(here);
  return rows.map((row, i) => ({ row, i })).filter(({ row, i }) => {
    if (i === state.idx || state.dupePicks.has(i)) return true; // never hide these
    if (el.dupesSameRecordist.checked
        && (row.Recordist ?? '') !== (here.Recordist ?? '')) return false;
    if (el.dupesSamePlace.checked && metresApart(coordsOf(row), home) > 100) return false;
    if (!query) return true;
    return [row[CATALOG_KEY], row.Date, row.Locality, row.Recordist, row.nest_id]
      .some(v => String(v ?? '').toLowerCase().includes(query));
  });
}

function renderDupes() {
  const candidates = dupeCandidates();
  el.dupesGrid.textContent = '';
  for (const { row, i } of candidates) {
    const mlId = row[CATALOG_KEY];
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'dupe' + (i === state.idx ? ' current' : '');
    tile.setAttribute('aria-pressed', String(state.dupePicks.has(i)));

    const img = document.createElement('img');
    img.loading = 'lazy';              // an export runs to a couple of hundred
    img.alt = '';
    img.src = photoUrl(mlId, 320);
    tile.append(img);

    const meta = document.createElement('div');
    meta.className = 'dupe-meta';
    const who = document.createElement('b');
    who.textContent = row.Recordist || 'unknown recordist';
    const lat = Number.parseFloat(row.Latitude);
    const lon = Number.parseFloat(row.Longitude);
    const where = Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'no coordinates';
    meta.append(who, document.createElement('br'),
                `${row.Date || 'no date'}`, document.createElement('br'), where);
    tile.append(meta);

    const id = document.createElement('div');
    id.className = 'dupe-id';
    // An unreviewed row can be grouped, but the grouping only reaches the file
    // when the row is labeled — the labeled file is completed entries, and
    // putting an unreviewed row in it would hand the project a row nobody has
    // looked at. Saying so on the tile beats surprising anyone later.
    const pending = row.reviewed !== REVIEWED ? ' · not reviewed yet' : '';
    id.textContent = (row.nest_id ? `ML ${mlId} · ${row.nest_id}` : `ML ${mlId}`)
      + pending;
    tile.append(id);

    tile.addEventListener('click', () => {
      if (state.dupePicks.has(i)) state.dupePicks.delete(i);
      else state.dupePicks.add(i);
      renderDupes();
    });
    el.dupesGrid.append(tile);
  }
  el.dupesCount.textContent =
    `${state.dupePicks.size} selected · ${candidates.length} shown`;

  // A filter that hides everything looks like a broken screen rather than an
  // answer, and "no other assets by this recordist" is a real answer worth
  // saying out loud — with the way out attached to it.
  const filtered = el.dupesSameRecordist.checked || el.dupesSamePlace.checked;
  if (candidates.length <= state.dupePicks.size && filtered) {
    const empty = document.createElement('div');
    empty.className = 'dupes-empty';
    empty.append('Nothing else matches those filters. ');
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'link-btn';
    all.textContent = 'show the whole spreadsheet';
    all.addEventListener('click', () => {
      el.dupesSameRecordist.checked = false;
      el.dupesSamePlace.checked = false;
      renderDupes();
    });
    empty.append(all);
    el.dupesGrid.append(empty);
  }
}

function openDupes() {
  if (!state.catalog || state.idx >= state.catalog.rows.length) return;
  const row = state.catalog.rows[state.idx];
  // Reopening a nest that already has a group starts from that group, so this
  // is how you add a twelfth photograph to eleven rather than starting again.
  const existing = row.nest_id ? state.catalog.nestGroup(row.nest_id) : [];
  state.dupePicks = new Set([state.idx, ...existing]);
  el.dupesSearch.value = '';
  renderDupes();
  el.dupes.showModal();
}

function saveDupes() {
  const picks = [...state.dupePicks].sort((a, b) => a - b);
  const later = picks.filter(i => state.catalog.rows[i].reviewed !== REVIEWED).length;
  const id = state.catalog.setNestGroup(picks);
  state.writer.schedule(state.catalog);
  el.dupes.close();
  showCurrent();
  const saved = picks.length - later;
  announce('info',
    `${picks.length} assets marked as nest ${id}.`
    + (later ? ` ${saved} saved now; the other ${later} save when you review them.`
             : ''));
}

function ungroupDupes() {
  const picks = [...state.dupePicks];
  state.catalog.clearNestGroup(picks);
  state.writer.schedule(state.catalog);
  el.dupes.close();
  showCurrent();
  announce('info', 'Grouping cleared — each nest has its own code again.');
}

el.dupesOpen.addEventListener('click', openDupes);
el.dupesCancel.addEventListener('click', () => el.dupes.close());
el.dupesSave.addEventListener('click', saveDupes);
el.dupesUngroup.addEventListener('click', ungroupDupes);
el.dupesSearch.addEventListener('input', renderDupes);
el.dupesSameRecordist.addEventListener('change', renderDupes);
el.dupesSamePlace.addEventListener('change', renderDupes);

// --------------------------------------------------------------- reporting
/**
 * Gather what makes a report actionable. Names and positions only — never any
 * cell contents, and folder leaf names are all a browser exposes anyway.
 */
async function reportContext() {
  let progressCount = '?';
  try {
    progressCount = (await Progress.list()).length;
  } catch { /* storage may be blocked */ }
  return {
    version: VERSION,
    build: (BUILD.startsWith('__') ? 'dev' : BUILD) + (IS_DEV ? ' [dev preview]' : ''),
    reviewer: getReviewer(),
    inputName: state.inputName,
    position: state.catalog
      ? `row ${state.idx + 1} of ${state.catalog.rows.length}` +
        (state.reviewingSkipped ? ' (reviewing skipped)' : '')
      : '',
    saveState: el.saveState.textContent,
    localFolder: state.autosave?.name ?? '',
    submitFolder: (await Folder.restore().catch(() => null))?.name
      ?? (await Folder.restore().catch(() => null))?.folder?.name ?? '',
    progressCount,
    answers: currentAnswers(),
  };
}

const currentAnswers = () => ({
  doing: el.reportDoing?.value ?? '',
  wrong: el.reportWrong?.value ?? '',
  repeats: el.reportRepeats?.value ?? '',
});

async function refreshReportText() {
  el.reportText.textContent = buildReport(await reportContext());
  validateReport();
}

/**
 * The diagnostics describe what the app was doing; only the researcher can say
 * what they were doing and what they saw instead. A report without that usually
 * can't be acted on, so copying waits until all three are answered.
 */
function validateReport() {
  const missing = missingAnswers(currentAnswers());
  el.reportCopy.disabled = missing.length > 0;
  if (!missing.length) {
    if (el.reportStatus.dataset.role === 'validation') el.reportStatus.hidden = true;
    return;
  }
  el.reportStatus.dataset.role = 'validation';
  el.reportStatus.className = 'notice warn';
  el.reportStatus.textContent = `Still to answer: ${missing.join(', ')}.`;
  el.reportStatus.hidden = false;
}

async function openReport() {
  el.reportStatus.hidden = true;
  delete el.reportStatus.dataset.role;
  // Pre-fill what the app already knows, so a crash needs one sentence, not three.
  const err = lastError();
  if (err && !el.reportWrong.value) el.reportWrong.value = err.message;
  await refreshReportText();
  if (!el.report.open) el.report.showModal();
  (el.reportDoing.value ? el.reportWrong : el.reportDoing).focus();
}

for (const node of [el.reportDoing, el.reportWrong, el.reportRepeats]) {
  on(node, 'input', () => { refreshReportText(); });
  on(node, 'change', () => { refreshReportText(); });
  // Enter inside the dialog must not reach the label loop behind it.
  on(node, 'keydown', event => event.stopPropagation());
}
on(el.reportOpen, 'click', openReport);
on(el.reportClose, 'click', () => el.report.close());

on(el.reportCopy, 'click', async () => {
  const text = el.reportText.textContent;
  const copied = await copyText(text);
  delete el.reportStatus.dataset.role;
  el.reportStatus.className = `notice ${copied ? 'info' : 'warn'}`;
  el.reportStatus.textContent = copied
    ? 'Copied. Paste it straight into an email to Stella — the first line is a ' +
      'ready-made subject.'
    : "Couldn't copy automatically — select the text above and copy it by hand.";
  el.reportStatus.hidden = false;
});

/** Something broke: say so, say the work is safe, and offer to report it. */
function onCaughtError(err) {
  flagErrors();
  if (el.reportLabel) {
    el.reportLabel.textContent = `Something went wrong — report it (${errorCount()})`;
  }
  if (state.catalog) {
    alertBanner(`Something went wrong: ${err.message}. Your labeling is still saved — ` +
                `use “Report a problem” at the bottom of the screen.`);
  }
}

installErrorHandlers(onCaughtError);

// A failed save is the one error the app already handles gracefully, so it
// never reaches window.onerror — record it too, or reports would omit exactly
// the failure most worth hearing about.
export function noteHandledError(where, err) {
  recordError(where, err?.message ?? String(err), err?.stack ?? '');
  flagErrors();
}

function flagErrors() {
  if (el.reportOpen) el.reportOpen.dataset.errors = 'true';
  if (el.reportLabel && errorCount()) {
    el.reportLabel.textContent = `Something went wrong — report it (${errorCount()})`;
  }
}

// --------------------------------------------------------------------- boot
renderToggleLabels();
renderNestLabels();
renderCounterLabels();
initWelcome();
