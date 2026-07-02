
-- Fonction utilitaire updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- profils_enseignant
-- =========================================================
create table public.profils_enseignant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nom_affiche text not null default '',
  initiales text not null default 'EM',
  echelle_notation smallint not null default 20 check (echelle_notation in (10, 20, 100)),
  annee_active text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profils_enseignant to authenticated;
grant all on public.profils_enseignant to service_role;
alter table public.profils_enseignant enable row level security;
create policy "profil owner" on public.profils_enseignant
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_profils_upd before update on public.profils_enseignant
  for each row execute function public.set_updated_at();

-- Auto-création d'un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils_enseignant (user_id, nom_affiche, initiales)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_affiche', split_part(new.email, '@', 1)),
    upper(substr(coalesce(new.raw_user_meta_data->>'nom_affiche', new.email), 1, 2))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- ecoles
-- =========================================================
create table public.ecoles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null,
  numero text,
  directeur_etudes text,
  adresse text,
  telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ecoles_user_idx on public.ecoles(user_id);
grant select, insert, update, delete on public.ecoles to authenticated;
grant all on public.ecoles to service_role;
alter table public.ecoles enable row level security;
create policy "ecoles owner" on public.ecoles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_ecoles_upd before update on public.ecoles
  for each row execute function public.set_updated_at();

-- =========================================================
-- classes
-- =========================================================
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  code text not null,
  nom text not null,
  matiere text,
  effectif integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_user_idx on public.classes(user_id);
create index classes_ecole_idx on public.classes(ecole_id);
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "classes owner" on public.classes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_classes_upd before update on public.classes
  for each row execute function public.set_updated_at();

-- =========================================================
-- eleves
-- =========================================================
create table public.eleves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  nom text not null,
  prenom text not null,
  sexe text check (sexe in ('M', 'F', 'Autre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index eleves_user_idx on public.eleves(user_id);
create index eleves_classe_idx on public.eleves(classe_id);
create index eleves_ecole_idx on public.eleves(ecole_id);
grant select, insert, update, delete on public.eleves to authenticated;
grant all on public.eleves to service_role;
alter table public.eleves enable row level security;
create policy "eleves owner" on public.eleves
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_eleves_upd before update on public.eleves
  for each row execute function public.set_updated_at();

-- =========================================================
-- periodes
-- =========================================================
create table public.periodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  annee_scolaire text not null,
  ordre smallint not null default 1,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index periodes_user_idx on public.periodes(user_id);
grant select, insert, update, delete on public.periodes to authenticated;
grant all on public.periodes to service_role;
alter table public.periodes enable row level security;
create policy "periodes owner" on public.periodes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_periodes_upd before update on public.periodes
  for each row execute function public.set_updated_at();

-- =========================================================
-- notes
-- =========================================================
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  periode_id uuid references public.periodes(id) on delete set null,
  sequence_id uuid,
  libelle text not null,
  valeur numeric(6,2) not null,
  coefficient numeric(4,2) not null default 1,
  matiere text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_idx on public.notes(user_id);
create index notes_eleve_idx on public.notes(eleve_id);
create index notes_periode_idx on public.notes(periode_id);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "notes owner" on public.notes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_notes_upd before update on public.notes
  for each row execute function public.set_updated_at();

-- =========================================================
-- absences
-- =========================================================
create table public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  date date not null default current_date,
  justifiee boolean not null default false,
  motif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index absences_user_idx on public.absences(user_id);
create index absences_eleve_idx on public.absences(eleve_id);
grant select, insert, update, delete on public.absences to authenticated;
grant all on public.absences to service_role;
alter table public.absences enable row level security;
create policy "absences owner" on public.absences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_absences_upd before update on public.absences
  for each row execute function public.set_updated_at();

-- =========================================================
-- creneaux (emploi du temps)
-- =========================================================
create table public.creneaux (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  ecole_id uuid not null references public.ecoles(id) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 1 and 7),
  heure_debut time not null,
  heure_fin time not null,
  matiere text,
  salle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creneaux_user_idx on public.creneaux(user_id);
create index creneaux_classe_idx on public.creneaux(classe_id);
grant select, insert, update, delete on public.creneaux to authenticated;
grant all on public.creneaux to service_role;
alter table public.creneaux enable row level security;
create policy "creneaux owner" on public.creneaux
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_creneaux_upd before update on public.creneaux
  for each row execute function public.set_updated_at();

-- =========================================================
-- sequences_programme (progression pédagogique)
-- =========================================================
create table public.sequences_programme (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  classe_id uuid not null references public.classes(id) on delete cascade,
  periode_id uuid references public.periodes(id) on delete set null,
  titre text not null,
  description text,
  semaine_prevue integer,
  statut text not null default 'a_venir' check (statut in ('a_venir','en_cours','terminee','en_retard')),
  date_traitee date,
  notes_libres text,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sequences_user_idx on public.sequences_programme(user_id);
create index sequences_classe_idx on public.sequences_programme(classe_id);
grant select, insert, update, delete on public.sequences_programme to authenticated;
grant all on public.sequences_programme to service_role;
alter table public.sequences_programme enable row level security;
create policy "sequences owner" on public.sequences_programme
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger t_sequences_upd before update on public.sequences_programme
  for each row execute function public.set_updated_at();

-- FK sequences -> notes (ajoutée après création)
alter table public.notes
  add constraint notes_sequence_fk foreign key (sequence_id)
  references public.sequences_programme(id) on delete set null;
