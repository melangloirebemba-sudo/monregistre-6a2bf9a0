DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='scheduled_notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_notifications';
  END IF;
END $$;
ALTER TABLE public.scheduled_notifications REPLICA IDENTITY FULL;