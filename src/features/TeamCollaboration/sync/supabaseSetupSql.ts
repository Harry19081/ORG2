import {
  SUPABASE_SESSION_SNAPSHOT_BUCKET,
  SUPABASE_SYNC_SCHEMA_VERSION,
} from "@src/store/collaboration/types";

export const ORGII_SUPABASE_SETUP_SQL = `create extension if not exists pgcrypto;

create table if not exists public.orgii_sync_meta (
  schema_version integer primary key,
  created_at timestamptz not null default now()
);

insert into public.orgii_sync_meta (schema_version)
values (${SUPABASE_SYNC_SCHEMA_VERSION})
on conflict (schema_version) do nothing;

create table if not exists public.orgii_orgs (
  id text primary key,
  name text not null,
  secret_hash text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orgii_members (
  id text not null,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  display_name text not null,
  identity_kind text not null,
  role text not null,
  payload jsonb not null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (org_id, id)
);

create table if not exists public.orgii_invites (
  id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  invite_code_hash text not null unique,
  usage_limit integer not null default 10,
  usage_count integer not null default 0,
  expires_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.orgii_projects (
  id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orgii_work_items (
  id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orgii_sessions (
  id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  owner_member_id text not null,
  source_session_id text not null,
  access_mode text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orgii_chat_messages (
  id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  author_member_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orgii_session_snapshot_requests (
  request_id text primary key,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  requester_member_id text not null,
  owner_member_id text not null,
  source_session_id text not null,
  status text not null,
  error text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orgii_session_snapshots (
  request_id text primary key references public.orgii_session_snapshot_requests(request_id) on delete cascade,
  org_id text not null references public.orgii_orgs(id) on delete cascade,
  source_session_id text not null,
  blob_path text not null,
  content_hash text not null,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.orgii_sync_meta enable row level security;
alter table public.orgii_orgs enable row level security;
alter table public.orgii_members enable row level security;
alter table public.orgii_invites enable row level security;
alter table public.orgii_projects enable row level security;
alter table public.orgii_work_items enable row level security;
alter table public.orgii_sessions enable row level security;
alter table public.orgii_chat_messages enable row level security;
alter table public.orgii_session_snapshot_requests enable row level security;
alter table public.orgii_session_snapshots enable row level security;

do $$
begin
  if not exists (select 1 from storage.buckets where id = '${SUPABASE_SESSION_SNAPSHOT_BUCKET}') then
    insert into storage.buckets (id, name, public)
    values ('${SUPABASE_SESSION_SNAPSHOT_BUCKET}', '${SUPABASE_SESSION_SNAPSHOT_BUCKET}', false);
  end if;
end $$;

drop policy if exists orgii_snapshots_anon_read on storage.objects;
drop policy if exists orgii_snapshots_anon_insert on storage.objects;
drop policy if exists orgii_snapshots_anon_update on storage.objects;

create policy orgii_snapshots_anon_read
on storage.objects for select to anon
using (bucket_id = '${SUPABASE_SESSION_SNAPSHOT_BUCKET}');

create policy orgii_snapshots_anon_insert
on storage.objects for insert to anon
with check (bucket_id = '${SUPABASE_SESSION_SNAPSHOT_BUCKET}');

create policy orgii_snapshots_anon_update
on storage.objects for update to anon
using (bucket_id = '${SUPABASE_SESSION_SNAPSHOT_BUCKET}')
with check (bucket_id = '${SUPABASE_SESSION_SNAPSHOT_BUCKET}');

create or replace function public.orgii_sync_version()
returns integer
language sql
security definer
set search_path = public
as $$
  select max(schema_version) from public.orgii_sync_meta;
$$;

create or replace function public.orgii_validate_org_secret(p_org_id text, p_org_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orgii_orgs
    where id = p_org_id
      and secret_hash = encode(digest(p_org_secret, 'sha256'), 'hex')
  ) or exists (
    select 1
    from public.orgii_invites
    where org_id = p_org_id
      and invite_code_hash = encode(digest(p_org_secret, 'sha256'), 'hex')
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.orgii_create_org(
  org_name text,
  display_name text,
  identity_kind text,
  org_secret_hash text,
  payload jsonb,
  member_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_org_id text := coalesce(payload->>'id', gen_random_uuid()::text);
  next_member_id text := coalesce(member_payload->>'id', gen_random_uuid()::text);
begin
  insert into public.orgii_orgs (id, name, secret_hash, payload)
  values (next_org_id, org_name, org_secret_hash, jsonb_set(payload, '{id}', to_jsonb(next_org_id), true));

  insert into public.orgii_members (id, org_id, display_name, identity_kind, role, payload)
  values (
    next_member_id,
    next_org_id,
    display_name,
    identity_kind,
    'admin',
    jsonb_set(jsonb_set(member_payload, '{id}', to_jsonb(next_member_id), true), '{orgId}', to_jsonb(next_org_id), true)
  );

  return jsonb_build_object(
    'org', (select payload from public.orgii_orgs where id = next_org_id),
    'member', (select payload from public.orgii_members where org_id = next_org_id and id = next_member_id)
  );
end;
$$;

create or replace function public.orgii_create_invite(
  org_secret text,
  org_id text,
  invite_code_hash text,
  usage_limit integer,
  expires_at timestamptz,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_invite_id text := coalesce(payload->>'id', gen_random_uuid()::text);
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_invites (id, org_id, invite_code_hash, usage_limit, expires_at, payload)
  values (next_invite_id, org_id, invite_code_hash, coalesce(usage_limit, 10), expires_at, payload);

  return (select payload from public.orgii_invites where id = next_invite_id);
end;
$$;

create or replace function public.orgii_accept_invite(
  invite_code text,
  display_name text,
  identity_kind text,
  member_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invite record;
  next_member_id text := coalesce(member_payload->>'id', gen_random_uuid()::text);
begin
  select * into matched_invite
  from public.orgii_invites
  where invite_code_hash = encode(digest(invite_code, 'sha256'), 'hex')
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and usage_count < usage_limit
  limit 1;

  if matched_invite.id is null then
    raise exception 'Invite is invalid or expired';
  end if;

  insert into public.orgii_members (id, org_id, display_name, identity_kind, role, payload)
  values (
    next_member_id,
    matched_invite.org_id,
    display_name,
    identity_kind,
    'member',
    jsonb_set(jsonb_set(member_payload, '{id}', to_jsonb(next_member_id), true), '{orgId}', to_jsonb(matched_invite.org_id), true)
  )
  on conflict (org_id, id) do update set
    display_name = excluded.display_name,
    identity_kind = excluded.identity_kind,
    payload = excluded.payload,
    removed_at = null;

  update public.orgii_invites
  set usage_count = usage_count + 1,
      payload = jsonb_set(payload, '{usageCount}', to_jsonb(usage_count + 1), true)
  where id = matched_invite.id;

  return jsonb_build_object(
    'org', (select payload from public.orgii_orgs where id = matched_invite.org_id),
    'member', (select payload from public.orgii_members where org_id = matched_invite.org_id and id = next_member_id)
  );
end;
$$;

create or replace function public.orgii_remove_member(org_secret text, org_id text, member_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  update public.orgii_members
  set removed_at = now(), payload = jsonb_set(payload, '{removedAt}', to_jsonb(now()::text), true)
  where orgii_members.org_id = orgii_remove_member.org_id and id = member_id;

  return (select payload from public.orgii_members where orgii_members.org_id = orgii_remove_member.org_id and id = member_id);
end;
$$;

create or replace function public.orgii_upsert_member(org_secret text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(payload->>'orgId', org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_members (id, org_id, display_name, identity_kind, role, payload)
  values (payload->>'id', payload->>'orgId', payload->>'displayName', payload->>'identityKind', payload->>'role', payload)
  on conflict (org_id, id) do update set
    display_name = excluded.display_name,
    identity_kind = excluded.identity_kind,
    role = excluded.role,
    payload = excluded.payload,
    removed_at = null;
end;
$$;

create or replace function public.orgii_upsert_project(org_secret text, org_id text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_projects (id, org_id, payload)
  values (coalesce(payload->>'id', gen_random_uuid()::text), org_id, payload)
  on conflict (id) do update set
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.orgii_upsert_work_item(org_secret text, org_id text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_work_items (id, org_id, payload)
  values (coalesce(payload->>'id', gen_random_uuid()::text), org_id, payload)
  on conflict (id) do update set
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.orgii_upsert_session_metadata(org_secret text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(payload->>'orgId', org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_sessions (id, org_id, owner_member_id, source_session_id, access_mode, payload)
  values (payload->>'id', payload->>'orgId', payload->>'ownerMemberId', payload->>'sourceSessionId', payload->>'accessMode', payload)
  on conflict (id) do update set
    access_mode = excluded.access_mode,
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.orgii_remove_session_metadata(org_secret text, org_id text, owner_member_id text, source_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  delete from public.orgii_sessions
  where orgii_sessions.org_id = orgii_remove_session_metadata.org_id
    and orgii_sessions.owner_member_id = orgii_remove_session_metadata.owner_member_id
    and orgii_sessions.source_session_id = orgii_remove_session_metadata.source_session_id;
end;
$$;

create or replace function public.orgii_post_chat_message(org_secret text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(payload->>'orgId', org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_chat_messages (id, org_id, author_member_id, payload)
  values (payload->>'id', payload->>'orgId', payload->>'authorMemberId', payload)
  on conflict (id) do update set payload = excluded.payload;

  return payload;
end;
$$;

create or replace function public.orgii_request_session_snapshot(org_secret text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(payload->>'orgId', org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_session_snapshot_requests (
    request_id, org_id, requester_member_id, owner_member_id, source_session_id, status, payload
  ) values (
    payload->>'requestId', payload->>'orgId', payload->>'requesterMemberId', payload->>'ownerMemberId', payload->>'sourceSessionId', payload->>'status', payload
  ) on conflict (request_id) do update set
    status = excluded.status,
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.orgii_create_session_snapshot(
  org_secret text,
  request_id text,
  org_id text,
  source_session_id text,
  metadata jsonb,
  blob_path text,
  content_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  insert into public.orgii_session_snapshots (request_id, org_id, source_session_id, blob_path, content_hash, metadata)
  values (request_id, org_id, source_session_id, blob_path, content_hash, metadata)
  on conflict (request_id) do update set
    blob_path = excluded.blob_path,
    content_hash = excluded.content_hash,
    metadata = excluded.metadata;

  update public.orgii_session_snapshot_requests
  set status = 'completed', updated_at = now(), payload = jsonb_set(payload, '{status}', to_jsonb('completed'::text), true)
  where orgii_session_snapshot_requests.request_id = orgii_create_session_snapshot.request_id;
end;
$$;

create or replace function public.orgii_deny_session_snapshot(org_secret text, request_id text, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_org_id text;
begin
  select org_id into request_org_id
  from public.orgii_session_snapshot_requests
  where orgii_session_snapshot_requests.request_id = orgii_deny_session_snapshot.request_id;

  if request_org_id is null or not public.orgii_validate_org_secret(request_org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  update public.orgii_session_snapshot_requests
  set status = 'denied', error = reason, updated_at = now(),
      payload = jsonb_set(jsonb_set(payload, '{status}', to_jsonb('denied'::text), true), '{error}', to_jsonb(reason), true)
  where orgii_session_snapshot_requests.request_id = orgii_deny_session_snapshot.request_id;
end;
$$;

create or replace function public.orgii_list_org_state(org_secret text, org_id text, since_timestamp timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.orgii_validate_org_secret(org_id, org_secret) then
    raise exception 'Invalid ORG secret';
  end if;

  return jsonb_build_object(
    'orgs', coalesce((select jsonb_agg(payload) from public.orgii_orgs where id = org_id), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(payload) from public.orgii_members where orgii_members.org_id = orgii_list_org_state.org_id and removed_at is null), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(payload) from public.orgii_invites where orgii_invites.org_id = orgii_list_org_state.org_id and revoked_at is null), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(payload) from public.orgii_projects where orgii_projects.org_id = orgii_list_org_state.org_id), '[]'::jsonb),
    'workItems', coalesce((select jsonb_agg(payload) from public.orgii_work_items where orgii_work_items.org_id = orgii_list_org_state.org_id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(payload) from public.orgii_sessions where orgii_sessions.org_id = orgii_list_org_state.org_id), '[]'::jsonb),
    'chatMessages', coalesce((select jsonb_agg(payload) from public.orgii_chat_messages where orgii_chat_messages.org_id = orgii_list_org_state.org_id), '[]'::jsonb),
    'snapshotRequests', coalesce((
      select jsonb_agg(
        orgii_session_snapshot_requests.payload || jsonb_build_object(
          'error', orgii_session_snapshot_requests.error,
          'blobPath', orgii_session_snapshots.blob_path,
          'contentHash', orgii_session_snapshots.content_hash,
          'session', orgii_session_snapshots.metadata
        )
      )
      from public.orgii_session_snapshot_requests
      left join public.orgii_session_snapshots using (request_id)
      where orgii_session_snapshot_requests.org_id = orgii_list_org_state.org_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.orgii_sync_version() to anon;
grant execute on function public.orgii_create_org(text, text, text, text, jsonb, jsonb) to anon;
grant execute on function public.orgii_create_invite(text, text, text, integer, timestamptz, jsonb) to anon;
grant execute on function public.orgii_accept_invite(text, text, text, jsonb) to anon;
grant execute on function public.orgii_remove_member(text, text, text) to anon;
grant execute on function public.orgii_upsert_member(text, jsonb) to anon;
grant execute on function public.orgii_upsert_project(text, text, jsonb) to anon;
grant execute on function public.orgii_upsert_work_item(text, text, jsonb) to anon;
grant execute on function public.orgii_upsert_session_metadata(text, jsonb) to anon;
grant execute on function public.orgii_remove_session_metadata(text, text, text, text) to anon;
grant execute on function public.orgii_post_chat_message(text, jsonb) to anon;
grant execute on function public.orgii_request_session_snapshot(text, jsonb) to anon;
grant execute on function public.orgii_create_session_snapshot(text, text, text, text, jsonb, text, text) to anon;
grant execute on function public.orgii_deny_session_snapshot(text, text, text) to anon;
grant execute on function public.orgii_list_org_state(text, text, timestamptz) to anon;`;
