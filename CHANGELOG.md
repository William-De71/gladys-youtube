# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-10-19

### Added

- Public YouTube channels followed from the configuration ("Add a channel", "Remove a channel", "List the channels", "Test the API key"), typed as an @handle, a channel URL, a channel id or the URL of one of its videos, and resolved into the stable channel id.
- One device per channel through the YouTube Data API v3: subscribers, total views, videos, title and publication date of the latest video.
- New videos detected through the public RSS feeds (no quota), Shorts told apart, details of the new videos and scheduled lives read with videos.list; the uploads playlist as the fallback of a failing feed; a daily budget of units counted per Pacific day like Google (9,000 by default).
- Scene triggers: a channel publishes a video or a Short, a channel goes live, a channel reaches a subscriber milestone, Google refuses the API key, the daily quota is spent.
- Scene actions: the latest video of a channel (title, URL, Short, duration, date, live state, summary) and the statistics of a channel.
- Dashboard widgets: latest videos with thumbnails and badges, one channel with the thumbnail of its latest video, quota of the day.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-youtube/releases/tag/v0.1.0
