// Shared fixtures of the tests: two channels, their RSS feeds and Data API
// answers, a fake fetch routed by URL, a silent logger. Tests never touch
// the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THUMBNAIL = readFileSync(new URL('../fixtures/thumbnail.jpg', import.meta.url));

const silent = { info() {}, warn() {}, error() {}, debug() {} };

// Only what the device builders use from the SDK client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

const DEV = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Google for Developers',
  handle: '@googledevelopers',
  uploads: 'UU_x5XG1OV2P6uZZ5FSM9Ttw',
};
const MUSIC = {
  id: 'UC-9-kyTW8ZkZNDHQJ6FgpwQ',
  title: 'Music',
  handle: '@music',
  uploads: 'UU-9-kyTW8ZkZNDHQJ6FgpwQ',
};

/**
 * @description A temporary directory for the /data files.
 * @returns {{ state: string, usage: string }} The paths (the files do not exist).
 */
function dataPaths() {
  const dir = mkdtempSync(join(tmpdir(), 'youtube-'));
  return { state: join(dir, 'state.json'), usage: join(dir, 'usage.json') };
}

/**
 * @description An RSS feed (Atom) of a channel.
 * @param {string} channelId - The channel.
 * @param {Array<{ id: string, title: string, published: string, short?: boolean }>} entries - Newest first.
 * @returns {string} The XML.
 */
function feedXml(channelId, entries) {
  const items = entries
    .map(
      (e) => `
 <entry>
  <id>yt:video:${e.id}</id>
  <yt:videoId>${e.id}</yt:videoId>
  <yt:channelId>${channelId}</yt:channelId>
  <title>${e.title}</title>
  <link rel="alternate" href="https://www.youtube.com/${e.short ? `shorts/${e.id}` : `watch?v=${e.id}`}"/>
  <published>${e.published}</published>
  <updated>${e.published}</updated>
 </entry>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <id>yt:channel:${channelId.slice(2)}</id>
 <title>Channel</title>${items}
</feed>`;
}

/**
 * @description A channels.list item.
 * @param {object} channel - The channel.
 * @param {object} [stats] - statistics overrides.
 * @returns {object} The resource.
 */
function channelItem(channel, stats = {}) {
  return {
    id: channel.id,
    snippet: {
      title: channel.title,
      customUrl: channel.handle,
      thumbnails: { high: { url: 'https://yt3.ggpht.com/x=s800' } },
    },
    contentDetails: { relatedPlaylists: { uploads: channel.uploads } },
    statistics: {
      viewCount: '6510000000',
      subscriberCount: '2490000',
      hiddenSubscriberCount: false,
      videoCount: '6789',
      ...stats,
    },
  };
}

/**
 * @description A videos.list item.
 * @param {string} id - The video id.
 * @param {object} [values] - Overrides: title, published, duration, live, scheduled, started, channelId.
 * @returns {object} The resource.
 */
function videoItem(id, values = {}) {
  const live = values.live ?? 'none';
  return {
    id,
    snippet: {
      channelId: values.channelId ?? DEV.id,
      title: values.title ?? `Video ${id}`,
      publishedAt: values.published ?? '2026-10-19T16:00:00Z',
      liveBroadcastContent: live,
    },
    contentDetails: { duration: values.duration ?? 'PT12M5S' },
    ...(values.scheduled || values.started
      ? {
          liveStreamingDetails: {
            ...(values.scheduled ? { scheduledStartTime: values.scheduled } : {}),
            ...(values.started ? { actualStartTime: values.started } : {}),
          },
        }
      : {}),
  };
}

const keyError = {
  status: 400,
  body: {
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      errors: [{ message: 'API key not valid.', domain: 'global', reason: 'badRequest' }],
      status: 'INVALID_ARGUMENT',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'API_KEY_INVALID',
          domain: 'googleapis.com',
        },
      ],
    },
  },
};

const quotaError = {
  status: 403,
  body: {
    error: {
      code: 403,
      message: 'The request cannot be completed because you have exceeded your quota.',
      errors: [{ message: 'quota', domain: 'youtube.quota', reason: 'quotaExceeded' }],
    },
  },
};

/**
 * @description A fake YouTube: a mutable world answered by URL, recording
 * every request.
 * @returns {Function & { calls: object[], world: object }} The fetch.
 */
function fakeYouTube() {
  const world = {
    channels: new Map([
      [DEV.id, channelItem(DEV)],
      [MUSIC.id, channelItem(MUSIC, { subscriberCount: '120000000' })],
    ]),
    handles: new Map([
      ['@googledevelopers', DEV.id],
      ['@youtube', DEV.id],
    ]),
    feeds: new Map([
      [
        DEV.id,
        [
          {
            id: 'LJ2v4-FvPcA',
            title: 'Builders &amp; Gemini',
            published: '2026-10-16T21:00:00+00:00',
            short: true,
          },
          {
            id: 'i3X7Fv0Z3Uc',
            title: 'Gemini in Android Studio',
            published: '2026-10-15T19:00:22+00:00',
          },
        ],
      ],
      [MUSIC.id, [{ id: 'aaaaaaaaaaa', title: 'Song', published: '2026-10-14T10:00:00+00:00' }]],
    ]),
    videos: new Map(),
    feedStatus: 200,
    apiError: null,
    shorts: new Set(),
  };
  const calls = [];
  const reply = (status, body, text) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text ?? JSON.stringify(body),
    arrayBuffer: async () =>
      THUMBNAIL.buffer.slice(THUMBNAIL.byteOffset, THUMBNAIL.byteOffset + THUMBNAIL.length),
  });
  const impl = async (raw, options = {}) => {
    const url = new URL(raw);
    calls.push({ url, method: options.method ?? 'GET', headers: options.headers ?? {} });
    if (url.hostname === 'www.googleapis.com') {
      if (world.apiError) return reply(world.apiError.status, world.apiError.body);
      const resource = url.pathname.split('/').pop();
      const params = url.searchParams;
      if (resource === 'channels') {
        let ids = (params.get('id') ?? '').split(',').filter(Boolean);
        if (params.get('forHandle')) {
          ids = [world.handles.get(params.get('forHandle').toLowerCase())].filter(Boolean);
        }
        return reply(200, { items: ids.map((id) => world.channels.get(id)).filter(Boolean) });
      }
      if (resource === 'videos') {
        const ids = (params.get('id') ?? '').split(',');
        return reply(200, {
          items: ids
            .map((id) => {
              if (world.videos.has(id)) return world.videos.get(id);
              // By default, the video as its feed shows it.
              const [channelId, entry] =
                [...world.feeds.entries()]
                  .map(([cid, entries]) => [cid, entries.find((e) => e.id === id)])
                  .find(([, e]) => e) ?? [];
              return entry
                ? videoItem(id, {
                    channelId,
                    title: entry.title.replace(/&amp;/g, '&'),
                    published: entry.published,
                    duration: entry.short ? 'PT42S' : 'PT12M5S',
                  })
                : videoItem(id);
            })
            .filter(Boolean),
        });
      }
      if (resource === 'playlistItems') {
        const channelId = `UC${params.get('playlistId').slice(2)}`;
        return reply(200, {
          items: (world.feeds.get(channelId) ?? []).map((e) => ({
            snippet: { title: e.title, resourceId: { videoId: e.id } },
            contentDetails: { videoId: e.id, videoPublishedAt: e.published },
          })),
        });
      }
      return reply(404, {});
    }
    if (url.pathname === '/feeds/videos.xml') {
      const id = url.searchParams.get('channel_id');
      if (world.feedStatus !== 200) return reply(world.feedStatus, null, 'Not Found');
      return reply(200, null, feedXml(id, world.feeds.get(id) ?? []));
    }
    if (url.pathname.startsWith('/shorts/')) {
      return reply(world.shorts.has(url.pathname.split('/').pop()) ? 200 : 303, null, '');
    }
    if (url.hostname === 'i.ytimg.com') return reply(200, null, '');
    return reply(404, null, '');
  };
  impl.calls = calls;
  impl.world = world;
  return impl;
}

export {
  THUMBNAIL,
  silent,
  fakeGladys,
  DEV,
  MUSIC,
  dataPaths,
  feedXml,
  channelItem,
  videoItem,
  keyError,
  quotaError,
  fakeYouTube,
};
