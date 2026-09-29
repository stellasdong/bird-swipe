// Macaulay Library asset URLs.
//
// Port of bird_swipe/core/macaulay.py. Only the URL builders survive: the
// browser's HTTP cache replaces the module's disk cache, and <img>/<video>
// replace fetch_photo entirely. These patterns are undocumented and could
// change; if media stops loading, this is the one file to fix.

const CDN = 'https://cdn.download.ams.birds.cornell.edu/api/v2/asset';
const CDN_V1 = 'https://cdn.download.ams.birds.cornell.edu/api/v1/asset';
const SITE = 'https://macaulaylibrary.org/asset';
// Not Macaulay, but the same institution and the same job: the export carries
// the eBird checklist an asset came from, and one click gets the reviewer the
// whole outing rather than the S-number.
const EBIRD_CHECKLIST = 'https://ebird.org/checklist';

export const PHOTO_SIZE_DEFAULT = 1200;
export const PHOTO_SIZE_HIGH = 2400;

/** The human reference page for an asset. */
export const assetPageUrl = mlId => `${SITE}/${mlId}`;

/**
 * The eBird checklist an asset was submitted with. Blank in, blank out: plenty
 * of Macaulay rows have no checklist, and a link to nowhere is worse than no
 * link.
 */
export const checklistUrl = id => {
  const s = String(id ?? '').trim();
  return s ? `${EBIRD_CHECKLIST}/${s}` : '';
};

/** Direct JPEG URL (also the poster frame for a video asset). */
export const photoUrl = (mlId, size = PHOTO_SIZE_DEFAULT) => `${CDN}/${mlId}/${size}`;

/**
 * Direct MP4 URL. Uses the CDN's v1 API — the v2 path returns only a poster
 * JPEG for video assets. Serves `video/mp4` with byte-range support, so a
 * plain <video> element streams and seeks it natively.
 */
export const videoUrl = mlId => `${CDN_V1}/${mlId}/mp4`;
