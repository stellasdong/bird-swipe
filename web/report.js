// Crash catching and problem reports.
//
// The app is a static page with no server, so nothing is logged anywhere by
// default: an error lands in a console the researcher will never open, and the
// likely response is to close the tab and say nothing. This module makes
// failures visible and turns them into a report worth acting on — "it crashed"
// is not actionable; a build SHA, a browser, a row number and a stack are.
//
// Nothing here sends anything on its own. buildReport() returns text; how it
// travels is the caller's business.

const MAX_ERRORS = 5;
const recent = [];

/** Record a failure. Kept in memory and mirrored to sessionStorage. */
export function recordError(kind, message, detail = '') {
  recent.unshift({
    at: new Date().toISOString(),
    kind,
    message: String(message ?? '').slice(0, 500),
    detail: String(detail ?? '').split('\n').slice(0, 6).join('\n').slice(0, 800),
  });
  recent.length = Math.min(recent.length, MAX_ERRORS);
  try {
    sessionStorage.setItem('bird-swipe:errors', JSON.stringify(recent));
  } catch { /* storage can be blocked; the in-memory copy still works */ }
}

export const errorCount = () => recent.length;
export const lastError = () => recent[0] ?? null;
export const clearErrors = () => { recent.length = 0; };

/**
 * Catch what would otherwise vanish. `onError` fires so the UI can offer to
 * report it; a failure here must never itself break labeling.
 */
export function installErrorHandlers(onError) {
  const report = (kind, message, detail) => {
    try {
      recordError(kind, message, detail);
      onError?.(lastError());
    } catch { /* never let the error handler throw */ }
  };

  window.addEventListener('error', event => {
    if (event.message) {
      report('error', event.message,
             `${event.filename ?? ''}:${event.lineno ?? ''}\n${event.error?.stack ?? ''}`);
    }
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    report('unhandled promise', reason?.message ?? String(reason), reason?.stack ?? '');
  });
}

/**
 * A plain-text report. Deliberately excludes any spreadsheet contents — only
 * the file's name, where the reviewer was in it, and folder names (a browser
 * exposes a folder's leaf name, never its full path).
 */
export function buildReport(context = {}) {
  const lines = [
    `bird-swipe problem report`,
    `when      : ${new Date().toISOString()}`,
    `version   : ${context.version ?? '?'} (${context.build ?? 'dev'})`,
    `page      : ${location.href.split('?')[0]}`,
    `browser   : ${navigator.userAgent}`,
    `screen    : ${window.innerWidth}x${window.innerHeight}`,
    `online    : ${navigator.onLine}`,
    '',
    `reviewer  : ${context.reviewer || '(not set)'}`,
    `file      : ${context.inputName || '(none open)'}`,
    `position  : ${context.position || '-'}`,
    `save state: ${context.saveState || '-'}`,
    `local dir : ${context.localFolder || '(not set)'}`,
    `onedrive  : ${context.submitFolder || '(not set)'}`,
    `in progress: ${context.progressCount ?? '?'} spreadsheet(s) held in this browser`,
  ];

  if (context.note) lines.push('', 'what happened:', context.note.trim());

  if (recent.length) {
    lines.push('', `errors (most recent first, ${recent.length}):`);
    for (const e of recent) {
      lines.push(`  [${e.at}] ${e.kind}: ${e.message}`);
      if (e.detail) lines.push(...e.detail.split('\n').map(l => `      ${l}`));
    }
  } else {
    lines.push('', 'errors: none captured — the problem may not have thrown.');
  }
  return lines.join('\n');
}

/** Copy text, falling back to a manual selection when the API is unavailable. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
