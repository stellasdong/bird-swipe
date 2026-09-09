// Macaulay Library asset URLs.
//
// Port of bird_swipe/core/macaulay.py. Only the URL builders survive: the
// browser's HTTP cache replaces the module's disk cache, and <img>/<video>
// replace fetch_photo entirely. These patterns are undocumented and could
// change; if media stops loading, this is the one file to fix.

const CDN = 'https://cdn.download.ams.birds.cornell.edu/api/v2/asset';
const CDN_V1 = 'https://cdn.download.ams.birds.cornell.edu/api/v1/asset';
const SITE = 'https://macaulaylibrary.org/asset';

export const PHOTO_SIZE_DEFAULT = 1200;
export const PHOTO_SIZE_HIGH = 2400;

/** The human reference page for an asset. */
export const assetPageUrl = mlId => `${SITE}/${mlId}`;

/** Direct JPEG URL (also the poster frame for a video asset). */
export const photoUrl = (mlId, size = PHOTO_SIZE_DEFAULT) => `${CDN}/${mlId}/${size}`;

/**
 * Direct MP4 URL. Uses the CDN's v1 API — the v2 path returns only a poster
 * JPEG for video assets. Serves `video/mp4` with byte-range support, so a
 * plain <video> element streams and seeks it natively.
 */
export const videoUrl = mlId => `${CDN_V1}/${mlId}/mp4`;
