-- Run AFTER creating the 'certifications' bucket in Supabase Storage dashboard (set to Private)

create policy "Users upload own certs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own certs"
on storage.objects for select
to authenticated
using (bucket_id = 'certifications' AND (storage.foldername(name))[1] = auth.uid()::text);
