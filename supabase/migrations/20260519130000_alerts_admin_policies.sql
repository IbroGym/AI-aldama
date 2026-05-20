-- Allow dashboard admins/operators to manage kiosk service alerts.

drop policy if exists "alerts_insert_admin_operator" on public.alerts;
create policy "alerts_insert_admin_operator"
  on public.alerts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'operator')
    )
  );

drop policy if exists "alerts_update_admin_operator" on public.alerts;
create policy "alerts_update_admin_operator"
  on public.alerts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'operator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'operator')
    )
  );

drop policy if exists "alerts_delete_admin" on public.alerts;
create policy "alerts_delete_admin"
  on public.alerts
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
