# GeNAISiS-Activities
Online activities part of 'Maddie is Online' Generative Artificial Intelligence Skills project

A Flask website with three activities: Bot or Not, Phrase Completion, and Image
Sequence. HTML templates live in `app/templates`, browser code in `app/static`,
and activity definitions in `data`. Responses are appended to JSONL files.

## Local review on Windows

Python 3.14 is used for the local review and the Linux container image.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:RESPONSES_DIR = Join-Path (Get-Location) '.local-data'
.\.venv\Scripts\python.exe -B -m flask --app run run --host 127.0.0.1 --port 5050 --no-reload
```

Open <http://127.0.0.1:5050>. Stop the server with Ctrl+C. Review submissions are
saved under `.local-data`, separately from the records already in `data`.
Without `RESPONSES_DIR`, the original `data/<activity>/responses.jsonl` paths
are used. Set this variable before starting the process.

Gunicorn is installed from the shared requirements for the Linux deployment;
it does not run natively on Windows. The Flask development server above is for
local review only. See the [Flask Gunicorn documentation](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/).

Run the smoke tests:

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m pip check
```

Tests use temporary response files and do not alter the existing records. They
cover page rendering, datasets, sessions, submissions, persistence between app
instances, and independent response/content paths. They do not establish browser
or production readiness; see [the review findings](docs/review.md).

Optional dependency audit tooling is installed separately from runtime dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install pip-audit
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --no-deps --disable-pip
```

## Linux Docker deployment

The intended deployment uses **GitHub Actions -> GitHub Container Registry ->
Portainer**. Follow [the Portainer deployment guide](docs/portainer.md) and use
`portainer-stack.yaml` in Portainer. The workflow publishes
`ghcr.io/tomaddieonline/genaisis-activities:migration-to-new-site` from the
`migration-to-new-site` branch after its checks pass. The stack defaults to this
migration tag. `main` is preserved for a later merge; once the workflow reaches
`main`, builds there publish `latest`. The commands below are an alternative for
building directly from a Linux source checkout.

The Docker and Compose files are prepared, but a Linux image build and container
test are still pending. Resolve the open findings in [docs/review.md](docs/review.md)
before public deployment. The target server needs Docker Engine and the Compose
plugin; Docker Desktop is not required on the Windows review machine.

From a copy of this repository on the Linux server:

```sh
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 web
curl --fail http://127.0.0.1:8080/
```

The service binds to the server's loopback interface on port 8080. Select an
unused port with `APP_PORT=8081 docker compose up -d`, or set `APP_PORT` in an
untracked `.env` file. An existing reverse proxy on the host should forward the
chosen website hostname to `http://127.0.0.1:8080` and provide HTTPS. A reverse
proxy running in another container needs a shared Docker network and upstream
`web:8000` instead; confirm the server's layout before changing its proxy.

For private review from your computer, open an SSH tunnel and then browse to
<http://127.0.0.1:8080> locally:

```sh
ssh -N -L 8080:127.0.0.1:8080 user@server
```

The image runs Gunicorn as UID/GID 10001 with one synchronous worker. This
serializes writes to the existing JSONL storage within that one container.
Do not increase workers, threads, or replicas until storage supports concurrent
writers. The read-only container filesystem has a writable `/tmp` and a named
volume at `/var/lib/genaisis`. The health check requests the homepage; it does
not verify every image or response-volume write, which must also be tested on
the target server.

The named `responses` volume persists submissions when the image is rebuilt or
the container is replaced. Activity JSON and images stay in the image so content
updates are included on rebuild. Existing response files, virtual environments,
secrets, and bytecode are excluded from the Docker build context. Deployment
starts with an empty response store; existing records are not automatically
imported. See [Docker volume documentation](https://docs.docker.com/engine/storage/volumes/).

GitHub Actions runs `scripts/check_container.py` against an isolated test image
and disposable volume before publishing. The script verifies non-root writes,
health, and response persistence after replacing the container. These checks
still need their first run on GitHub; Docker is unavailable on the local Windows
review machine.

### Updates and backups

For an update, copy the reviewed source changes and run `docker compose up -d
--build`. `docker compose down` stops/removes the container while keeping the
named volume. Do not use `docker compose down -v` when responses must be retained.

For a consistent backup, stop the service briefly and copy only the responses:

```sh
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose stop web
docker compose cp web:/var/lib/genaisis/. "$backup_dir/"
docker compose start web
```

Check the copy succeeded and retain backups outside the server as well. For a
restore or migration, stop the service, restore only the intended response files
to the volume, and ensure they are writable by UID/GID 10001 before restarting.

`.gitignore` prevents new generated files being added accidentally. Previously
tracked bytecode and response records remain tracked; their cleanup is separate
from deployment and has not been performed.
