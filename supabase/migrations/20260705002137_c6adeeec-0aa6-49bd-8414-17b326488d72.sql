
DROP POLICY IF EXISTS "recus_select_own"  ON storage.objects;
DROP POLICY IF EXISTS "recus_insert_own"  ON storage.objects;
DROP POLICY IF EXISTS "recus_update_own"  ON storage.objects;
DROP POLICY IF EXISTS "recus_delete_own"  ON storage.objects;
DROP POLICY IF EXISTS "recus_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "recus_all_admin"    ON storage.objects;

CREATE POLICY "recus_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recus'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.paiements p
    WHERE p.user_id = auth.uid()
      AND p.id::text = regexp_replace(storage.filename(name), '\.pdf$', '')
  )
);

CREATE POLICY "recus_select_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recus'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "recus_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recus'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.paiements p
    WHERE p.user_id = auth.uid()
      AND p.id::text = regexp_replace(storage.filename(name), '\.pdf$', '')
  )
);

CREATE POLICY "recus_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'recus'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'recus'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.paiements p
    WHERE p.user_id = auth.uid()
      AND p.id::text = regexp_replace(storage.filename(name), '\.pdf$', '')
  )
);

CREATE POLICY "recus_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'recus'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "recus_all_admin"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'recus'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'recus'
  AND public.has_role(auth.uid(), 'admin')
);
