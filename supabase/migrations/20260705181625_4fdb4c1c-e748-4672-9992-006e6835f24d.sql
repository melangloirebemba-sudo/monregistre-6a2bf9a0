CREATE TABLE public.notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification reads"
  ON public.notification_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification reads"
  ON public.notification_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification reads"
  ON public.notification_reads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification reads"
  ON public.notification_reads FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_notification_reads_user ON public.notification_reads(user_id);