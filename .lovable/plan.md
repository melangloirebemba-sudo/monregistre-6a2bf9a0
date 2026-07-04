## Ce qu'on ajoute

### 1. Base de données (migration)
- **`plan_prices`** — clé `(plan, periode)`, colonnes `montant` (int), `devise` (`XAF` par défaut), `updated_at`, `updated_by`. Seed initial à `0` pour les 6 combinaisons `lite/premium × mensuelle/trimestrielle/annuelle`.
- **`paiements`** — un reçu par activation :
  - `id`, `user_id` (FK auth.users), `plan_activation_id` (FK plan_activations, unique), `plan`, `periode`, `montant`, `devise`, `numero_recu` (unique, ex. `REC-2026-000042`), `paye_le`, `moyen_paiement` (`manuel` / `en_ligne` / …), `note`, `created_at`.
  - Séquence Postgres `paiements_recu_seq` + trigger pour composer `REC-{année}-{6 chiffres}` à l'insert si `numero_recu` est nul.
- GRANTs + RLS :
  - `plan_prices` : lecture pour `authenticated` ; écriture réservée `admin` via `has_role`.
  - `paiements` : chaque user lit ses propres lignes ; admin lit/insère tout ; `service_role` full.

### 2. Edge function `admin-api`
- Nouvelles actions :
  - `prices.list` → renvoie la grille des 6 tarifs.
  - `prices.update` → `{ plan, periode, montant, devise }`.
- `activatePlan` étendu : après l'`UPDATE profils_enseignant` et l'insert dans `plan_activations`, on va chercher le prix courant dans `plan_prices` et on **insère automatiquement une ligne `paiements`** rattachée à l'activation (montant 0 accepté si prix non configuré ; note admin propagée).

### 3. Écran admin — Prix des plans
Dans `admin.plans.tsx`, ajouter un panneau **« Tarifs »** juste après les limites : un tableau plans × périodes avec input montant + bouton « Enregistrer ». Devise fixée à `XAF` (affichée, non éditable pour l'instant).

### 4. Écran utilisateur — « Facturation & paiements »
Nouveau route `src/routes/_authenticated/facturation.tsx` :
- En-tête + total payé cumulé.
- Recherche + filtre (plan) + tri + pagination via `usePaginatedQuery` (cohérent avec les autres listes).
- Chaque ligne : plan, période, montant (`format XAF`), date de paiement, date d'expiration/renouvellement, moyen, bouton **« Télécharger le reçu »** (PDF).
- États : `ListSkeleton`, `NoResults`.
- Ajout d'un lien vers cette page depuis `parametres.tsx` (bloc « Historique des activations » gagne un CTA « Voir factures & reçus »), et depuis le menu de navigation si présent.

### 5. Génération du reçu PDF
Nouveau `src/lib/pdf/recu-paiement.ts` (jsPDF, déjà installé) — reçu A5 sobre :
- Ent-tête : `MonRegistre — Reçu de paiement n° REC-2026-000042`.
- Bloc bénéficiaire : nom affiché de l'enseignant + email.
- Bloc paiement : plan (label), période, date de paiement, date d'expiration, moyen.
- Montant en gros, format XAF (`fr-FR` groupé, suffixe `FCFA`).
- Pied : mention « Reçu généré automatiquement — devise XAF ».

### 6. Cohérence & sécurité
- Le montant du reçu est **figé au moment de l'activation** (pas de recalcul si l'admin change le prix plus tard).
- Les utilisateurs ne peuvent pas insérer/modifier de `paiements` (RLS SELECT-only pour `authenticated`).
- Le lien `plan_activation_id` `unique` évite les doublons de reçu si `activatePlan` est rejoué.

## Détails techniques

- **Migration** (dans l'ordre requis) : `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY` → séquence + fonction `set_numero_recu()` + trigger `BEFORE INSERT` sur `paiements`.
- **Devise** : stockée par ligne pour supporter un futur multi-devise ; UI restreinte à `XAF`.
- **Séquentialité annuelle** : la fonction lit `date_part('year', now())` et concatène avec `nextval` — simple et suffisant (pas de reset annuel automatique du compteur ; le préfixe année suffit à l'humain).
- **Route** ajoutée sous `_authenticated`, donc `routeTree.gen.ts` sera régénéré par le plugin Vite.
- **Types Supabase** : `src/integrations/supabase/types.ts` sera régénéré automatiquement après la migration.

## Hors périmètre (pour cette étape)
- Le **paiement en ligne** (Stripe/Paddle) n'est pas branché maintenant — on prépare la table `paiements` (`moyen_paiement`, `plan_activation_id` nullable pour un futur paiement autonome) pour que l'intégration en ligne s'y greffe plus tard sans refonte.
- Pas de facture numérotée avec TVA — reçu simple uniquement, comme convenu.
- Pas d'entête d'entreprise personnalisable (nom, adresse) — un panneau « Coordonnées facturation » côté admin pourra être ajouté ensuite si besoin.
