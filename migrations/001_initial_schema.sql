-- Chain initial schema (architecture §7). Applied by a person, never by an agent.
-- Revised in S1b before its first application (intent/s1b-sync/spec.md): S1a and S2 fields,
-- checks state, webhook idempotency, and replace_repo_state() for one-transaction refreshes.
-- Every table: created_at, updated_at, row-level security on, default deny.
-- Public repositories are readable by anyone (demo mode); everything else by the owner only.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- repos ---------------------------------------------------------------------
create table repos (
  id              uuid primary key default gen_random_uuid(),
  owner_user      uuid references auth.users(id) on delete cascade,
  gh_repo_id      bigint unique,                 -- GitHub's id: survives renames, matches webhooks
  gh_owner        text not null,
  gh_name         text not null,
  installation_id bigint,
  default_branch  text not null default 'main',
  paths           jsonb not null default '{"capabilities":"capabilities","intent":"intent"}',
  is_public       boolean not null default false,
  refreshed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (gh_owner, gh_name)
);

-- capabilities --------------------------------------------------------------
create table capabilities (
  id          uuid primary key default gen_random_uuid(),
  repo_id     uuid not null references repos(id) on delete cascade,
  slug        text not null,
  statement   text not null,
  owner       text,
  target      text,
  source_path text not null,
  source_sha  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (repo_id, slug)
);

-- features ------------------------------------------------------------------
create table features (
  id            uuid primary key default gen_random_uuid(),
  repo_id       uuid not null references repos(id) on delete cascade,
  capability_id uuid references capabilities(id) on delete set null,
  slug          text not null,
  title         text,
  lifecycle     text not null default 'idea'
                check (lifecycle in ('no intent','idea','specified','planned','building','shipped')),
  health        text not null default 'on track'
                check (health in ('on track','blocked','drift')),
  health_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (repo_id, slug)
);

-- artifacts -----------------------------------------------------------------
create table artifacts (
  id               uuid primary key default gen_random_uuid(),
  feature_id       uuid not null references features(id) on delete cascade,
  type             text not null check (type in ('intent','spec','plan')),
  state            text not null default 'absent'
                   check (state in ('absent','proposed','accepted','revising')),
  path             text,
  sha              text,
  pr_number        integer,
  first_commit_at  timestamptz,
  accepted_at      timestamptz,
  revision_count   integer not null default 0,
  source_surface   text not null default 'unknown',
  source_confidence text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (feature_id, type)
);

-- pull_requests -------------------------------------------------------------
create table pull_requests (
  id                uuid primary key default gen_random_uuid(),
  repo_id           uuid not null references repos(id) on delete cascade,
  feature_id        uuid references features(id) on delete set null,
  capability_id     uuid references capabilities(id) on delete set null,
  kind              text not null default 'unlinked'
                    check (kind in ('feature','light','unlinked')),
  role              text check (role in ('artifact','build')),  -- feature PRs only
  plan_complete     boolean not null default false,
  light_reason      text,
  draft             boolean not null default false,
  head_sha          text,
  changed_files     integer,
  changed_lines     integer,
  number            integer not null,
  title             text,
  state             text not null check (state in ('open','closed','merged')),
  merged_at         timestamptz,
  last_activity_at  timestamptz,
  changes_requested boolean not null default false,
  checks_state      text check (checks_state in ('passing','failing','none')),
  divergences       text,
  url               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (repo_id, number)
);

-- review_findings -----------------------------------------------------------
create table review_findings (
  id         uuid primary key default gen_random_uuid(),
  pr_id      uuid not null references pull_requests(id) on delete cascade,
  pass       text not null,
  severity   text not null check (severity in ('block','important','nit')),
  excerpt    text,
  url        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- signals -------------------------------------------------------------------
create table signals (
  id             uuid primary key default gen_random_uuid(),
  repo_id        uuid not null references repos(id) on delete cascade,
  feature_id     uuid references features(id) on delete cascade,
  pr_id          uuid references pull_requests(id) on delete cascade,
  kind           text not null,
  severity       text not null check (severity in ('info','warn','high')),
  rule           text not null,
  message        text not null,
  evidence_type  text check (evidence_type in ('commit','pr','review','comment')),
  evidence_ref   text,
  evidence_at    timestamptz,
  evidence_url   text,
  detected_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users(id),
  resolution     text,
  feedback_valid boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (feature_id is not null or pr_id is not null)  -- a signal attaches to a feature or a PR
);

-- sessions (aggregates only; ADR-0006, proposed) ------------------------------
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  repo_id      uuid not null references repos(id) on delete cascade,
  feature_id   uuid references features(id) on delete set null,
  started_at   timestamptz,
  ended_at     timestamptz,
  model        text,
  plan_mode    boolean,
  tool_counts  jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table hook_decisions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  repo_id     uuid not null references repos(id) on delete cascade,
  hook_name   text not null,
  decision    text not null,
  decided_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- links (work items in PM tools; ADR-0007) --------------------------------------
create table links (
  id            uuid primary key default gen_random_uuid(),
  feature_id    uuid not null references features(id) on delete cascade,
  system        text not null check (system in ('jira','linear','azure_devops','github_issue')),
  external_id   text not null,
  url           text,
  last_status   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (feature_id, system, external_id)
);

-- observations (append-only audit trail; ADR-0005) ------------------------------
create table observations (
  id          uuid primary key default gen_random_uuid(),
  repo_id     uuid not null references repos(id) on delete cascade,
  source      text not null,
  kind        text not null,
  payload     jsonb not null,
  observed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- sync_cache ------------------------------------------------------------------
create table sync_cache (
  key        text primary key,
  etag       text,
  body       jsonb,
  fetched_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),   -- last time GitHub confirmed it (200 or 304)
  changed    boolean not null default false,       -- marked by a webhook: re-check before use
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- webhook_deliveries (idempotency; kept 7 days) --------------------------------
create table webhook_deliveries (
  delivery_id text primary key,                    -- X-GitHub-Delivery
  event       text not null,
  received_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at triggers ---------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'repos','capabilities','features','artifacts','pull_requests','review_findings',
    'signals','sessions','hook_decisions','links','observations','sync_cache','webhook_deliveries'])
  loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   'trg_' || t || '_updated_at', t);
  end loop;
end $$;

-- row-level security ----------------------------------------------------------
-- Default deny. Writes happen only from api/ with the service-role key (bypasses RLS).
alter table repos            enable row level security;
alter table capabilities     enable row level security;
alter table features         enable row level security;
alter table artifacts        enable row level security;
alter table pull_requests    enable row level security;
alter table review_findings  enable row level security;
alter table signals          enable row level security;
alter table sessions         enable row level security;
alter table hook_decisions   enable row level security;
alter table links            enable row level security;
alter table observations     enable row level security;
alter table sync_cache       enable row level security;  -- no policy: service role only
alter table webhook_deliveries enable row level security; -- no policy: service role only

create policy repos_read on repos for select
  using (is_public or owner_user = auth.uid());

create policy capabilities_read on capabilities for select
  using (exists (select 1 from repos r where r.id = capabilities.repo_id
                 and (r.is_public or r.owner_user = auth.uid())));

create policy features_read on features for select
  using (exists (select 1 from repos r where r.id = features.repo_id
                 and (r.is_public or r.owner_user = auth.uid())));

create policy artifacts_read on artifacts for select
  using (exists (select 1 from features f join repos r on r.id = f.repo_id
                 where f.id = artifacts.feature_id and (r.is_public or r.owner_user = auth.uid())));

create policy pull_requests_read on pull_requests for select
  using (exists (select 1 from repos r where r.id = pull_requests.repo_id
                 and (r.is_public or r.owner_user = auth.uid())));

create policy review_findings_read on review_findings for select
  using (exists (select 1 from pull_requests p join repos r on r.id = p.repo_id
                 where p.id = review_findings.pr_id and (r.is_public or r.owner_user = auth.uid())));

create policy signals_read on signals for select
  using (exists (select 1 from repos r where r.id = signals.repo_id
                 and (r.is_public or r.owner_user = auth.uid())));

create policy links_read on links for select
  using (exists (select 1 from features f join repos r on r.id = f.repo_id
                 where f.id = links.feature_id and (r.is_public or r.owner_user = auth.uid())));

-- Owner-only tables (session data and the audit log are never public)
create policy sessions_read on sessions for select
  using (exists (select 1 from repos r where r.id = sessions.repo_id and r.owner_user = auth.uid()));

create policy hook_decisions_read on hook_decisions for select
  using (exists (select 1 from repos r where r.id = hook_decisions.repo_id and r.owner_user = auth.uid()));

create policy observations_read on observations for select
  using (exists (select 1 from repos r where r.id = observations.repo_id and r.owner_user = auth.uid()));

-- Signal resolution by the repo owner (the only client write allowed)
create policy signals_resolve on signals for update
  using (exists (select 1 from repos r where r.id = signals.repo_id and r.owner_user = auth.uid()));

-- replace_repo_state: one refresh, one transaction (S1b) ------------------------
-- Called by api/ only (service role) through PostgREST: POST /rest/v1/rpc/replace_repo_state.
-- p is the derived model for one repository, built by lib/sync.js from reconcile() output:
--   { capabilities: [{slug, statement, owner, target, path}],
--     features:     [{slug, capability, lifecycle, health, health_reason}],
--     artifacts:    [{feature, type, state, path, pr_number}],
--     pull_requests:[{number, title, url, state, kind, role, feature, capability, plan_complete,
--                     light_reason, draft, head_sha, merged_at, last_activity_at,
--                     changes_requested, checks_state, divergences, changed_files, changed_lines}],
--     review_findings: [{pr_number, pass, severity, excerpt, url}],
--     signals:      [{kind, severity, rule, message, feature, pr_number,
--                     evidence_type, evidence_ref, evidence_at, evidence_url}] }
-- Capabilities and features are upserted by slug (keeps their ids stable); everything else
-- for the repository is replaced.
create or replace function replace_repo_state(p_repo uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into capabilities (repo_id, slug, statement, owner, target, source_path)
    select p_repo, c->>'slug', coalesce(c->>'statement', ''), c->>'owner', c->>'target', c->>'path'
    from jsonb_array_elements(coalesce(p->'capabilities', '[]')) c
  on conflict (repo_id, slug) do update
    set statement = excluded.statement, owner = excluded.owner,
        target = excluded.target, source_path = excluded.source_path;
  delete from capabilities
    where repo_id = p_repo
      and slug not in (select x->>'slug' from jsonb_array_elements(coalesce(p->'capabilities', '[]')) x);

  insert into features (repo_id, slug, capability_id, lifecycle, health, health_reason)
    select p_repo, f->>'slug',
           (select id from capabilities where repo_id = p_repo and slug = f->>'capability'),
           f->>'lifecycle', f->>'health', f->>'health_reason'
    from jsonb_array_elements(coalesce(p->'features', '[]')) f
  on conflict (repo_id, slug) do update
    set capability_id = excluded.capability_id, lifecycle = excluded.lifecycle,
        health = excluded.health, health_reason = excluded.health_reason;
  delete from features
    where repo_id = p_repo
      and slug not in (select x->>'slug' from jsonb_array_elements(coalesce(p->'features', '[]')) x);

  delete from artifacts where feature_id in (select id from features where repo_id = p_repo);
  insert into artifacts (feature_id, type, state, path, pr_number)
    select fe.id, a->>'type', a->>'state', a->>'path', (a->>'pr_number')::int
    from jsonb_array_elements(coalesce(p->'artifacts', '[]')) a
    join features fe on fe.repo_id = p_repo and fe.slug = a->>'feature';

  delete from signals where repo_id = p_repo;
  delete from pull_requests where repo_id = p_repo;   -- review_findings cascade
  insert into pull_requests (repo_id, number, title, url, state, kind, role, feature_id, capability_id,
                             plan_complete, light_reason, draft, head_sha, merged_at, last_activity_at,
                             changes_requested, checks_state, divergences, changed_files, changed_lines)
    select p_repo, (r->>'number')::int, r->>'title', r->>'url', r->>'state', r->>'kind', r->>'role',
           (select id from features where repo_id = p_repo and slug = r->>'feature'),
           (select id from capabilities where repo_id = p_repo and slug = r->>'capability'),
           coalesce((r->>'plan_complete')::boolean, false), r->>'light_reason',
           coalesce((r->>'draft')::boolean, false), r->>'head_sha',
           (r->>'merged_at')::timestamptz, (r->>'last_activity_at')::timestamptz,
           coalesce((r->>'changes_requested')::boolean, false), r->>'checks_state', r->>'divergences',
           (r->>'changed_files')::int, (r->>'changed_lines')::int
    from jsonb_array_elements(coalesce(p->'pull_requests', '[]')) r;

  insert into review_findings (pr_id, pass, severity, excerpt, url)
    select pr.id, x->>'pass', x->>'severity', left(x->>'excerpt', 200), x->>'url'
    from jsonb_array_elements(coalesce(p->'review_findings', '[]')) x
    join pull_requests pr on pr.repo_id = p_repo and pr.number = (x->>'pr_number')::int;

  insert into signals (repo_id, feature_id, pr_id, kind, severity, rule, message,
                       evidence_type, evidence_ref, evidence_at, evidence_url, detected_at)
    select p_repo,
           (select id from features where repo_id = p_repo and slug = g->>'feature'),
           (select id from pull_requests where repo_id = p_repo and number = (g->>'pr_number')::int),
           g->>'kind', g->>'severity', g->>'rule', g->>'message',
           g->>'evidence_type', g->>'evidence_ref', (g->>'evidence_at')::timestamptz, g->>'evidence_url',
           coalesce((g->>'evidence_at')::timestamptz, now())
    from jsonb_array_elements(coalesce(p->'signals', '[]')) g;

  update repos set refreshed_at = now() where id = p_repo;
end;
$$;

revoke all on function replace_repo_state(uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_repo_state(uuid, jsonb) to service_role;
