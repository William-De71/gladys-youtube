// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets on made-up channels (no real channel, no real
// thumbnail: the thumbnails are drawn gradients), on a fixed evening
// (Tuesday 20 October 2026, 20:30 in Paris): the latest videos, one channel,
// the quota of the day.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildLatestVideosWidget, buildChannelWidget, buildQuotaWidget } =
  await load('src/widgets.js');
const { imageKeyOf } = await load('src/images.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const NOW = Date.parse('2026-10-20T18:30:00Z');
const TZ = 'Europe/Paris';
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

const WORKSHOP = {
  id: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Atelier du Bois',
  handle: '@atelierdubois',
  uploads: 'UUaaaaaaaaaaaaaaaaaaaaaa',
};
const KITCHEN = {
  id: 'UCbbbbbbbbbbbbbbbbbbbbbb',
  title: 'Sunday Kitchen',
  handle: '@sundaykitchen',
  uploads: 'UUbbbbbbbbbbbbbbbbbbbbbb',
};
const SPACE = {
  id: 'UCcccccccccccccccccccccc',
  title: 'Orbit Lab',
  handle: '@orbitlab',
  uploads: 'UUcccccccccccccccccccccc',
};

const TITLES = {
  en: [
    'Launch window: live from the pad',
    'Building a walnut bench, start to finish',
    'One-pan lasagna in 30 minutes',
    'Sharpening a chisel in 60 seconds',
    'How a heat shield survives re-entry',
    'Sourdough for beginners',
  ],
  fr: [
    'Fenêtre de tir : en direct du pas de tir',
    'Un banc en noyer, de A à Z',
    'Lasagnes en une poêle en 30 minutes',
    'Affûter un ciseau en 60 secondes',
    'Comment un bouclier thermique survit',
    'Le pain au levain pour débuter',
  ],
  de: [
    'Startfenster: live von der Rampe',
    'Eine Bank aus Nussbaum, von A bis Z',
    'Lasagne aus einer Pfanne in 30 Minuten',
    'Ein Stecheisen in 60 Sekunden schärfen',
    'Wie ein Hitzeschild den Wiedereintritt übersteht',
    'Sauerteigbrot für Einsteiger',
  ],
  es: [
    'Ventana de lanzamiento: en directo',
    'Un banco de nogal, de principio a fin',
    'Lasaña en una sartén en 30 minutos',
    'Afilar un formón en 60 segundos',
    'Cómo sobrevive un escudo térmico',
    'Pan de masa madre para principiantes',
  ],
};

const video = (id, values) => ({
  id,
  short: false,
  live: 'none',
  detailed: true,
  ...values,
});
// The ids are made up (11 characters, like YouTube's).
const IDS = [
  'liveOrbit01',
  'benchWalnut',
  'lasagnaPan1',
  'chiselShort',
  'heatShield1',
  'sourdough01',
];

const statesOf = (titles) => ({
  [SPACE.id]: {
    stats: { subscribers: 412000, hidden: false, views: 38200000, videos: 214, at: NOW - 600000 },
    videos: [
      video(IDS[0], { title: titles[0], published: hoursAgo(0.4), live: 'live' }),
      video(IDS[4], { title: titles[4], published: hoursAgo(50), duration: 1084 }),
    ],
    feedAt: NOW - 240000,
  },
  [WORKSHOP.id]: {
    stats: { subscribers: 87400, hidden: false, views: 6120000, videos: 156, at: NOW - 900000 },
    videos: [
      video(IDS[1], { title: titles[1], published: hoursAgo(3), duration: 1932 }),
      video(IDS[3], { title: titles[3], published: hoursAgo(26), short: true, duration: 58 }),
    ],
    feedAt: NOW - 240000,
  },
  [KITCHEN.id]: {
    stats: { subscribers: 1250000, hidden: false, views: 214000000, videos: 802, at: NOW - 900000 },
    videos: [
      video(IDS[2], { title: titles[2], published: hoursAgo(20), duration: 734 }),
      video(IDS[5], { title: titles[5], published: hoursAgo(74), duration: 1517 }),
    ],
    feedAt: NOW - 240000,
  },
});

const contents = {};
for (const language of LANGUAGES) {
  const states = statesOf(TITLES[language]);
  const channels = [SPACE, WORKSHOP, KITCHEN].map((channel) => ({
    channel,
    state: states[channel.id],
  }));
  contents[language] = {
    latest_videos: buildLatestVideosWidget({
      channels,
      hasKey: true,
      language,
      timezone: TZ,
      now: NOW,
    }),
    channel: buildChannelWidget({
      channel: WORKSHOP,
      state: states[WORKSHOP.id],
      hasKey: true,
      language,
      timezone: TZ,
      now: NOW,
    }),
    quota: buildQuotaWidget({
      used: 31,
      budget: 9000,
      planned: 27,
      channels: 3,
      resetAt: Date.parse('2026-10-21T07:00:00Z'),
      keyState: 'ok',
      language,
      timezone: TZ,
    }),
  };
}

// Drawn thumbnails: a gradient and a pictogram per video, never a real one.
const HUES = [212, 28, 8, 40, 250, 140];
const PICTOS = [
  '<path d="M150 40 L 170 110 L 130 110 Z" fill="#fff"/><circle cx="150" cy="128" r="10" fill="#ffd27f"/>',
  '<rect x="90" y="70" width="140" height="22" rx="4" fill="#fff"/><rect x="104" y="92" width="12" height="40" fill="#fff"/><rect x="204" y="92" width="12" height="40" fill="#fff"/>',
  '<rect x="100" y="70" width="120" height="50" rx="10" fill="#fff"/><rect x="215" y="88" width="50" height="10" rx="5" fill="#fff"/>',
  '<rect x="120" y="60" width="16" height="70" rx="4" fill="#fff"/><path d="M128 60 L 150 40 L 150 60 Z" fill="#fff"/>',
  '<circle cx="160" cy="90" r="40" fill="none" stroke="#fff" stroke-width="10"/><path d="M120 130 L 200 50" stroke="#fff" stroke-width="8"/>',
  '<ellipse cx="160" cy="95" rx="60" ry="35" fill="#fff"/><path d="M120 95 Q 160 70 200 95" stroke="#d9b98a" stroke-width="6" fill="none"/>',
];
const images = {};
IDS.forEach((id, i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${HUES[i]},60%,58%)"/><stop offset="1" stop-color="hsl(${HUES[i] + 30},55%,36%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/>${PICTOS[i]}</svg>`;
  images[imageKeyOf(id)] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
});

const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents, images }));
