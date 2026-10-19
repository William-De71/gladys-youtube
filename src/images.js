// -----------------------------------------------------------------------------
// Thumbnails of the widgets.
//
// A widget refers to an image by a key (`^[a-z0-9][a-z0-9-]{0,63}$`); the core
// asks for its bytes through onWidgetGetImage and caches them one hour per
// key. A video id has upper-case letters and "_": the key carries it in
// hexadecimal ("yt-" + 22 hex digits), so the handler rebuilds the thumbnail
// URL from the key alone — after a restart too — and can only ever fetch a
// YouTube thumbnail (i.ytimg.com), never an arbitrary URL.
//
// The thumbnail is the 320 × 180 JPEG of YouTube (`mqdefault`, 16:9, about
// 10 to 30 KB): far under the 300 KB the core accepts, never resized.
// -----------------------------------------------------------------------------

import { VIDEO_ID } from './youtube-api.js';

const KEY_REGEX = /^yt-([0-9a-f]{22})$/;
// The core refuses an image above this size (decoded).
const MAX_IMAGE_BYTES = 300 * 1024;

/**
 * @description The widget image key of a video.
 * @param {string} videoId - The video id (11 characters).
 * @returns {string|null} The key, null for an invalid id.
 * @example
 * imageKeyOf('dQw4w9WgXcQ'); // -> 'yt-6451773477395767586351'
 */
function imageKeyOf(videoId) {
  if (!VIDEO_ID.test(String(videoId ?? ''))) return null;
  return `yt-${Buffer.from(videoId, 'latin1').toString('hex')}`;
}

/**
 * @description The video id of a widget image key.
 * @param {string} key - The key.
 * @returns {string|null} The video id, null for a key this integration never produced.
 */
function videoIdOfKey(key) {
  const match = KEY_REGEX.exec(String(key ?? ''));
  if (!match) return null;
  const id = Buffer.from(match[1], 'hex').toString('latin1');
  return VIDEO_ID.test(id) ? id : null;
}

export { MAX_IMAGE_BYTES, imageKeyOf, videoIdOfKey };
