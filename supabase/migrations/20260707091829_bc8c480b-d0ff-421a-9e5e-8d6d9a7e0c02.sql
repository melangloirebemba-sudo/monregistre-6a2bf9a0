
-- 1) Table scheduled_notifications
CREATE TABLE public.scheduled_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'admin',
  href TEXT,
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' | 'plan' | 'user'
  target_value TEXT, -- plan name or user_id depending on target_type
  send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  recipients_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'cancelled' | 'draft'
  error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_notifs_pending
  ON public.scheduled_notifications(send_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_notifications TO authenticated;
GRANT ALL ON public.scheduled_notifications TO service_role;

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scheduled notifications"
  ON public.scheduled_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scheduled notifications"
  ON public.scheduled_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scheduled notifications"
  ON public.scheduled_notifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete scheduled notifications"
  ON public.scheduled_notifications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_scheduled_notifs_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) pg_cron: dispatch scheduled notifications every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'dispatch-scheduled-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://monregistre.lovable.app/api/public/hooks/dispatch-scheduled-notifications',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_JnX_53xIWvdEe3TGb8kzYw_j1CKCWbI"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
