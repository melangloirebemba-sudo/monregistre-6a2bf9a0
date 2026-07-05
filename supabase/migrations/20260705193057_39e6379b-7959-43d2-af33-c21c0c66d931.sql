-- OTP purpose enum
CREATE TYPE public.otp_purpose AS ENUM ('password_reset', 'phone_verification', 'phone_change');

-- OTP codes table (server-only, service_role manages it)
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  purpose public.otp_purpose NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX otp_codes_phone_purpose_idx ON public.otp_codes (phone, purpose, created_at DESC);
CREATE INDEX otp_codes_user_purpose_idx ON public.otp_codes (user_id, purpose, created_at DESC);

GRANT ALL ON public.otp_codes TO service_role;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → clients cannot read/write; only server (service_role) does.

-- OTP send log (rate-limiting audit, all sends recorded even if fail)
CREATE TABLE public.otp_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  purpose public.otp_purpose NOT NULL,
  ip TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX otp_send_log_phone_created_idx ON public.otp_send_log (phone, created_at DESC);

GRANT ALL ON public.otp_send_log TO service_role;
ALTER TABLE public.otp_send_log ENABLE ROW LEVEL SECURITY;

-- Phone verification status on profils_enseignant
ALTER TABLE public.profils_enseignant
  ADD COLUMN IF NOT EXISTS telephone_verifie BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telephone_verifie_le TIMESTAMPTZ;