# MonRegistre — Plan de construction

Application mobile-first pour enseignants : écoles, classes, élèves, notes, bulletins, emplois du temps et progression pédagogique.

## Approche

Le périmètre est très large (14 groupes de fonctionnalités). Je propose de livrer par **phases fonctionnelles cohérentes**, chacune testable de bout en bout, plutôt que de tout construire d'un coup. À la fin de chaque phase tu valides et je passe à la suivante.

## Stack

- TanStack Start + React 19 + TypeScript (stack du template, équivalent à React Router pour la nav)
- Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase managé) pour auth + base de données + RLS
- jsPDF pour bulletins, recharts pour graphiques, PapaParse pour CSV

## Design system (défini une seule fois, phase 1)

- Palette crème/encre/or/sarcelle en tokens `oklch` dans `src/styles.css`
- Fonts : Playfair Display (serif titres) + DM Sans (body) via `<link>` dans `__root.tsx`
- Variantes shadcn : cartes 16px, bottom-sheet, badges de note colorés, top bar sombre, hero dégradé
- Layout : container mobile max ~430px + nav bottom 5 onglets, responsive tablette/desktop
- Mode sombre optionnel (phase tardive)

## Phases

### Phase 1 — Fondations (design + auth + persistance)
- Design system complet (tokens, fonts, variantes shadcn, top bar, bottom nav, bottom-sheet, toasts)
- Lovable Cloud activé
- Auth email/mot de passe (`/auth`) + route protégée `_authenticated`
- Schéma DB complet avec RLS `user_id = auth.uid()` sur toutes les tables
- Table `profils_enseignant` (nom affiché, initiales, échelle de notation, année active)
- Écran Accueil vide mais avec hero, badges compteurs, actions rapides, grille menu

### Phase 2 — CRUD principal
- Écoles : liste + recherche + ajout + fiche détail (onglets Classes/Élèves/Notes)
- Classes : idem + rattachement école
- Élèves : idem + fiche avec moyenne / bulletin
- Notes : saisie rapide, badges colorés (≥14 vert, ≥10 or, <10 rouge)
- Périodes scolaires (trimestres/semestres) + sélecteur année
- Coefficients + moyenne pondérée
- Recherche transversale + filtres

### Phase 3 — Rapports & bulletins
- Écran Rapports : moyenne générale, min/max, classement
- Bulletins PDF par élève/période (jsPDF)
- Export classement PDF + export notes CSV
- Statistiques : histogramme notes par classe, courbe évolution élève, comparaison classes (recharts)

### Phase 4 — Emploi du temps
- Table `creneaux` + CRUD (jour, horaires, classe, matière, salle)
- Vue hebdo grille jours × créneaux, cartes colorées par classe
- Onglet Emploi du temps sur fiches école et classe
- Détection chevauchements avec alerte visuelle
- Bloc "Aujourd'hui" sur Accueil avec créneau en cours surligné

### Phase 5 — Progression pédagogique
- Table `sequences_programme` + CRUD par classe/trimestre
- Statut auto (à venir / en cours / terminée / en retard)
- Barre de progression par classe/trimestre
- Tableau de bord "Où j'en suis" multi-classes
- Lien optionnel note ↔ séquence, notes libres

### Phase 6 — Absences & import/export
- Table `absences` + marquage présence + compteur sur fiche élève
- Import élèves CSV/Excel (PapaParse)
- Export notes CSV

### Phase 7 — Polissage
- Mode sombre
- Rappels (notes non saisies, fin de période) — via requêtes clientes, pas de push natif
- Mode hors-ligne basique (cache TanStack Query + file d'attente mutations) — **best effort**, une vraie sync offline robuste dépasse le cadre raisonnable ici

## Détails techniques

- Routes TanStack : `/`, `/auth`, `/_authenticated/{ecoles,classes,eleves,notes,rapports,emploi-du-temps,progression,parametres}` + routes détail `$id`
- Toutes les tables ont `user_id uuid not null` + policies RLS `user_id = auth.uid()` + GRANT authenticated
- Sécurité : jamais de rôle stocké sur profil (pas de rôles nécessaires ici, mono-utilisateur par compte)
- Server functions TanStack pour PDF (jsPDF côté client suffit en fait — plus simple)
- Nav bottom 5 onglets : Accueil / Écoles / Classes / Élèves / Plus (menu vers Notes, Rapports, EDT, Progression, Paramètres)

## Questions avant de démarrer

1. **Commence-t-on par la Phase 1 seule** (fondations + accueil vide + auth) pour valider le design et la structure avant d'enchaîner ? C'est ce que je recommande fortement vu l'ampleur.
2. **Nav bottom** : 5 onglets ne suffisent pas pour 9 sections — OK avec le regroupement "Plus" proposé ci-dessus ?
3. **Mode hors-ligne** (point 8) : ambition réaliste = cache lecture + retry mutations, pas une vraie base locale synchronisée. Confirmes-tu ?

Réponds "go phase 1" (ou ajuste) et je démarre.
