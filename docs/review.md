# Application and deployment review

Reviewed on 2026-09-19 against baseline commit `8b0da24` plus the local deployment
preparation changes. This is a source, dependency, HTTP, and API review. Browser
automation was unavailable, and Docker is not installed on the Windows review
machine. A visual walkthrough and Linux container verification remain pending.

## Open findings

### 1. Submission validation permits invalid records and server errors

Affected code:

- `app/blueprints/bot_or_not/api.py:25-31`
- `app/blueprints/phrase_completion/api.py:18-20`
- `app/blueprints/image_sequence/api.py:18-20`

All three endpoints only test whether required keys are present. Sending the
JSON number `123` produces HTTP 500 because the membership test expects a
container. Sending all required keys with list values produces HTTP 200 and
appends an invalid record. These behaviours were reproduced with a Flask test
client using temporary response files.

Before public deployment, require a JSON object; validate IDs against the
activity dataset, choices/actions against allowed values, and timestamps/indexes
against expected types and ranges. Bound request size and string lengths. The
app currently has no explicit request-body limit or rate limiting, and the
public submit routes append client-provided data directly to disk. Set appropriate
limits at the application/proxy boundary for the expected usage. Session IDs
are generated UUIDs, not authentication or evidence of a trustworthy submission.

### 2. Image Sequence references a missing image

`data/image_sequence/items.json:48` references `s65.png`; the file does not exist
under `app/static/images/image_sequence`. Its URL returns HTTP 404 and the viewer
reports an image-load error. All other dataset image references were found.

Restore the intended asset or deliberately remove the entry after a content
decision. No replacement image was fabricated and no activity was removed.

### 3. Phrase Completion double-counts an answer after a failed save

In `app/static/js/phrase_completion.js:324-328`, score and answered count are
incremented before the POST completes. On failure, the catch block at line 355
re-enables answer buttons without reverting those increments. Retrying the same
question increments them again.

A Node VM test of the actual `revealAndSave` function, with minimal DOM stubs and
a failed response followed by a successful response, produced:

```text
After failed save: score=1, scoredCount=1, canAnswer=true
After successful retry of the same answer: score=2, scoredCount=2, canAnswer=false
```

Move scoring after successful persistence, matching Bot or Not's existing
approach. This reproduction is a JavaScript function test, not a browser test.

### 4. Image Sequence does not report failed recording

`app/static/js/image_sequence.js:76-96` awaits `fetch` but does not check the HTTP
response status and suppresses network exceptions. HTTP 400/500 responses are
therefore treated as though recording worked, while the viewer continues. If
these records are required, provide an explicit save status/retry policy.

### 5. Response logging and repository hygiene

`app/blueprints/bot_or_not/api.py:27` prints every submitted payload to stdout,
duplicating response contents in server logs. Remove this debug print or replace
it with a minimal operational event before deployment.

Sixteen Python bytecode files and three response JSONL files were already
tracked in Git. The recorded files contain 48 Bot or Not rows, three Image
Sequence rows, and no Phrase Completion rows. They were left unchanged. New
ignore rules prevent adding more generated data, but do not untrack existing
files. Docker excludes these records and bytecode from its build context.

## Completed preparation

- Installed the runtime requirements in the repository-local `.venv`.
- Installed `pip-audit` as local review tooling, outside runtime requirements.
- Updated Click 8.3.1 to 8.3.3, Flask 3.1.2 to 3.1.3, and Werkzeug 3.1.5 to 3.1.6
  after the audit flagged known advisories. The original audit contained five
  entries but only three distinct advisory IDs, due to duplicate Flask/Werkzeug
  records. A repeat audit of the complete pinned runtime requirements reported
  no known vulnerabilities. This is an advisory-database result, not a guarantee
  that the application has no vulnerabilities.
- Added `RESPONSES_DIR` configuration to separate immutable activity content
  from writable response data while preserving the original default paths.
- Added Docker/Compose configuration with Gunicorn, a non-root account, one
  synchronous worker, a persistent response volume, a health check, bounded
  Docker logs, and loopback-only host port publishing.
- Added `.gitignore` and `.dockerignore`; no records were removed or migrated.
- Documented local startup, Linux deployment, updates, and backups in the README.
- Added a GitHub Actions workflow to test/build/publish AMD64 and ARM64 images to
  GHCR, plus a separate image-only Portainer stack and deployment guide. The
  workflow checks a disposable AMD64 container and its named-volume persistence
  before publishing. These checks were pending at the time of the local review.
  Work is isolated on `migration-to-new-site`, whose builds publish a separate
  migration image tag. Only builds from `main` publish `latest`; the existing
  `main` branch remains the baseline until a later merge.

The package advisories are conditional: the Click report concerns `click.edit`,
the Flask issue concerns session/cache handling, and the Werkzeug issue concerns
Windows device filenames. The first two affected code paths were not found in
this application. The patches were applied to remove the vulnerable versions
before deployment; this review does not claim all three were exploitable here.

Primary references:

- [Flask session/cache advisory](https://github.com/pallets/flask/security/advisories/GHSA-68rp-wp8r-4726)
- [Werkzeug Windows filename advisory](https://github.com/pallets/werkzeug/security/advisories/GHSA-29vq-49wr-vm6x)
- Click advisory returned by the package audit: `PYSEC-2026-2132`, alias
  `CVE-2026-7246` / `GHSA-47fr-3ffg-hgmw`, fixed version 8.3.3. The maintainer
  advisory URL returned 404 during this review, so its details were not
  independently verified there.
- [Flask deployment with Gunicorn](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/)
- [Docker persistent volumes](https://docs.docker.com/engine/storage/volumes/)

## Verification

- All six page routes and six read-only API routes returned HTTP 200.
- Twenty-five distinct local links/assets referenced by rendered HTML returned
  HTTP 200. Dataset assets were checked separately and identified only `s65.png`
  as missing.
- Existing dataset JSON and response JSONL parsed successfully.
- All Python source files parsed, and `node --check` passed for all four browser
  JavaScript files.
- Four smoke tests passed with patched dependencies: pages, datasets/sessions,
  response persistence across app instances, and the response-directory override.
- `pip check` reported no broken requirements; the runtime dependency audit
  reported no known vulnerabilities after the patches.
- Both Compose files and the GitHub workflow parsed as YAML; all workflow shell
  steps passed `bash -n`. The action references were pinned to release commit
  hashes resolved from their upstream Git repositories. Full Docker/Actions
  execution remains pending the first GitHub run.

The four smoke tests cover successful flows and the deployment path change;
they do not resolve or negate the open findings above. Initial test execution
hit Windows sandbox temporary-directory permissions; the same suite passed with
temporary-file access. Test responses were isolated from the existing records.

## Before deployment

Continue reviewing and resolving the open application findings on
`migration-to-new-site`, and confirm its Actions build succeeds before trial
deployment. Merge to `main` only after the migration is validated. The chosen deployment
path is GitHub Container Registry to Portainer, operated by the repository owner;
SSH deployment is not needed. Follow [portainer.md](portainer.md), choose the
website hostname, available host port, and reverse proxy arrangement, and verify
the deployed container's writes, persistence, health, and three activity flows.
Complete the browser walkthrough before enabling the public hostname. No remote
server was contacted and no public deployment was performed during this review.
