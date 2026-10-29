-- 002: replace_repo_state() made safe for overlapping refreshes (S1b live run, 2026-10-29).
-- Several webhooks arrive together for one merge; their refreshes overlapped, collided on
-- unique (repo_id, number) (409) and an older read could overwrite a newer one.
-- Now: an advisory lock per repository, and a refresh whose read started before the stored
-- state's is skipped (returns false). refreshed_at = when the stored read started.
-- Also: set_updated_at() gets a fixed search_path (Supabase security advisor, WARN).
-- Applied by a person (or with the owner's explicit approval), never silently.

drop function if exists replace_repo_state(uuid, jsonb);

create function replace_repo_state(p_repo uuid, p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  observed timestamptz := coalesce((p->>'observed_at')::timestamptz, now());
begin
  -- One refresh at a time per repository: overlapping webhooks for one merge used to
  -- collide on unique (repo_id, number) and fail with 409.
  perform pg_advisory_xact_lock(hashtext(p_repo::text));
  -- Never replace newer state with older: a refresh that started earlier but finished later
  -- is skipped.
  if exists (select 1 from repos where id = p_repo and refreshed_at > observed) then
    return false;
  end if;

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

  update repos set refreshed_at = observed where id = p_repo;
  return true;
end;
$$;

revoke all on function replace_repo_state(uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_repo_state(uuid, jsonb) to service_role;

alter function set_updated_at() set search_path = public;
