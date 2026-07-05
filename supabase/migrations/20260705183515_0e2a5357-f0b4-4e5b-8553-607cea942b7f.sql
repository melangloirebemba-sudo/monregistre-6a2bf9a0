ALTER TABLE public.profils_enseignant
  ADD COLUMN IF NOT EXISTS notifications_prefs jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', true,
    'categories', jsonb_build_object('feature', true, 'fix', true, 'account', true, 'billing', true),
    'reminderFrequency', 'daily'
  );