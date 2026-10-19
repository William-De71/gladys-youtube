# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that follows public YouTube
channels: a Node.js service (Node 22+, ESM, no build step) that runs in its own
sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. The channels are typed in a plain form
(configuration buttons, no JSON) and stored with `setConfig` in the Gladys
configuration. New videos come from the public RSS feeds (no quota); the
statistics and the details of the videos come from the official **YouTube
Data API v3** with the user's own Google Cloud API key. Transport: cloud. Not
affiliated with Google or YouTube: never use their logo nor say otherwise.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the clock (tick):
                        feeds, details, lives, statistics; errors (refused key,
                        quota, budget, feed down); scene events; status
src/youtube-api.js      the Data API client (key in X-Goog-Api-Key, 1 unit a call,
                        counted even on error), the RSS feed parser, the Shorts
                        check (HEAD /shorts/<id>), thumbnails, what the user types
src/usage.js            units of the Pacific day (Google's quota day), /data/usage.json
src/channels.js         the channels: resolved ids, checks, serialized setConfig writes
src/state.js            per channel: statistics, latest uploads with their details,
                        seen ids, last check and error, milestone; flags; /data/state.json
src/device.js           one device per channel, its features and states
src/events.js           scene trigger payloads, milestones, scene action outputs
src/widgets.js          latest videos, channel and quota dashboard widgets
src/images.js           widget image keys <-> video ids (thumbnails of i.ytimg.com only)
src/config.js           configuration (key, intervals, budget, language)
src/i18n.js             runtime texts and formats, en / fr / de / es
src/time.js             timezone helpers (TZ given by the supervisor)
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: the channel
  id (`UC…`, never its title nor its handle), the feature keys (`subscribers`,
  `views`, `videos`, `latest_video`, `latest_published`), feature `category` /
  `type` / `unit` / `min` / `max`, the keys of `config_schema`, `actions` and
  their fields, the internal config keys (`channels`, `last_language`), the
  widgets and their settings, the widget button action (`refresh`), the image
  keys (`yt-<hex of the video id>`), scene triggers (fields, options,
  variables) and scene actions (fields, outputs). `test/structure.test.js`
  compares them to `test/fixtures/discovery.baseline.json`: never update the
  baseline to make a test pass without a documented migration.
- **Category / type pairs**: `counter-sensor` / `integer` for the counts and
  `text` / `text` for the latest video and its date, from the SDK constants.
  No "live" binary feature: Gladys has no category for it.
- **`should_poll` stays false**: the integration has its own clock (a tick
  every 30 s): RSS feeds every `feed_minutes`, statistics every
  `stats_minutes`, lives every 5 minutes around their start.
- **Quota.** Every Data API call costs 1 unit (channels.list, videos.list,
  playlistItems.list), an error included; 50 ids per call. **Never call
  search.list** (100 units). The daily budget is `daily_budget` units per
  Pacific day in `/data/usage.json`; once spent, only the free RSS feeds run.
  A 403 `quotaExceeded` pauses every request until midnight Pacific Time.
  The playlist fallback of a failing feed only runs under 80 % of the budget.
- **The API key** is a `secret`: never logged, never in a URL (always the
  `X-Goog-Api-Key` header), never in /data, never in a scene variable.
- **Scene events**: one per transition (a new video seen for the first time
  at a scheduled reading and published less than 48 hours ago; a live that
  starts; a new highest subscriber milestone; key refused once until it works;
  quota once a day); never as the consequence of an action or a button. The
  uploads read when a channel is added are the past: never announced.
- **The registry** is written through `setConfig` one change at a time, and
  applied in memory only once Gladys saved it.
- **Gladys does not pass DEBUG / LOG_LEVEL to the container**: never tell a
  store user to set them; "List the channels" is the diagnostic button.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files. The
  illustrations use made-up channels and drawn thumbnails, never real ones.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB; at most 10 configuration actions; `number` fields are rounded to
  whole numbers by Gladys. A field older cores do not know needs a higher
  `gladys_version` minimum (see `src/constants.js` of the integration-store):
  widgets and scenes need `>=5.1.0`; a widget button with a form would need
  `>=5.2.0` (none here). Transport: `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
