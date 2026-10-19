// -----------------------------------------------------------------------------
// Configuration of the YouTube integration.
//
// Fields of the config_schema:
//   - `api_key`         the Google Cloud API key of the user (YouTube Data API
//                       v3 enabled), a secret: never logged;
//   - `feed_minutes`    how often the RSS feed of each channel is read to
//                       detect new videos (free: no quota);
//   - `stats_minutes`   how often the statistics of the channels are read
//                       (1 unit per 50 channels);
//   - `daily_budget`    units a day the integration may spend (Google gives
//                       10,000 by default, reset at midnight Pacific Time);
//   - `language`        language of the texts Gladys does not ask for in a
//                       language (feature names and states, scene summaries,
//                       messages of the configuration buttons): `auto`
//                       follows the last widget request, and guesses it from
//                       the timezone of Gladys until a widget is shown.
//
// Internal keys, outside the config_schema (never shown in the UI, stored by
// setConfig in the Gladys database, so they follow the Gladys backups):
//   - `channels`       the registry of the followed channels (channels.js);
//   - `last_language`  language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

// Form fields of type number are rounded to whole numbers by Gladys.
const FEED_MINUTES = { min: 5, max: 240, default: 15 };
const STATS_MINUTES = { min: 15, max: 1440, default: 60 };
const DAILY_BUDGET = { min: 100, max: 1000000, default: 9000 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { registry: 'channels', language: 'last_language' };

/**
 * @description Read a bounded whole number, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('20', FEED_MINUTES); // -> 20
 */
function readNumber(raw, bounds) {
  if (raw === '' || raw === null || raw === undefined) {
    return bounds.default;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ apiKey: string, feedMinutes: number, statsMinutes: number,
 *   dailyBudget: number, language: string }} The config.
 * @example
 * normalizeConfig({ api_key: ' AIza… ', feed_minutes: 10 });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    apiKey: typeof config.api_key === 'string' ? config.api_key.trim() : '',
    feedMinutes: readNumber(config.feed_minutes, FEED_MINUTES),
    statsMinutes: readNumber(config.stats_minutes, STATS_MINUTES),
    dailyBudget: readNumber(config.daily_budget, DAILY_BUDGET),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

// Timezones of the countries speaking one of the languages of the
// integration; any other one is English. A guess for the first devices only:
// the first widget shown gives the real language.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Panama',
    'America/Costa_Rica',
    'America/Guatemala',
    'America/Santo_Domingo',
    'America/Puerto_Rico',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) return 'es';
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  FEED_MINUTES,
  STATS_MINUTES,
  DAILY_BUDGET,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  readNumber,
  guessLanguage,
  normalizeConfig,
  readLanguage,
};
