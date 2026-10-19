// -----------------------------------------------------------------------------
// Entry point of the YouTube external integration.
//
// The public YouTube channels the user follows, through the YouTube Data API
// v3 (the user's own Google Cloud API key) and the public RSS feeds:
//   - devices: one per followed channel (subscribers, views, videos, latest
//     video and its date), offered on the Discovery screen (src/device.js);
//   - scene triggers: new video, live started, subscriber milestone, refused
//     key, quota exhausted;
//   - scene actions: latest video of a channel, statistics of a channel;
//   - dashboard widgets: latest videos, one channel, quota of the day.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the dates are written in it)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the YouTube integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
