
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_number text NOT NULL DEFAULT '242069626540',
  whatsapp_display text NOT NULL DEFAULT '+242 06 962 65 40',
  support_email text NOT NULL DEFAULT 'support@monregistre.app',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings readable by all"
  ON public.app_settings FOR SELECT
  USING (true);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
