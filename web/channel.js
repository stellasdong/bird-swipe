// Which copy of the app is running: the real one, or the dev preview.
//
// Both are served from the same GitHub Pages origin (the preview lives at
// /bird-swipe/dev/), and localStorage and IndexedDB are scoped to the origin,
// not the path. Without this, trying something out on the preview would share
// one settings blob and one progress database with a researcher's real,
// half-labeled spreadsheets. So the preview scopes both of its stores.
//
// localhost is its own origin already, so a local server is unaffected either
// way and keeps the unscoped names.
export const IS_DEV = location.pathname.includes('/dev/');

/** Storage name for this copy of the app: unchanged in production. */
export const scoped = name => (IS_DEV ? `${name}-dev` : name);
