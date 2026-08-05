CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('check-unvalidated-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-unvalidated-sessions');

SELECT cron.schedule(
  'check-unvalidated-sessions',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://monregistre.lovable.app/api/public/hooks/check-unvalidated-sessions',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_JnX_53xIWvdEe3TGb8kzYw_j1CKCWbI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);