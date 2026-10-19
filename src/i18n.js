// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature names and states, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena, Découverte /
// Entdecken / Descubrir.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // features
  featureSubscribers: { en: 'Subscribers', fr: 'Abonnés', de: 'Abonnenten', es: 'Suscriptores' },
  featureViews: {
    en: 'Total views',
    fr: 'Vues totales',
    de: 'Aufrufe gesamt',
    es: 'Vistas totales',
  },
  featureVideos: { en: 'Videos', fr: 'Vidéos', de: 'Videos', es: 'Vídeos' },
  featureLatestVideo: {
    en: 'Latest video',
    fr: 'Dernière vidéo',
    de: 'Neuestes Video',
    es: 'Último vídeo',
  },
  featureLatestPublished: {
    en: 'Latest video published',
    fr: 'Dernière vidéo publiée le',
    de: 'Neuestes Video veröffentlicht',
    es: 'Último vídeo publicado',
  },

  // times
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },

  // widgets
  badgeLive: { en: 'LIVE', fr: 'EN DIRECT', de: 'LIVE', es: 'EN DIRECTO' },
  badgeUpcoming: { en: 'Scheduled', fr: 'Programmé', de: 'Geplant', es: 'Programado' },
  badgeShort: { en: 'Short', fr: 'Short', de: 'Short', es: 'Short' },
  badgeVideo: { en: 'Video', fr: 'Vidéo', de: 'Video', es: 'Vídeo' },
  buttonCheck: { en: 'Check now', fr: 'Vérifier', de: 'Jetzt prüfen', es: 'Comprobar' },
  buttonRefresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  widgetNoKey: {
    en: 'Add your Google Cloud API key (YouTube Data API v3) in the configuration of the YouTube integration.',
    fr: 'Ajoutez votre clé d’API Google Cloud (YouTube Data API v3) dans la configuration de l’intégration YouTube.',
    de: 'Tragen Sie Ihren Google-Cloud-API-Schlüssel (YouTube Data API v3) in der Konfiguration der YouTube-Integration ein.',
    es: 'Añade tu clave de API de Google Cloud (YouTube Data API v3) en la configuración de la integración YouTube.',
  },
  widgetEmpty: {
    en: 'No channel yet: add one with “Add a channel” in the configuration of the integration.',
    fr: 'Aucune chaîne pour l’instant : ajoutez-en une avec « Ajouter une chaîne » dans la configuration de l’intégration.',
    de: 'Noch kein Kanal: Fügen Sie einen mit „Kanal hinzufügen“ in der Konfiguration der Integration hinzu.',
    es: 'Aún no hay ningún canal: añade uno con «Añadir un canal» en la configuración de la integración.',
  },
  widgetNoVideo: {
    en: 'No video read yet for these channels.',
    fr: 'Aucune vidéo lue pour l’instant sur ces chaînes.',
    de: 'Für diese Kanäle wurde noch kein Video gelesen.',
    es: 'Aún no se ha leído ningún vídeo de estos canales.',
  },
  widgetUnknownChannel: {
    en: 'This channel is no longer followed.',
    fr: 'Cette chaîne n’est plus suivie.',
    de: 'Diesem Kanal wird nicht mehr gefolgt.',
    es: 'Este canal ya no se sigue.',
  },
  widgetChooseChannel: {
    en: 'Choose a channel in the settings of the widget.',
    fr: 'Choisissez une chaîne dans les réglages du widget.',
    de: 'Wählen Sie einen Kanal in den Einstellungen des Widgets.',
    es: 'Elige un canal en los ajustes del widget.',
  },
  videosCaption: {
    en: 'Checked {checked}',
    fr: 'Vérifié {checked}',
    de: 'Geprüft {checked}',
    es: 'Comprobado {checked}',
  },
  scheduledFor: {
    en: 'Scheduled {date}',
    fr: 'Prévu le {date}',
    de: 'Geplant am {date}',
    es: 'Previsto el {date}',
  },
  updated: {
    en: 'updated {ago}',
    fr: 'mis à jour {ago}',
    de: 'aktualisiert {ago}',
    es: 'actualizado {ago}',
  },
  tileSubscribers: { en: 'Subscribers', fr: 'Abonnés', de: 'Abonnenten', es: 'Suscriptores' },
  tileViews: { en: 'Views', fr: 'Vues', de: 'Aufrufe', es: 'Vistas' },
  tileVideos: { en: 'Videos', fr: 'Vidéos', de: 'Videos', es: 'Vídeos' },
  statusLatest: {
    en: 'Latest',
    fr: 'Dernière vidéo',
    de: 'Zuletzt',
    es: 'Último',
  },
  statusPublished: { en: 'Published', fr: 'Publiée', de: 'Veröffentlicht', es: 'Publicado' },
  statusDuration: { en: 'Duration', fr: 'Durée', de: 'Dauer', es: 'Duración' },
  statusLive: { en: 'Live', fr: 'Direct', de: 'Live', es: 'Directo' },
  statusError: {
    en: 'Last error',
    fr: 'Dernière erreur',
    de: 'Letzter Fehler',
    es: 'Último error',
  },
  liveNone: { en: 'None', fr: 'Aucun', de: 'Keiner', es: 'Ninguno' },
  noVideo: { en: 'none yet', fr: 'aucune pour l’instant', de: 'noch keines', es: 'ninguno aún' },
  hiddenCount: {
    en: 'hidden by the channel',
    fr: 'masqués par la chaîne',
    de: 'vom Kanal verborgen',
    es: 'ocultos por el canal',
  },
  quotaHeading: {
    en: 'YouTube Data API',
    fr: 'YouTube Data API',
    de: 'YouTube Data API',
    es: 'YouTube Data API',
  },
  quotaCaption: {
    en: 'Next reset: {reset}',
    fr: 'Prochaine remise à zéro : {reset}',
    de: 'Nächste Rücksetzung: {reset}',
    es: 'Próximo reinicio: {reset}',
  },
  gaugeLabel: {
    en: 'Units today',
    fr: 'Unités du jour',
    de: 'Einheiten heute',
    es: 'Unidades hoy',
  },
  tilePlanned: {
    en: 'Planned / day',
    fr: 'Prévues / jour',
    de: 'Geplant / Tag',
    es: 'Previstas / día',
  },
  tileChannels: { en: 'Channels', fr: 'Chaînes', de: 'Kanäle', es: 'Canales' },
  quotaKey: { en: 'API key', fr: 'Clé d’API', de: 'API-Schlüssel', es: 'Clave de API' },
  quotaUsed: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  quotaUsedValue: {
    en: '{used} / {budget} units',
    fr: '{used} / {budget} unités',
    de: '{used} / {budget} Einheiten',
    es: '{used} / {budget} unidades',
  },
  quotaKeyOk: { en: 'Accepted', fr: 'Acceptée', de: 'Akzeptiert', es: 'Aceptada' },
  quotaKeyUnknown: {
    en: 'Not used yet',
    fr: 'Pas encore utilisée',
    de: 'Noch nicht verwendet',
    es: 'Aún sin usar',
  },
  quotaKeyRefused: {
    en: 'Refused by Google',
    fr: 'Refusée par Google',
    de: 'Von Google abgelehnt',
    es: 'Rechazada por Google',
  },
  quotaKeyMissing: { en: 'Missing', fr: 'Manquante', de: 'Fehlt', es: 'Falta' },
  quotaPaused: {
    en: 'Quota spent, waiting',
    fr: 'Quota épuisé, en attente',
    de: 'Kontingent erschöpft',
    es: 'Cuota agotada, en espera',
  },

  // scene summaries
  summaryNewVideo: {
    en: '{channel} published a new video: {title}{duration}. {url}',
    fr: '{channel} a publié une nouvelle vidéo : {title}{duration}. {url}',
    de: '{channel} hat ein neues Video veröffentlicht: {title}{duration}. {url}',
    es: '{channel} ha publicado un vídeo nuevo: {title}{duration}. {url}',
  },
  summaryNewShort: {
    en: '{channel} published a new Short: {title}{duration}. {url}',
    fr: '{channel} a publié un nouveau Short : {title}{duration}. {url}',
    de: '{channel} hat einen neuen Short veröffentlicht: {title}{duration}. {url}',
    es: '{channel} ha publicado un Short nuevo: {title}{duration}. {url}',
  },
  summaryLive: {
    en: '{channel} is live: {title}. {url}',
    fr: '{channel} est en direct : {title}. {url}',
    de: '{channel} ist live: {title}. {url}',
    es: '{channel} está en directo: {title}. {url}',
  },
  summaryMilestone: {
    en: '{channel} reached {milestone} subscribers.',
    fr: '{channel} a atteint {milestone} abonnés.',
    de: '{channel} hat {milestone} Abonnenten erreicht.',
    es: '{channel} ha alcanzado {milestone} suscriptores.',
  },
  summaryStats: {
    en: '{channel}: {subscribers} subscribers, {views} views, {videos} videos.',
    fr: '{channel} : {subscribers} abonnés, {views} vues, {videos} vidéos.',
    de: '{channel}: {subscribers} Abonnenten, {views} Aufrufe, {videos} Videos.',
    es: '{channel}: {subscribers} suscriptores, {views} vistas, {videos} vídeos.',
  },
  summaryStatsHidden: {
    en: '{channel}: {views} views, {videos} videos (subscribers hidden).',
    fr: '{channel} : {views} vues, {videos} vidéos (abonnés masqués).',
    de: '{channel}: {views} Aufrufe, {videos} Videos (Abonnenten verborgen).',
    es: '{channel}: {views} vistas, {videos} vídeos (suscriptores ocultos).',
  },
  apiErrorSummary: {
    en: 'YouTube: Google refuses the API key ({reason}). {hint}',
    fr: 'YouTube : Google refuse la clé d’API ({reason}). {hint}',
    de: 'YouTube: Google lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'YouTube: Google rechaza la clave de API ({reason}). {hint}',
  },
  quotaBudgetSummary: {
    en: 'YouTube: the {budget} units of the day are spent ({used}); statistics wait for midnight Pacific Time, the RSS feeds still detect new videos.',
    fr: 'YouTube : les {budget} unités du jour sont dépensées ({used}) ; les statistiques attendent minuit heure du Pacifique, les flux RSS détectent encore les nouvelles vidéos.',
    de: 'YouTube: Die {budget} Einheiten des Tages sind verbraucht ({used}); die Statistiken warten bis Mitternacht pazifischer Zeit, die RSS-Feeds erkennen weiterhin neue Videos.',
    es: 'YouTube: se han gastado las {budget} unidades del día ({used}); las estadísticas esperan a la medianoche del Pacífico, los feeds RSS siguen detectando vídeos nuevos.',
  },
  quotaGoogleSummary: {
    en: 'YouTube: Google refuses the quota of the Cloud project ({used} / {budget} units counted by the integration); requests resume at midnight Pacific Time.',
    fr: 'YouTube : Google refuse le quota du projet Cloud ({used} / {budget} unités comptées par l’intégration) ; les requêtes reprennent à minuit heure du Pacifique.',
    de: 'YouTube: Google lehnt das Kontingent des Cloud-Projekts ab ({used} / {budget} Einheiten von der Integration gezählt); die Anfragen laufen um Mitternacht pazifischer Zeit wieder.',
    es: 'YouTube: Google rechaza la cuota del proyecto Cloud ({used} / {budget} unidades contadas por la integración); las solicitudes se reanudan a la medianoche del Pacífico.',
  },

  // Configuration screen
  statusNoKey: {
    en: 'Enter your Google Cloud API key (YouTube Data API v3 enabled), then add channels.',
    fr: 'Saisissez votre clé d’API Google Cloud (YouTube Data API v3 activée), puis ajoutez des chaînes.',
    de: 'Geben Sie Ihren Google-Cloud-API-Schlüssel ein (YouTube Data API v3 aktiviert) und fügen Sie dann Kanäle hinzu.',
    es: 'Introduce tu clave de API de Google Cloud (YouTube Data API v3 activada) y luego añade canales.',
  },
  statusEmpty: {
    en: 'No channel yet: “Add a channel” with its @handle, its URL or its id.',
    fr: 'Aucune chaîne pour l’instant : « Ajouter une chaîne » avec son @identifiant, son URL ou son id.',
    de: 'Noch kein Kanal: „Kanal hinzufügen“ mit seinem @Handle, seiner URL oder seiner ID.',
    es: 'Aún no hay canales: «Añadir un canal» con su @identificador, su URL o su id.',
  },
  statusOk: {
    en: '{count} channel(s). Today: {used} / {budget} units.',
    fr: '{count} chaîne(s). Aujourd’hui : {used} / {budget} unités.',
    de: '{count} Kanal/Kanäle. Heute: {used} / {budget} Einheiten.',
    es: '{count} canal(es). Hoy: {used} / {budget} unidades.',
  },
  statusKeyError: {
    en: 'Google refuses the API key ({reason}). {hint}',
    fr: 'Google refuse la clé d’API ({reason}). {hint}',
    de: 'Google lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'Google rechaza la clave de API ({reason}). {hint}',
  },
  hint_API_KEY_MISSING: {
    en: 'Enter the key in the configuration.',
    fr: 'Saisissez la clé dans la configuration.',
    de: 'Geben Sie den Schlüssel in der Konfiguration ein.',
    es: 'Introduce la clave en la configuración.',
  },
  hint_API_KEY_INVALID: {
    en: 'Check the key: copy it again from the Google Cloud console (Credentials).',
    fr: 'Vérifiez la clé : recopiez-la depuis la console Google Cloud (Identifiants).',
    de: 'Prüfen Sie den Schlüssel: Kopieren Sie ihn erneut aus der Google-Cloud-Konsole (Anmeldedaten).',
    es: 'Comprueba la clave: cópiala de nuevo desde la consola de Google Cloud (Credenciales).',
  },
  hint_SERVICE_DISABLED: {
    en: 'Enable “YouTube Data API v3” in the Cloud project of the key (APIs & Services → Library).',
    fr: 'Activez « YouTube Data API v3 » dans le projet Cloud de la clé (API et services → Bibliothèque).',
    de: 'Aktivieren Sie „YouTube Data API v3“ im Cloud-Projekt des Schlüssels (APIs & Dienste → Bibliothek).',
    es: 'Activa «YouTube Data API v3» en el proyecto Cloud de la clave (API y servicios → Biblioteca).',
  },
  hint_API_KEY_SERVICE_BLOCKED: {
    en: 'The restrictions of the key do not allow YouTube Data API v3: add it to the allowed APIs.',
    fr: 'Les restrictions de la clé n’autorisent pas YouTube Data API v3 : ajoutez-la aux API autorisées.',
    de: 'Die Einschränkungen des Schlüssels erlauben YouTube Data API v3 nicht: Fügen Sie sie den erlaubten APIs hinzu.',
    es: 'Las restricciones de la clave no permiten YouTube Data API v3: añádela a las API permitidas.',
  },
  hint_restricted: {
    en: 'The key is restricted to websites, apps or IP addresses: choose “None” under application restrictions.',
    fr: 'La clé est restreinte à des sites, des applis ou des adresses IP : choisissez « Aucune » dans les restrictions d’application.',
    de: 'Der Schlüssel ist auf Websites, Apps oder IP-Adressen beschränkt: Wählen Sie „Keine“ bei den Anwendungseinschränkungen.',
    es: 'La clave está restringida a sitios, apps o direcciones IP: elige «Ninguna» en las restricciones de aplicación.',
  },
  hint_default: {
    en: 'Check the key and its Cloud project in the Google Cloud console.',
    fr: 'Vérifiez la clé et son projet Cloud dans la console Google Cloud.',
    de: 'Prüfen Sie den Schlüssel und sein Cloud-Projekt in der Google-Cloud-Konsole.',
    es: 'Comprueba la clave y su proyecto Cloud en la consola de Google Cloud.',
  },

  // configuration buttons
  added: {
    en: 'Added: {line}\nNow open the Discovery tab of the integration and add its device.',
    fr: 'Ajoutée : {line}\nOuvrez maintenant l’onglet Découverte de l’intégration et ajoutez son appareil.',
    de: 'Hinzugefügt: {line}\nÖffnen Sie jetzt den Reiter Entdecken der Integration und fügen Sie ihr Gerät hinzu.',
    es: 'Añadido: {line}\nAbre ahora la pestaña Descubrir de la integración y añade su dispositivo.',
  },
  addedExisting: {
    en: 'Already followed, refreshed: {line}',
    fr: 'Déjà suivie, mise à jour : {line}',
    de: 'Bereits verfolgt, aktualisiert: {line}',
    es: 'Ya seguido, actualizado: {line}',
  },
  removed: {
    en: 'Removed: {name}. Its device stays in Gladys until you delete it from the Devices tab.',
    fr: 'Retirée : {name}. Son appareil reste dans Gladys jusqu’à ce que vous le supprimiez depuis l’onglet Appareils.',
    de: 'Entfernt: {name}. Sein Gerät bleibt in Gladys, bis Sie es im Reiter Geräte löschen.',
    es: 'Quitado: {name}. Su dispositivo sigue en Gladys hasta que lo elimines desde la pestaña Dispositivos.',
  },
  listEmpty: {
    en: 'No channel yet.',
    fr: 'Aucune chaîne pour l’instant.',
    de: 'Noch kein Kanal.',
    es: 'Aún no hay ningún canal.',
  },
  listHeader: {
    en: '{count} channel(s). Today: {used} / {budget} units, about {planned} a day planned.',
    fr: '{count} chaîne(s). Aujourd’hui : {used} / {budget} unités, environ {planned} prévues par jour.',
    de: '{count} Kanal/Kanäle. Heute: {used} / {budget} Einheiten, etwa {planned} pro Tag geplant.',
    es: '{count} canal(es). Hoy: {used} / {budget} unidades, unas {planned} previstas al día.',
  },
  listLine: {
    en: '#{n} {title} {handle}({id}): {subscribers} subscribers; latest video: {latest}; checked {checked}',
    fr: '#{n} {title} {handle}({id}) : {subscribers} abonnés ; dernière vidéo : {latest} ; vérifiée {checked}',
    de: '#{n} {title} {handle}({id}): {subscribers} Abonnenten; neuestes Video: {latest}; geprüft {checked}',
    es: '#{n} {title} {handle}({id}): {subscribers} suscriptores; último vídeo: {latest}; comprobado {checked}',
  },
  listError: {
    en: ' — last error: {message}',
    fr: ' — dernière erreur : {message}',
    de: ' — letzter Fehler: {message}',
    es: ' — último error: {message}',
  },
  testOk: {
    en: 'The key works: YouTube answered with the channel “{title}”. Units spent today: {used}.',
    fr: 'La clé fonctionne : YouTube a répondu avec la chaîne « {title} ». Unités dépensées aujourd’hui : {used}.',
    de: 'Der Schlüssel funktioniert: YouTube hat mit dem Kanal „{title}“ geantwortet. Heute verbrauchte Einheiten: {used}.',
    es: 'La clave funciona: YouTube ha respondido con el canal «{title}». Unidades gastadas hoy: {used}.',
  },
  toastChecked: {
    en: 'Checked {count} channel(s): {found} new video(s).',
    fr: '{count} chaîne(s) vérifiée(s) : {found} nouvelle(s) vidéo(s).',
    de: '{count} Kanal/Kanäle geprüft: {found} neue(s) Video(s).',
    es: '{count} canal(es) comprobado(s): {found} vídeo(s) nuevo(s).',
  },

  // errors
  errorInput: {
    en: 'Type an @handle, a channel URL, a channel id (UC…) or the URL of one of its videos.',
    fr: 'Saisissez un @identifiant, l’URL d’une chaîne, un id de chaîne (UC…) ou l’URL d’une de ses vidéos.',
    de: 'Geben Sie ein @Handle, eine Kanal-URL, eine Kanal-ID (UC…) oder die URL eines seiner Videos ein.',
    es: 'Escribe un @identificador, la URL de un canal, un id de canal (UC…) o la URL de uno de sus vídeos.',
  },
  errorNoChannel: {
    en: 'YouTube knows no channel for “{input}”.',
    fr: 'YouTube ne connaît aucune chaîne pour « {input} ».',
    de: 'YouTube kennt keinen Kanal für „{input}“.',
    es: 'YouTube no conoce ningún canal para «{input}».',
  },
  errorTarget: {
    en: 'Which channel? Its number (#2), its name, its @handle or its id.',
    fr: 'Quelle chaîne ? Son numéro (#2), son nom, son @identifiant ou son id.',
    de: 'Welcher Kanal? Seine Nummer (#2), sein Name, sein @Handle oder seine ID.',
    es: '¿Qué canal? Su número (#2), su nombre, su @identificador o su id.',
  },
  errorAmbiguous: {
    en: 'Several channels match “{query}”: {numbers}. Use the number.',
    fr: 'Plusieurs chaînes correspondent à « {query} » : {numbers}. Utilisez le numéro.',
    de: 'Mehrere Kanäle passen zu „{query}“: {numbers}. Verwenden Sie die Nummer.',
    es: 'Varios canales coinciden con «{query}»: {numbers}. Usa el número.',
  },
  errorNotFound: {
    en: 'No followed channel matches “{query}”.',
    fr: 'Aucune chaîne suivie ne correspond à « {query} ».',
    de: 'Kein verfolgter Kanal passt zu „{query}“.',
    es: 'Ningún canal seguido coincide con «{query}».',
  },
  errorFull: {
    en: 'At most {max} channels.',
    fr: '{max} chaînes au maximum.',
    de: 'Höchstens {max} Kanäle.',
    es: '{max} canales como máximo.',
  },
  errorSave: {
    en: 'Gladys could not save the channels: {message}',
    fr: 'Gladys n’a pas pu enregistrer les chaînes : {message}',
    de: 'Gladys konnte die Kanäle nicht speichern: {message}',
    es: 'Gladys no ha podido guardar los canales: {message}',
  },
  errorBudget: {
    en: 'The {budget} units of the day are spent: wait for midnight Pacific Time or raise the daily budget.',
    fr: 'Les {budget} unités du jour sont dépensées : attendez minuit heure du Pacifique ou augmentez le budget quotidien.',
    de: 'Die {budget} Einheiten des Tages sind verbraucht: Warten Sie bis Mitternacht pazifischer Zeit oder erhöhen Sie das Tagesbudget.',
    es: 'Se han gastado las {budget} unidades del día: espera a la medianoche del Pacífico o aumenta el presupuesto diario.',
  },
  errorQuota: {
    en: 'Google refuses the quota of the Cloud project: requests resume at midnight Pacific Time.',
    fr: 'Google refuse le quota du projet Cloud : les requêtes reprennent à minuit heure du Pacifique.',
    de: 'Google lehnt das Kontingent des Cloud-Projekts ab: Die Anfragen laufen um Mitternacht pazifischer Zeit wieder.',
    es: 'Google rechaza la cuota del proyecto Cloud: las solicitudes se reanudan a la medianoche del Pacífico.',
  },
  errorUnreachable: {
    en: 'YouTube cannot be reached: {message}',
    fr: 'YouTube est injoignable : {message}',
    de: 'YouTube ist nicht erreichbar: {message}',
    es: 'No se puede acceder a YouTube: {message}',
  },
  errorUnknownDevice: {
    en: 'This device is not a followed channel.',
    fr: 'Cet appareil n’est pas une chaîne suivie.',
    de: 'Dieses Gerät ist kein verfolgter Kanal.',
    es: 'Este dispositivo no es un canal seguido.',
  },
  errorNoVideoYet: {
    en: 'No video known yet for this channel.',
    fr: 'Aucune vidéo connue pour l’instant sur cette chaîne.',
    de: 'Für diesen Kanal ist noch kein Video bekannt.',
    es: 'Aún no se conoce ningún vídeo de este canal.',
  },
  errorNoStats: {
    en: 'The statistics of this channel are not read yet.',
    fr: 'Les statistiques de cette chaîne ne sont pas encore lues.',
    de: 'Die Statistiken dieses Kanals wurden noch nicht gelesen.',
    es: 'Las estadísticas de este canal aún no se han leído.',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} language - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
const isLanguage = (language) => LANGUAGES.includes(language);

/**
 * @description A text in a language, with its substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language (English fallback).
 * @param {object} [values] - The substitutions `{name}`.
 * @returns {string} The text.
 * @example
 * t('summaryLive', 'fr', { channel: 'X', title: 'Y', url: 'Z' });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) return key;
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? whole : String(values[name]),
  );
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string|Function} key - The TEXTS key, or `(language) => string`.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusEmpty');
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function' ? key(language) : t(key, language, values),
    ]),
  );
}

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A number written in a language ("4 500", "4,500").
 * @param {number} n - The number.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const formatNumber = (n, language) =>
  new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1 }).format(n);

/**
 * @description A large number, short: "1.23M", "1,23 M", "45.6K".
 * @param {number} n - The number.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const formatCompact = (n, language) =>
  new Intl.NumberFormat(locale(language), {
    notation: 'compact',
    maximumSignificantDigits: 3,
  }).format(n);

/**
 * @description A duration as a clock: "4:05", "1:02:03".
 * @param {number} seconds - The duration.
 * @returns {string} The text.
 * @example
 * formatDuration(3723); // -> '1:02:03'
 */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * @description A date and time in a language and a timezone: "16 Oct 2026, 23:00".
 * @param {string} iso - The instant (ISO 8601).
 * @param {string} language - The language.
 * @param {string} timezone - IANA timezone.
 * @returns {string} The text, "—" when unreadable.
 */
function formatDate(iso, language, timezone) {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'UTC',
  }).format(date);
}

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) return t('never', language);
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return t('justNow', language);
  if (minutes < 60) return t('minutesAgo', language, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('hoursAgo', language, { n: hours });
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

export {
  LANGUAGES,
  TEXTS,
  isLanguage,
  t,
  all,
  formatNumber,
  formatCompact,
  formatDuration,
  formatDate,
  ago,
};
