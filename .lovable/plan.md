## Objectif

Permettre à MonRegistre (PWA installée) d'envoyer des notifications push mobiles/desktop pour :
- **Rappel du lendemain** : chaque soir (ex. 20 h), résumé des créneaux du jour suivant
- **Expiration de licence** : à J-14, J-7, J-3, J-1, puis à l'expiration
- **Actions administratives** : réactivation de compte, changement de plan, paiement enregistré (déjà en base via `user_notifications`, on ajoute juste le push)
- **Nouveau bulletin/rapport disponible** (extensible plus tard)

Approche retenue : **Web Push standard (VAPID)** — natif, gratuit, fonctionne sur Android/Chrome/Firefox/Edge et iOS 16.4+ **si l'app est installée sur l'écran d'accueil** (limitation iOS, pas contournable sans app native).

## Ce qui existe déjà et qu'on réutilise

- PWA installable (manifest, `register-sw.ts`, service worker)
- Table `user_notifications` (in-app) + préférences par catégorie dans `profils_enseignant.notifications_prefs`
- Créneaux (table `creneaux`) et abonnements plan (`profils_enseignant.plan_expires_at`)
- `pg_cron` + `pg_net` disponibles pour la planification

## Étapes

### 1. Infra base de données

Nouvelle table `push_subscriptions` (un utilisateur peut avoir plusieurs appareils) :

```text
id uuid pk, user_id, endpoint (unique), p256dh, auth,
user_agent, created_at, last_seen_at, disabled_at
```

Table `push_deliveries` (journal + déduplication anti-doublon) :

```text
id uuid pk, user_id, kind (text), key (text), sent_at,
unique(user_id, kind, key)
```

Ajout à `notifications_prefs` de nouvelles catégories `schedule_daily` et `license_expiry` (avec canaux, dont un canal `push`).

### 2. Clés VAPID

Génération d'une paire VAPID (publique + privée) au moment du setup :
- `VAPID_PUBLIC_KEY` → exposée côté client via `import.meta.env`
- `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (mailto) → secrets serveur

### 3. Service worker push

Ajouter à `public/sw.js` (ou fichier séparé chargé par l'existant) :
- `push` handler → affiche la notification avec titre/corps/icône/badge/URL
- `notificationclick` handler → focus/ouvre l'onglet sur l'URL cible

### 4. Client — abonnement

Nouveau helper `src/lib/push.ts` :
- `enableWebPush()` : demande permission, s'abonne au PushManager, enregistre l'endpoint via server function
- `disableWebPush()` : désabonne + supprime en base
- Composant `PushToggle` dans `/parametres/notifications` (au-dessus des toggles de canaux existants)

### 5. Server functions

`src/lib/push.functions.ts` :
- `registerPushSubscription({ endpoint, keys, ua })` — upsert dans `push_subscriptions`
- `unregisterPushSubscription({ endpoint })`

`src/lib/push.server.ts` (helper serveur only) :
- `sendPushToUser(userId, payload, dedupKey?)` : lit les subscriptions actives, appelle `web-push`, invalide les endpoints expirés (410/404)

### 6. Endpoints cron (routes publiques signées)

Routes sous `src/routes/api/public/hooks/` :

- `POST /api/public/hooks/schedule-daily-reminders`
  - Pour chaque user actif ayant `schedule_daily` activé et au moins un créneau demain
  - Compose « Demain : 3 cours · 08:00 6ème A · 10:00 5ème B · … »
  - Envoie push, dédup via `push_deliveries(kind='schedule_daily', key=YYYY-MM-DD)`

- `POST /api/public/hooks/license-expiry-reminders`
  - Pour chaque user avec plan ≠ gratuit et `plan_expires_at` dans {14,7,3,1} jours ou expiré ≤ 1 j
  - Compose message adapté ; dédup via `key=plan_id-<jours-restants>`

Auth : header `apikey: SUPABASE_ANON_KEY` + vérification interne d'un `X-Cron-Secret` optionnel (préparation propre, pas de re-run accidentel).

### 7. Planification pg_cron

- `schedule-daily-reminders` : `0 20 * * *` (20 h chaque soir, heure du serveur)
- `license-expiry-reminders` : `0 9 * * *` (9 h chaque matin)

Configurées via `supabase--insert` (données runtime, pas migration).

### 8. Notifications événementielles (déclenchées côté app, pas cron)

Là où on insère déjà dans `user_notifications` (réactivation compte, changement de plan, paiement) → ajouter un appel `sendPushToUser` en fire-and-forget, respectant les préférences de la catégorie.

### 9. UI préférences

Dans `/parametres/notifications` :
- Bouton « Activer les notifications push sur cet appareil » (statut : non supporté / bloqué / activé)
- Ajout des catégories `schedule_daily` et `license_expiry` dans les toggles existants, avec canal push

### 10. Limitations à communiquer à l'utilisateur

- iOS : nécessite d'installer l'app depuis Safari via « Sur l'écran d'accueil » (iOS 16.4+)
- Un appareil = un abonnement ; changer de navigateur crée un second abonnement
- Envoi possible seulement si le navigateur/l'OS est éveillé (pas une garantie temps réel absolue)

## Fichiers créés / modifiés

**Créés**
- migration : `push_subscriptions`, `push_deliveries`, extension `notifications_prefs`
- `src/lib/push.ts` (client)
- `src/lib/push.functions.ts` (serverFn d'abonnement)
- `src/lib/push.server.ts` (envoi via `web-push`)
- `src/routes/api/public/hooks/schedule-daily-reminders.ts`
- `src/routes/api/public/hooks/license-expiry-reminders.ts`
- `src/components/app/push-toggle.tsx`
- Handler push ajouté à `public/sw.js`

**Modifiés**
- `src/lib/notifications-prefs.ts` : nouvelles catégories
- `src/routes/_authenticated/parametres.notifications.tsx` : bouton + toggles
- Points d'insertion existants dans `user_notifications` → ajout de `sendPushToUser`

**Secrets à ajouter**
- `VAPID_PUBLIC_KEY` (aussi exposée `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ex. `mailto:support@monregistre.app`)

## Questions avant de coder

1. **Adresse VAPID subject** : je mets `mailto:support@monregistre.app` ou un autre email ?
2. **Heure d'envoi du récap du lendemain** : 20 h serveur (UTC) par défaut, ou une heure spécifique (Congo/Brazzaville = UTC+1) ? Je propose **19 h UTC** = **20 h locale Congo**.
3. **Rappels de licence** : les 4 jalons (J-14 / J-7 / J-3 / J-1) te vont, ou tu préfères un autre rythme ?
4. Veux-tu aussi une notification push pour les **paiements enregistrés** et la **réactivation de compte** (elles existent déjà en in-app), ou on garde ces deux-là uniquement en cloche ?