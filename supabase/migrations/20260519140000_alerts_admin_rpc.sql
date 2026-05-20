-- Dashboard alert CRUD via SECURITY DEFINER (works with authenticated session + anon key).
-- Run this in Supabase SQL Editor if saving alerts fails.

create or replace function public.save_kiosk_alert(
  p_id uuid,
  p_alert_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_is_active boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.alerts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'operator')
  ) then
    raise exception 'Forbidden: admin or operator role required';
  end if;

  if p_id is null then
    insert into public.alerts (
      alert_type, severity, title, message, is_active, starts_at, ends_at
    )
    values (
      p_alert_type, p_severity, p_title, p_message, p_is_active, p_starts_at, p_ends_at
    )
    returning * into result;
  else
    update public.alerts
    set
      alert_type = p_alert_type,
      severity = p_severity,
      title = p_title,
      message = p_message,
      is_active = p_is_active,
      starts_at = p_starts_at,
      ends_at = p_ends_at
    where id = p_id
    returning * into result;
  end if;

  if result.id is null then
    raise exception 'Alert not found';
  end if;

  return result;
end;
$$;

create or replace function public.delete_kiosk_alert(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  delete from public.alerts where id = p_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.save_kiosk_alert from public;
revoke all on function public.delete_kiosk_alert from public;
grant execute on function public.save_kiosk_alert to authenticated;
grant execute on function public.delete_kiosk_alert to authenticated;
