-- Marketing Command Center foundation. Apply manually after review; this PR does not deploy it.
create schema marketing;
revoke all on schema marketing from public, anon, authenticated;
grant usage on schema marketing to authenticated;

create table marketing.workspaces (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index marketing_one_default_workspace on marketing.workspaces(is_default) where is_default;

create table marketing.workspace_members (
  workspace_id uuid not null references marketing.workspaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('viewer','contributor','approver','admin')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table marketing.campaigns (
  id uuid primary key,
  workspace_id uuid not null references marketing.workspaces(id),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 4000),
  status text not null default 'draft' check (status in ('draft','planned','active','paused','completed','cancelled')),
  approval_state text not null default 'draft' check (approval_state in ('draft','in_review','changes_requested','approved')),
  objectives text[] not null default '{}',
  target_audiences text[] not null default '{}',
  channels text[] not null default '{}',
  owner_user_id uuid references auth.users(id),
  budget_amount numeric(14,2) check (budget_amount is null or budget_amount >= 0),
  budget_currency text not null default 'USD' check (budget_currency ~ '^[A-Z]{3}$'),
  starts_on date,
  ends_on date,
  attribution_key text not null,
  created_by uuid not null references auth.users(id),
  created_via text not null default 'human' check (created_via in ('human','agent')),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  unique (workspace_id,id), unique(workspace_id,attribution_key),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (attribution_key ~ '^[a-z0-9][a-z0-9._-]{2,127}$'),
  check (status <> 'active' or approval_state = 'approved')
);

create table marketing.campaign_kpis (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, campaign_id uuid not null,
  name text not null, target_value numeric, unit text not null default 'count', created_at timestamptz not null default now(),
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id) on delete cascade
);
create table marketing.campaign_tasks (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, campaign_id uuid not null,
  title text not null, status text not null default 'todo' check(status in ('todo','in_progress','blocked','done')),
  owner_user_id uuid references auth.users(id), due_on date, created_at timestamptz not null default now(),
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id) on delete cascade
);
create table marketing.assets (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, campaign_id uuid not null,
  name text not null, asset_type text not null, uri text, approval_state text not null default 'draft'
    check(approval_state in ('draft','in_review','changes_requested','approved')),
  publication_state text not null default 'unpublished' check(publication_state in ('unpublished','published','retired')),
  created_by uuid not null references auth.users(id), created_via text not null default 'human' check(created_via in ('human','agent')),
  approved_by uuid references auth.users(id), approved_at timestamptz, published_by uuid references auth.users(id), published_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id) on delete cascade,
  check ((approval_state='approved') = (approved_by is not null and approved_at is not null)),
  check ((publication_state='published') = (published_by is not null and published_at is not null)),
  check (publication_state <> 'published' or approval_state='approved')
);
create table marketing.agent_runs (
  id uuid primary key, workspace_id uuid not null references marketing.workspaces(id), campaign_id uuid,
  agent_key text not null, purpose text not null, status text not null check(status in ('started','succeeded','failed','cancelled')),
  initiated_by uuid not null references auth.users(id), external_run_ref text, started_at timestamptz not null default now(), ended_at timestamptz,
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id)
);
create table marketing.events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, campaign_id uuid,
  attribution_key text not null, event_type text not null check(event_type in ('web','social','email','print','dealer_lead','recruiting_lead','revenue','other')),
  metric_name text not null, metric_value numeric not null, occurred_at timestamptz not null,
  source_system text not null, source_event_id text not null, dimensions jsonb not null default '{}', created_at timestamptz not null default now(),
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id), unique(workspace_id,source_system,source_event_id)
);
create table marketing.campaign_transitions (
  id bigint generated always as identity primary key, workspace_id uuid not null, campaign_id uuid not null,
  from_status text, to_status text not null, from_approval_state text, to_approval_state text not null,
  actor_type text not null check(actor_type in ('human','agent')), actor_user_id uuid not null references auth.users(id),
  agent_run_id uuid references marketing.agent_runs(id), reason text, occurred_at timestamptz not null default now(),
  foreign key (workspace_id,campaign_id) references marketing.campaigns(workspace_id,id),
  check ((actor_type='agent') = (agent_run_id is not null)),
  check (actor_type <> 'agent' or (to_approval_state <> 'approved' and to_status <> 'active'))
);
create index marketing_campaigns_workspace_updated on marketing.campaigns(workspace_id,updated_at desc);
create index marketing_events_attribution on marketing.events(workspace_id,attribution_key,occurred_at desc);
create index marketing_transitions_campaign on marketing.campaign_transitions(workspace_id,campaign_id,occurred_at desc);

insert into marketing.workspaces(id,slug,name,is_default)
values ('4f52494f-4e00-4000-8000-000000000001','orion','Orion',true);

alter table marketing.workspaces enable row level security;
alter table marketing.workspace_members enable row level security;
alter table marketing.campaigns enable row level security;
alter table marketing.campaign_kpis enable row level security;
alter table marketing.campaign_tasks enable row level security;
alter table marketing.assets enable row level security;
alter table marketing.agent_runs enable row level security;
alter table marketing.events enable row level security;
alter table marketing.campaign_transitions enable row level security;
revoke all on all tables in schema marketing from public,anon,authenticated;

create function marketing.has_membership(p_workspace uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from marketing.workspace_members m where m.workspace_id=p_workspace and m.user_id=auth.uid()
   and (p_roles is null or m.role=any(p_roles)))
$$;
revoke all on function marketing.has_membership(uuid,text[]) from public,anon,authenticated;

create policy workspace_member_read on marketing.workspaces for select to authenticated
 using (marketing.has_membership(id));
create policy membership_self_read on marketing.workspace_members for select to authenticated
 using (user_id=auth.uid());
create policy campaign_member_read on marketing.campaigns for select to authenticated using(marketing.has_membership(workspace_id));
create policy kpi_member_read on marketing.campaign_kpis for select to authenticated using(marketing.has_membership(workspace_id));
create policy task_member_read on marketing.campaign_tasks for select to authenticated using(marketing.has_membership(workspace_id));
create policy asset_member_read on marketing.assets for select to authenticated using(marketing.has_membership(workspace_id));
create policy run_member_read on marketing.agent_runs for select to authenticated using(marketing.has_membership(workspace_id));
create policy event_member_read on marketing.events for select to authenticated using(marketing.has_membership(workspace_id));
create policy transition_member_read on marketing.campaign_transitions for select to authenticated using(marketing.has_membership(workspace_id));
grant select on all tables in schema marketing to authenticated;

create function marketing.prevent_audit_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Marketing audit records are append-only'; end $$;
create trigger immutable_campaign_transitions before update or delete on marketing.campaign_transitions
 for each row execute function marketing.prevent_audit_mutation();
revoke all on function marketing.prevent_audit_mutation() from public,anon,authenticated;

create function public.read_marketing_workspace(p_workspace uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w marketing.workspaces; result jsonb;
begin
 select x.* into w from marketing.workspaces x join marketing.workspace_members m on m.workspace_id=x.id
  where m.user_id=auth.uid() and (p_workspace is null or x.id=p_workspace) order by x.is_default desc,x.created_at limit 1;
 if not found then raise exception 'Marketing workspace unavailable' using errcode='42501'; end if;
 select jsonb_build_object('workspace',to_jsonb(w),'role',(select role from marketing.workspace_members where workspace_id=w.id and user_id=auth.uid()),
  'campaigns',coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc),'[]'::jsonb)) into result
 from marketing.campaigns c where c.workspace_id=w.id;
 return result;
end $$;

create function public.save_marketing_campaign(p_id uuid,p_workspace uuid,p_expected_revision integer,p_payload jsonb,p_actor_type text default 'human',p_agent_run uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare old marketing.campaigns; c marketing.campaigns; member_role text; next_status text; next_approval text; allowed text[];
begin
 select role into member_role from marketing.workspace_members where workspace_id=p_workspace and user_id=auth.uid();
 if member_role is null or member_role not in ('contributor','approver','admin') then raise exception 'Marketing write access unavailable' using errcode='42501'; end if;
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid campaign'; end if;
 allowed:=array['name','description','status','approval_state','objectives','target_audiences','channels','owner_user_id','budget_amount','budget_currency','starts_on','ends_on','attribution_key'];
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) then raise exception 'Unexpected campaign field'; end if;
 next_status:=coalesce(p_payload->>'status','draft'); next_approval:=coalesce(p_payload->>'approval_state','draft');
 if p_actor_type not in ('human','agent') then raise exception 'Invalid actor type'; end if;
 if p_actor_type='agent' and (p_agent_run is null or next_approval='approved' or next_status='active') then raise exception 'Agents cannot approve or activate marketing'; end if;
 if p_actor_type='human' and p_agent_run is not null then raise exception 'Human changes cannot claim an agent run'; end if;
 if next_approval='approved' and member_role not in ('approver','admin') then raise exception 'Human approver role required'; end if;
 if nullif(p_payload->>'owner_user_id','') is not null and not exists(
   select 1 from marketing.workspace_members where workspace_id=p_workspace and user_id=(p_payload->>'owner_user_id')::uuid
 ) then raise exception 'Campaign owner must belong to the workspace'; end if;
 if p_agent_run is not null and not exists(select 1 from marketing.agent_runs r where r.id=p_agent_run and r.workspace_id=p_workspace and r.initiated_by=auth.uid()) then raise exception 'Agent run unavailable'; end if;
 select * into old from marketing.campaigns where id=p_id and workspace_id=p_workspace for update;
 if found then
  if p_expected_revision is null or old.revision<>p_expected_revision then raise exception 'Campaign changed; refresh before retrying'; end if;
  update marketing.campaigns set name=p_payload->>'name',description=coalesce(p_payload->>'description',''),status=next_status,
   approval_state=next_approval,objectives=coalesce(array(select jsonb_array_elements_text(p_payload->'objectives')),'{}'),
   target_audiences=coalesce(array(select jsonb_array_elements_text(p_payload->'target_audiences')),'{}'),channels=coalesce(array(select jsonb_array_elements_text(p_payload->'channels')),'{}'),
   owner_user_id=nullif(p_payload->>'owner_user_id','')::uuid,budget_amount=nullif(p_payload->>'budget_amount','')::numeric,
   budget_currency=coalesce(nullif(p_payload->>'budget_currency',''),'USD'),starts_on=nullif(p_payload->>'starts_on','')::date,ends_on=nullif(p_payload->>'ends_on','')::date,
   attribution_key=p_payload->>'attribution_key',updated_by=auth.uid(),updated_at=now(),revision=revision+1 where id=p_id returning * into c;
 else
  if p_expected_revision is not null then raise exception 'Campaign unavailable'; end if;
  insert into marketing.campaigns(id,workspace_id,name,description,status,approval_state,objectives,target_audiences,channels,owner_user_id,budget_amount,budget_currency,starts_on,ends_on,attribution_key,created_by,created_via,updated_by)
  values(p_id,p_workspace,p_payload->>'name',coalesce(p_payload->>'description',''),next_status,next_approval,
   coalesce(array(select jsonb_array_elements_text(p_payload->'objectives')),'{}'),coalesce(array(select jsonb_array_elements_text(p_payload->'target_audiences')),'{}'),coalesce(array(select jsonb_array_elements_text(p_payload->'channels')),'{}'),
   nullif(p_payload->>'owner_user_id','')::uuid,nullif(p_payload->>'budget_amount','')::numeric,coalesce(nullif(p_payload->>'budget_currency',''),'USD'),nullif(p_payload->>'starts_on','')::date,nullif(p_payload->>'ends_on','')::date,p_payload->>'attribution_key',auth.uid(),p_actor_type,auth.uid()) returning * into c;
 end if;
 insert into marketing.campaign_transitions(workspace_id,campaign_id,from_status,to_status,from_approval_state,to_approval_state,actor_type,actor_user_id,agent_run_id)
 values(p_workspace,p_id,old.status,c.status,old.approval_state,c.approval_state,p_actor_type,auth.uid(),p_agent_run);
 return p_id;
end $$;
revoke all on function public.read_marketing_workspace(uuid),public.save_marketing_campaign(uuid,uuid,integer,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.read_marketing_workspace(uuid),public.save_marketing_campaign(uuid,uuid,integer,jsonb,text,uuid) to authenticated;
