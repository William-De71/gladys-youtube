# YouTube

## Présentation

Cette intégration suit des chaînes YouTube publiques dans Gladys. Chaque chaîne devient un appareil avec ses abonnés, ses vues totales, son nombre de vidéos et le titre et la date de sa dernière vidéo. Les nouvelles vidéos sont détectées par les flux RSS publics des chaînes, toutes les 15 minutes et sans aucun quota ; les statistiques et les détails des vidéos (durée, direct) viennent de l’API officielle YouTube Data API v3 avec votre propre clé d’API Google Cloud.

Elle ajoute des déclencheurs de scène (une vidéo ou un Short est publié, un direct commence, un palier d’abonnés est franchi, la clé est refusée, le quota est épuisé), des actions de scène (la dernière vidéo d’une chaîne, les statistiques d’une chaîne) et trois widgets de tableau de bord.

Non affilié à Google ni à YouTube, ni approuvé ni sponsorisé par eux. YouTube est une marque de Google LLC.

![Les trois widgets de l’intégration : dernières vidéos, une chaîne et le quota du jour (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-youtube/main/docs/assets/widgets.fr.png)

L’image ci-dessus est une illustration générée avec des chaînes inventées, pas une capture d’écran.

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Un compte Google et une **clé d’API Google Cloud** avec **YouTube Data API v3** activée :
  1. Ouvrez la [console Google Cloud](https://console.cloud.google.com/) et créez un projet (par exemple « Gladys YouTube »).
  2. Dans API et services → Bibliothèque, cherchez **YouTube Data API v3** et appuyez sur **Activer**.
  3. Dans API et services → Identifiants, appuyez sur **Créer des identifiants → Clé API**.
  4. Modifiez la clé : dans **Restrictions d’API**, choisissez « Restreindre la clé » et cochez seulement YouTube Data API v3 ; laissez **Restrictions d’application** sur « Aucune » (Gladys appelle depuis chez vous, pas depuis un site web).
- Aucun compte de facturation n’est nécessaire : l’API est gratuite dans son quota quotidien de 10 000 unités par projet, remis à zéro à minuit heure du Pacifique. Chaque appel de l’intégration coûte 1 unité ; pour 10 chaînes, environ 30 unités par jour.

## Configuration

| Champ                                            | Rôle                                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clé d’API Google Cloud                           | Obligatoire. Jamais affichée dans les journaux, envoyée seulement à Google dans un en-tête.                                                                      |
| Nouvelles vidéos : vérifier toutes les (minutes) | 5 à 240, 15 par défaut. Lit le flux RSS de chaque chaîne : gratuit. YouTube rafraîchit ses flux environ toutes les 15 minutes.                                   |
| Statistiques : lire toutes les (minutes)         | 15 à 1 440, 60 par défaut. Abonnés, vues et vidéos de toutes les chaînes : 1 unité pour 50 chaînes.                                                              |
| Budget quotidien (unités)                        | 9 000 par défaut. Une fois dépensé, les statistiques attendent minuit heure du Pacifique ; les flux RSS détectent encore les nouvelles vidéos (sans leur durée). |
| Langue des textes                                | Noms des fonctionnalités, dates, résumés des scènes et messages. Automatique : la langue de votre tableau de bord.                                               |

Boutons de configuration :

- **Ajouter une chaîne** : saisissez son @identifiant (`@GoogleDevelopers`), son URL (`youtube.com/@…`, `/channel/UC…`, `/user/…`), son id (`UC…`) ou l’URL d’une de ses vidéos. 1 unité (2 pour une URL de vidéo), plus 1 pour les détails de ses dernières vidéos. Jusqu’à 50 chaînes.
- **Retirer une chaîne** : par son numéro (`#2`), son nom, son @identifiant ou son id. Son appareil reste dans Gladys jusqu’à ce que vous le supprimiez.
- **Lister les chaînes** : chaque chaîne avec son numéro, ses abonnés, sa dernière vidéo, sa dernière vérification et sa dernière erreur, et les unités du jour.
- **Tester la clé d’API** : lit la chaîne officielle YouTube (1 unité) et dit quoi corriger si Google refuse la clé.

## Utilisation

### Chaînes

Ajoutez les chaînes avec **Ajouter une chaîne**. Les derniers envois d’une nouvelle chaîne sont lus aussitôt et gardés comme le passé : ils ne sont jamais annoncés comme nouveaux. Les anciennes URL personnalisées (`/c/Nom`) n’ont pas d’API : le nom est essayé comme identifiant ; en cas d’échec, utilisez l’@identifiant affiché sur la page de la chaîne.

### Appareils

Ouvrez l’onglet **Découverte** de l’intégration et ajoutez les chaînes voulues. Chaque appareil a :

- Abonnés, vues totales, vidéos (compteurs). YouTube arrondit à l’inférieur le nombre public d’abonnés à trois chiffres significatifs (1 234 567 donne 1 230 000) ; une chaîne peut le masquer, la fonctionnalité reste alors vide.
- Dernière vidéo : le titre du dernier envoi (un Short ou un direct terminé compris, un direct programmé exclu) et sa date de publication, dans le fuseau horaire de Gladys.

### Widgets du tableau de bord

- **Dernières vidéos** : les derniers envois de vos chaînes (8 au maximum), du plus récent au plus ancien et un direct en cours en tête, avec miniature, chaîne, date et un badge (EN DIRECT, Programmé, Short ou la durée). Un appui ouvre le détail et le lien vers la vidéo. Réglages : les chaînes (vide : toutes), Shorts affichés ou non. « Vérifier » lit aussitôt les flux RSS (gratuit).
- **Chaîne YouTube** : une chaîne, avec la miniature de sa dernière vidéo, ses abonnés, vues et vidéos, la dernière vidéo, sa date, l’état du direct et un bouton « Actualiser » (1 unité pour les statistiques).
- **Quota YouTube** : les unités dépensées aujourd’hui, la prochaine remise à zéro, les unités prévues par jour par vos chaînes, l’état de la clé.

Les boutons ne vérifient jamais une chaîne vérifiée il y a moins d’une minute, et ne déclenchent jamais de scène : les nouvelles vidéos qu’ils trouvent sont annoncées au tour suivant de l’horloge.

### Scènes

Déclencheurs :

- **Une chaîne publie une vidéo** : une nouvelle vidéo ou un Short, publié il y a moins de 48 heures (hors directs). Filtres : chaîne, type (vidéo ou Short). Variables : `channel_name`, `title`, `url`, `video_id`, `kind`, `short`, `duration_seconds`, `duration`, `published_at`, `thumbnail`, `summary`.
- **Une chaîne passe en direct** : un direct ou une première commence ; un direct programmé est vérifié toutes les 5 minutes dès 30 minutes avant son début. Variables : `channel_name`, `title`, `url`, `video_id`, `started_at`, `scheduled_at`, `thumbnail`, `summary`.
- **Une chaîne franchit un palier d’abonnés** : 100, 200, 500, 1 000, 2 000, 5 000, 10 000… Chaque palier ne se déclenche qu’une fois ; la première lecture d’une chaîne sert de référence. Variables : `channel_name`, `milestone`, `subscribers`, `summary`.
- **Google refuse la clé d’API** : une fois, jusqu’à ce qu’une requête fonctionne de nouveau. Variables : `reason`, `summary`.
- **Le quota du jour est épuisé** : le budget de l’intégration (`budget`) ou un refus de Google (`google`) ; une fois par jour. Variables : `source`, `used`, `budget`, `summary`.

Actions :

- **Obtenir la dernière vidéo d’une chaîne** : vérifie son flux RSS maintenant (gratuit). Sorties : `title`, `url`, `video_id`, `short`, `duration_seconds`, `published_at`, `live`, `summary`.
- **Obtenir les statistiques d’une chaîne** : la dernière lecture, sans requête. Sorties : `subscribers` (-1 si masqués), `views`, `videos`, `summary`.

Exemples :

- Quand une chaîne publie une vidéo, type « Vidéo » → envoyer un message : `{{triggerEvent.data.summary}}`.
- Quand une chaîne passe en direct → passer les lumières du salon en mode cinéma.
- Chaque soir à 19 h → obtenir la dernière vidéo d’une chaîne → dire son titre avec la synthèse vocale de Gladys.

### Transport

Cloud : l’intégration lit `www.googleapis.com` (Data API, avec votre clé), `www.youtube.com` (flux RSS, détection des Shorts) et `i.ytimg.com` (miniatures). Seuls les ids des chaînes et vidéos publiques suivies sont envoyés. Les chaînes sont stockées dans la configuration de Gladys ; `/data` garde les dernières lectures et le compteur d’unités.

## Dépannage

- **« Google refuse la clé d’API (API_KEY_INVALID) »** : recopiez la clé depuis la console Cloud.
- **« SERVICE_DISABLED »** ou **« accessNotConfigured »** : YouTube Data API v3 n’est pas activée dans le projet de la clé.
- **« API_KEY_SERVICE_BLOCKED »** : les restrictions d’API de la clé n’incluent pas YouTube Data API v3.
- **« API_KEY_HTTP_REFERRER_BLOCKED »** ou **« API_KEY_IP_ADDRESS_BLOCKED »** : mettez les restrictions d’application de la clé sur « Aucune ».
- **Quota épuisé** : attendez minuit heure du Pacifique ; vérifiez dans la console Cloud (API et services → YouTube Data API v3 → Quotas) qu’aucune autre application n’utilise le même projet, ou espacez les statistiques.
- **« RSS feed 404 »** dans « Lister les chaînes » : les flux de YouTube sont parfois indisponibles quelques heures ; l’intégration lit alors la playlist des envois (1 unité par chaîne) tant que moins de 80 % du budget est dépensé. Une chaîne en erreur pendant des jours a peut-être été supprimée.
- **Une nouvelle vidéo n’a pas été annoncée** : YouTube rafraîchit ses flux environ toutes les 15 minutes, une vidéo est donc vue 15 à 30 minutes après sa publication ; une vidéo publiée pendant un arrêt de l’intégration de plus de 48 heures n’est pas annoncée ; une première déclenche « passe en direct », pas « publie une vidéo ».
- Signalez un problème sur GitHub avec les versions de Gladys et de l’intégration, le texte de « Lister les chaînes » et les journaux de l’intégration (Paramètres → Supervision). Ne collez jamais votre clé d’API.
