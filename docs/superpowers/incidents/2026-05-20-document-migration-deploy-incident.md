# Incident Postmortem — Document Migration Deploy (2026-05-20)

## Summary

The deploy of the Document migration (`c5e0582 Fix media + dashboard redirects after Document migration`) on 2026-05-19 ~20:23 UTC went green in CI but crash-looped in production. The site was visibly broken for users (HTTP 502) from ~20:23 UTC until ~07:14 UTC on 2026-05-20 — roughly **11 hours** — and then continued to silently serve a six-week-old legacy frontend until ~07:55 UTC, another **41 minutes** of degraded service, before final recovery.

Recovery required two separate fixes layered on top of each other: a forward-only Flyway hotfix (collation), and a manual re-direction of the running container onto the correct image.

## Impact

| Window | State |
|---|---|
| 2026-05-19 20:23 UTC → 2026-05-20 07:14 UTC | Site returns HTTP 502 (Spring Boot in crash-loop, no upstream for nginx). |
| 2026-05-20 07:14 UTC → 07:55 UTC | Site returns HTTP 200 but serves a 6-week-old vanilla-JS frontend; no React app, no recent features visible. |
| 2026-05-20 07:55 UTC onwards | Restored — React build served from latest CI image, Flyway up-to-date. |

No data loss. No security exposure. The only data backfill in flight (V6 `media_backfill_to_document` for 22 rows) was inside a transaction and rolled back cleanly when it errored; the eventual fixed V6 applied it in 36 ms.

## Timeline (UTC)

- **2026-05-19 20:23** — `c5e0582` pushed to `main`. CI build + image push + SSH deploy completes "successfully" in 1m52s.
- **2026-05-19 20:24** — New container starts. Flyway runs: V1 baselined (skipped), V2–V5 apply cleanly, **V6 fails** with MySQL error 1267 "Illegal mix of collations". Transaction rolls back. Spring Boot exits.
- **2026-05-19 20:24 onward** — Container restart-loops. Flyway's `validate` step now refuses to run because `flyway_schema_history` has a row for V6 with `success=0`. Site is 502.
- **2026-05-20 06:34** — Spring0210 reports broken site.
- **2026-05-20 06:40 – 06:50** — Diagnostics: identified Flyway as the failure point, isolated V6 as the failing migration, identified the collation mismatch as the root cause (`media.url` is `utf8mb4_0900_ai_ci`, `document_attachment.file_url` is `utf8mb4_unicode_ci`).
- **2026-05-20 07:04** — Hotfix committed on `dev` (`28acf6a`), cherry-picked to `main` (`de1b4c2`) — adds `COLLATE utf8mb4_unicode_ci` to the JOIN in V6.
- **2026-05-20 07:08** — CI builds the fix; new image pushed to GHCR.
- **2026-05-20 07:13** — Failed V6 row deleted from `flyway_schema_history`; container force-recreated. **But the `--force-recreate` was run from `~/My-Journey/` rather than `/opt/my-journey/`.** The wrong compose file took effect and the container was re-launched on a 6-week-old locally-built image `my-journey-app:latest`, not the CI image.
- **2026-05-20 07:14** — Site returns HTTP 200. Verification queries against the database showed all six Flyway migrations succeeded — but those had been applied during the brief window the new image ran between 07:09 and 07:13, before the misdirected recreate.
- **2026-05-20 07:23** — User reports the site is up but "looks like a very old version". Investigation reveals the running container is on the old image.
- **2026-05-20 07:55** — Container force-recreated from `/opt/my-journey/`. Now running `ghcr.io/spring0210/my-journey:latest`. React frontend restored.

## Root causes

There were **two** distinct root causes that combined into one long incident.

### Cause 1 — Schema-collation mismatch silently waited months to detonate

The `media` table was originally created at runtime by Hibernate's `ddl-auto`. On MySQL 8 the default character collation is `utf8mb4_0900_ai_ci`. When the team-KB pivot introduced new tables via Flyway V2, those CREATE TABLE statements explicitly used `utf8mb4_unicode_ci` (the project's stated convention).

For months this divergence was invisible: no query ever compared a column from a `ddl-auto`-created table with a column from a Flyway-created table. V6 (`media backfill to document`) was the first such query — a `JOIN document_attachment da ON da.file_url = m.url`. MySQL error 1267 fired immediately and the migration rolled back.

Because the project switched from `ddl-auto=update` to `ddl-auto=validate` in the same release, the application could no longer self-heal at startup; a single failing migration was enough to take the whole app offline.

The collation drift is the single most dangerous piece of latent state in the database. Any future JOIN between a pre-Flyway and post-Flyway table is a landmine of the same shape.

### Cause 2 — A second source of truth for `docker-compose.yml` on the production VPS

CI deploys to `/opt/my-journey/` and overwrites that directory's `docker-compose.yml` from `main` on every run. That compose file pins `image: ghcr.io/spring0210/my-journey:latest`.

A second copy of the same repository, plus a stale `docker-compose.yml`, also lives at `~/My-Journey/` on the VPS. That copy's `app` service has only `build: .` — no `image:` field — so `docker compose up` from that directory builds locally and tags the result `my-journey-app:latest`. The locally-built tag from a development session six weeks earlier was still on disk.

Because both files use the same `container_name: my-journey-app` and the same compose project name (`my-journey`, after Compose's name normalization), they share the singleton container and the singleton `my-journey_mysql_data` volume. Whichever compose file ran most recently wins.

When the recovery `--force-recreate` was run from `~/My-Journey/` instead of `/opt/my-journey/`, Docker silently rolled the production container back to the six-week-old local-build image. The site came up but with the old vanilla-JS frontend and no Flyway configuration — and no log line anywhere said "you just deployed the wrong image", because from Docker's perspective nothing was wrong.

## Contributing factors

These didn't *cause* the incident but materially shaped how long it took to detect and resolve.

- **The CI workflow has no post-deploy health check.** The deploy step is `docker compose pull && docker compose up -d`. Both return success the moment Docker creates the container; neither cares whether the application inside actually starts. A Spring Boot app that crashes 30 seconds after `up -d` produces an entirely green CI run.
- **`ddl-auto: update` → `ddl-auto: validate` was bundled into the same release as the first Flyway migrations.** This is the right long-term direction, but doing it in the same change as a major data migration meant any Flyway problem failed-closed instead of degrading gracefully.
- **V1 (`baseline.sql`) was authored from a Hibernate-generated schema dump that did not record collations.** This is why nobody noticed the collation drift when writing V1.
- **No one realised `~/My-Journey/` had a divergent compose file until it had already silently swapped the running image.** This is a footgun that will keep being one until it's removed.

## What went well

- **The collation failure was atomic.** V6's `UPDATE … JOIN` ran inside a transaction; the error rolled the data back cleanly. No partial state to repair. The 22 affected `media` rows were untouched and the eventual fixed V6 ran in 36 ms.
- **Flyway's `validate` step refused to make things worse.** Once V6 was recorded as failed, the app crash-looped instead of trying to repeat the migration in a different state. That preserved a clean recovery path.
- **The hotfix was small, targeted, and forward-only.** A four-character SQL change (`COLLATE utf8mb4_unicode_ci`), no edits to V1-V5, no destructive history rewrites. Database state was repaired with a single `DELETE FROM flyway_schema_history WHERE version='6' AND success=0;`.
- **No data loss, no corruption, no rollbacks of user state.**

## What went badly

- **The first "successful" recovery was actually a regression.** We declared the site fixed at 07:14, but the running app was a six-week-old image with the wrong frontend. The user, not internal monitoring, caught it.
- **The CI green check meant nothing.** Both the breaking deploy (V6 collation) and the silent regression (stale image still running) coexisted with green CI runs.
- **Diagnosis took ~30 minutes** because the dual-compose-file situation wasn't visible from the application or the workflow — it required listing `/opt/` and `~/` on the server.

## Action items

These are listed in priority order. None require a hot deploy; all can ship as separate, reviewable changes from `dev`.

### 1. (Highest priority) Add a post-deploy health check to the workflow

`.github/workflows/build-and-deploy.yml`'s SSH step currently ends after `docker compose up -d`. Append a health gate:

```yaml
script: |
  cd /opt/my-journey
  curl -fsSL ...
  docker compose pull
  docker compose up -d --remove-orphans
  # Wait up to ~60s for the app to actually answer on its health endpoint.
  for i in {1..30}; do
    if curl -fsS http://localhost:8080/actuator/health > /dev/null; then
      echo "App healthy after ${i} attempt(s)"
      exit 0
    fi
    sleep 2
  done
  echo "App failed to become healthy after deploy"
  docker compose logs --tail=200 app
  exit 1
```

This requires `spring-boot-starter-actuator` to be on the classpath (it isn't yet) and `/actuator/health` permitted in `SecurityConfig`. A workflow check that fails-closed turns "container started" into "container is actually serving" and would have caught both halves of this incident immediately.

### 2. Normalize collations across the legacy `ddl-auto`-created tables

Author a `V7__normalize_collations.sql` that walks the pre-Flyway tables and converts them to the project standard. Candidates (verify against `information_schema.tables` before writing the migration):

- `user`, `journal_entry`, `space`, `space_member`, `space_post`, `space_post_comment`, `media`, `notification`, `refresh_token`, anything else from the pre-Flyway era.

Migration sketch:

```sql
ALTER TABLE `user`         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE journal_entry  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- … one line per legacy table
```

`CONVERT TO CHARACTER SET` is heavy on large tables (rewrites every row) but the production dataset is tiny — this is the right time to do it. Verify on a copy of the prod DB first.

This closes the entire class of "future cross-table JOIN trips error 1267" bugs.

### 3. Remove the second compose stack on the VPS

Either delete `~/My-Journey/docker-compose.yml` outright, or align it so the `app` service uses `image: ghcr.io/spring0210/my-journey:latest` like the production copy. The source-code clone should never be capable of replacing the running container with a locally-built image.

A complementary safeguard: set `COMPOSE_PROJECT_NAME` explicitly in `/opt/my-journey/.env` and/or change `~/My-Journey/`'s project name so the two stacks no longer share containers and volumes. That way a misdirected `compose up` would fail loudly (port conflict, container name clash) instead of silently swapping the image.

### 4. (Lower priority, design-level) Split risky concerns across releases

The team-KB pivot bundled four high-risk changes into one deploy: (a) introducing Flyway, (b) flipping to `ddl-auto=validate`, (c) a major data backfill (V4), (d) frontend rewrite. Each one is independently safe; together they form a deploy where any one component's failure takes the entire app down with no degradation path.

Future deploys involving migrations should ship Flyway adoption and `ddl-auto=validate` separately from data backfills, and ideally separately from frontend changes, so a problem on one axis doesn't necessarily mean an outage.

## Appendix — exact technical details

### The collation error

```
SQL State  : HY000
Error Code : 1267
Message    : Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT) and
             (utf8mb4_0900_ai_ci,IMPLICIT) for operation '='
Location   : db/migration/V6__media_backfill_to_document.sql
Line       : 18
```

### The four-character V6 hotfix

```diff
-JOIN document_attachment da ON da.file_url = m.url
+JOIN document_attachment da ON da.file_url = m.url COLLATE utf8mb4_unicode_ci
```

### The recovery sequence that actually worked

```bash
# 1. Wipe the failed migration row.
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" my_journey -e \
  "DELETE FROM flyway_schema_history WHERE version='6' AND success=0;"

# 2. From /opt/my-journey/ (NOT ~/My-Journey/), bring the container onto the
#    CI image.
cd /opt/my-journey
docker compose up -d --force-recreate app
docker compose logs -f --tail=80 app
```

### Verification queries used to confirm recovery

```sql
SELECT version, description, success, execution_time
FROM flyway_schema_history ORDER BY installed_rank;
-- All six rows should show success=1.

SELECT source_type, COUNT(*) FROM media GROUP BY source_type;
-- Expected: 22 rows of DOCUMENT, zero JOURNAL / SPACE_POST.
```

```bash
# Confirm the container is on the CI-built image, not the local build.
docker inspect my-journey-app --format '{{.Config.Image}} {{.Image}}'
# Expect: ghcr.io/spring0210/my-journey:latest sha256:<today's manifest>
```
