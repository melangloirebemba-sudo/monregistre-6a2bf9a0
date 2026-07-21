## Objectif

Ajouter à MonRegistre :
1. Un **mode démo** isolé par visiteur, accessible depuis l'écran de connexion sur web (et mobile).
2. Un **CTA de conversion** vers la création de compte quand l'utilisateur clique sur « Terminer la démo ».
3. Un **tour guidé interactif** (spotlight) déclenché automatiquement en démo, au premier login d'un nouveau compte, et manuellement depuis Paramètres.

---

## 1. Mode démo isolé par visiteur

**Approche technique** : utiliser l'authentification anonyme de Supabase. Chaque visiteur reçoit un utilisateur éphémère unique — vraie isolation, RLS respectée, aucune fuite de données entre visiteurs.

- Activer `sign_in_anonymously` côté Supabase Auth (via `supabase--configure_auth`).
- Sur `/auth`, ajouter un bouton **« Essayer la démo »** au-dessus des onglets connexion/inscription.
- Au clic :
  - `supabase.auth.signInAnonymously()` crée un utilisateur temporaire.
  - Un flag `mr-demo-mode=1` est posé dans `localStorage`.
  - Une **server function `seedDemoData`** peuple l'espace : 1 école, 2 classes, ~10 élèves, quelques notes/absences/paiements réalistes.
  - Redirection vers `/accueil` puis lancement automatique du tour guidé.
- Une **bannière permanente « Mode démo »** s'affiche en haut de l'app (dans `AppShell`) avec :
  - Texte : « Vous explorez MonRegistre en mode démo. Vos données ne sont pas conservées. »
  - Bouton **« Terminer la démo & créer mon compte »**.
- Au clic sur « Terminer » :
  - Purge des données de l'utilisateur anonyme (server fn `wipeDemoData` ou suppression de l'utilisateur anonyme).
  - `signOut`, retrait du flag démo.
  - Redirection vers `/auth?tab=signup` avec l'onglet « Créer un compte » présélectionné et un bandeau « Créez votre compte pour conserver vos données ».

**Sécurité / limites** :
- Les utilisateurs anonymes voient s'appliquer les mêmes RLS que les enseignants. Aucune modification RLS nécessaire.
- Les limites de plan `gratuit` s'appliquent naturellement — les données seed restent sous les seuils.
- L'utilisateur anonyme peut se convertir en compte réel via `updateUser({ email, password })` — proposé optionnellement dans le CTA final.

---

## 2. Redirection vers création de compte

- Modifier `/auth` pour lire un paramètre `?tab=signup` et présélectionner l'onglet inscription.
- Afficher un bandeau contextuel quand on arrive depuis « Terminer la démo » : « Prêt à passer à la vraie chose ? Créez votre compte enseignant. »
- Après création, le tour guidé « premier login » se déclenche (voir section 3).

---

## 3. Tour guidé interactif (spotlight)

**Librairie** : `driver.js` (léger, ~5 KB gzip, sans dépendance).

- Nouveau module `src/lib/tour.ts` qui expose :
  - `startTour(scope)` — lance le tour pour un scope donné (`main`, `notes`, `eleves`).
  - Steps ciblant les éléments clés via `data-tour` :
    1. Menu latéral (Accueil, Écoles, Classes, Élèves, Notes, Emploi du temps).
    2. Bouton « Nouvelle école ».
    3. Bouton « Nouvelle classe ».
    4. Bouton « Ajouter un élève » + saisie par lot.
    5. Bouton « Saisie rapide » des notes.
    6. Badge synchro / mode hors ligne.
    7. Cloche de notifications.
    8. Bouton « Mettre à niveau mon plan ».
- Attributs `data-tour="..."` ajoutés aux composants concernés (`app-shell`, `accueil`, `eleves`, `notes`, `ecoles`, `classes`).
- **Déclencheurs** :
  - Démarrage automatique dès l'entrée en mode démo (flag `mr-tour-demo-done`).
  - Premier login d'un compte réel : détection via `profils_enseignant.tour_completed_at IS NULL` (nouveau champ nullable). À la fin du tour → server fn `markTourCompleted()`.
  - Bouton **« Relancer le tour guidé »** dans `Paramètres` (et sur mobile dans `plus.tsx`).
- Textes en français, boutons « Suivant », « Précédent », « Passer », « Terminer ».
- Responsive : sur mobile, adaptation des positions et fermeture facile (tap hors bulle).

---

## Fichiers touchés

**Nouveaux**
- `src/lib/demo.ts` — helpers `isDemoMode`, `startDemo`, `endDemo`.
- `src/lib/demo-seed.functions.ts` — server fn `seedDemoData`, `wipeDemoData`.
- `src/lib/tour.ts` — définition des steps + `startTour`.
- `src/components/app/demo-banner.tsx` — bannière + dialog de fin.
- `supabase/migrations/*` — ajout colonne `tour_completed_at` sur `profils_enseignant`.

**Modifiés**
- `src/routes/auth.tsx` — bouton démo, onglet `?tab=signup`, bandeau conversion.
- `src/components/app/app-shell.tsx` — insertion `<DemoBanner />` + attributs `data-tour`.
- `src/routes/_authenticated/accueil.tsx` — déclenchement tour post-login + attributs `data-tour`.
- `src/routes/_authenticated/eleves.tsx`, `notes.tsx`, `ecoles.tsx`, `classes.tsx` — attributs `data-tour`.
- `src/routes/_authenticated/parametres.tsx` + `plus.tsx` — bouton « Relancer le tour ».
- Config Supabase Auth : activer `sign_in_anonymously`.

**Dépendance ajoutée**
- `driver.js` (~5 KB).

---

## Livraison

Implémentation en une seule passe. Aucune migration destructive. Le mode démo est opt-in et n'affecte pas les flux existants. Le tour est désactivé après une exécution et rejouable à volonté.
