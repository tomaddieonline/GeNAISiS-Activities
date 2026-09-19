# GitHub build and Portainer deployment

The deployment path is:

```text
Changes pushed to migration-to-new-site
  -> GitHub Actions tests and builds the image
  -> GitHub Container Registry stores the image
  -> You deploy/update the stack in Portainer
```

The GitHub workflow publishes the image; Portainer deployment remains manual.
Review the open findings in [review.md](review.md) before launching publicly.

## 1. Publish the first image

Work is isolated on `migration-to-new-site` in
`tomaddieonline/GeNAISiS-Activities`. Pushing to that branch starts the **Test and
publish container** workflow and updates only its migration image tag and the
commit tag. Continue changes and trial deployments there, then merge to `main`
at a later date after validation. Publishing an image does not deploy it to
Portainer or alter the existing website.

Once the workflow is merged to `main`, pushes there publish `latest` instead.
Migration builds never overwrite `latest`. **Actions -> Test and publish
container -> Run workflow** can rebuild either supported branch when GitHub
offers the manual-dispatch UI (the workflow must exist on the default branch
for that UI to appear). Until then, pushes to the migration branch trigger its
builds automatically. Pull requests run verification without publishing.

The workflow installs the pinned dependencies, runs smoke tests and JavaScript
syntax/URL tests, validates both Compose files, and builds a Linux AMD64 test image.
It checks page/API responses, the non-root user, response-volume writes and
persistence after container replacement, and the Docker health check at both
the root and `/genaisis`. Only after
these pass does it build/publish the AMD64 and ARM64 image variants. ARM64 is
built through QEMU; its application runtime is not separately smoke-tested.

The image reference is:

```text
ghcr.io/tomaddieonline/genaisis-activities:migration-to-new-site
```

Each successful build also publishes `sha-<full Git commit hash>`. Use that tag
to select a reviewed source revision. For an exact immutable image, use the
`ghcr.io/...@sha256:...` digest shown in the workflow summary. Rebuilding the same
commit may update the base image, so a commit tag is not an immutable digest.

GitHub Actions authenticates with its automatic `GITHUB_TOKEN`; the workflow
requests `packages: write`. No registry password needs to be committed or added
as a separate repository secret. Organization policy must permit Actions and
package publishing. If a package with this name already exists, grant this
repository Actions access in the package settings.

Source: [GitHub container publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## 2. Let Portainer pull the image

GitHub creates new packages as private by default. Either keep the image private
and configure registry authentication, or deliberately make the package public
if anonymous pulling is intended. Repository and package visibility are separate
settings; this workflow does not change either.

For a private image, use **Registries -> Add registry -> Custom registry**:

| Setting | Value |
| --- | --- |
| Name | GitHub Container Registry |
| Registry URL | `ghcr.io` |
| Authentication | Enabled |
| Username | Your GitHub username with package read access |
| Password | A GitHub personal access token (classic) with `read:packages` |

Enter the token directly into Portainer. A pull-only registry credential does
not need package write/delete scopes. If the organization requires SSO, authorize
the token for that organization. Enable access to this registry for the intended
Portainer environment/users as appropriate.

The dedicated **GitHub** registry provider is a Portainer Business Edition
feature; the generic custom registry avoids depending on it for image pulls.

Sources: [GitHub registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry),
[Portainer custom registry](https://docs.portainer.io/admin/registries/add/custom),
[Portainer GitHub provider](https://docs.portainer.io/admin/registries/add/ghcr).

## 3. Create the stack

This stack targets **Docker Standalone**. A Swarm deployment requires a separate
review of networking, scheduling, and storage.

1. Select the Linux Docker environment in Portainer.
2. Choose **Stacks -> Add stack** and name it `genaisis-activities-migration`.
3. Paste [portainer-stack.yaml](../portainer-stack.yaml) into the web editor.
4. Select the GHCR registry if Portainer requests a registry selection.
5. Set stack environment variables as needed, then deploy the stack.

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE_TAG` | `migration-to-new-site` | Set `sha-<full commit hash>` to choose a reviewed build. Use `latest` only after the later merge to `main`. |
| `APP_PORT` | `8083` | The host port selected for this deployment. |
| `BIND_ADDRESS` | `127.0.0.1` | Bind to the host loopback interface by default. |
| `URL_PREFIX` | `/genaisis` | Mount all pages, assets and APIs under this path. Set `/` for a root deployment. |
| `PUBLIC_ORIGIN` | `https://pantheon.greek-geek.info` | Public scheme and hostname for canonical URLs and the sitemap; no path. |
| `GOOGLE_SITE_VERIFICATION` | Empty | Optional content value of Google's HTML verification tag. |

For this deployment, nginx runs on `192.168.1.22` and its upstream is
`http://127.0.0.1:8083`. The public site will be
`https://pantheon.greek-geek.info/genaisis/`. The loopback binding makes the
container reachable by nginx on that host; it is not a direct LAN listening port.

When ready to configure nginx, add the locations in
[nginx-genaisis.conf](nginx-genaisis.conf) to the existing HTTPS server block for
`pantheon.greek-geek.info`. The `proxy_pass http://127.0.0.1:8083;` directive has
no trailing slash: nginx must preserve `/genaisis` because the application is
mounted there. The exact `/genaisis` URL redirects to `/genaisis/`. A prefix
header or response-body rewriting is not needed.

Test the nginx configuration with `sudo nginx -t` before reloading it. The
snippet is prepared in the repository; the server's nginx configuration has
not been changed. The Docker health check works before nginx is configured.

Sources: [nginx proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass),
[Werkzeug application mounting](https://werkzeug.palletsprojects.com/en/stable/middleware/dispatcher/).

There is no `build:` directive in this stack: Portainer downloads the image built
by GitHub. Do not paste `compose.yaml` instead; that file is for building from a
source checkout.

Source: [Portainer stack creation](https://docs.portainer.io/user/docker/stacks/add).

## 4. Verify, update, and roll back

For Google ownership verification, sitemap submission and the shared host's
robots.txt, follow [the Search Console guide](search-console.md).

After deployment, confirm the container becomes **healthy**, inspect its logs,
and walk through all three activities. In the container console, response files
are under `/var/lib/genaisis/<activity>/responses.jsonl`. Submit a test answer,
restart/recreate the container, and confirm that record remains.

After a new GitHub build succeeds, edit/update the stack in Portainer, choose the
desired `IMAGE_TAG`, enable its option to re-pull images, and update/redeploy.
GitHub publishing alone does not update the running container. No webhook or
automatic production updater is configured.

Keep the stack name and its `responses` volume. Recreating the container retains
responses; deleting the volume loses them. The image contains the activity JSON
and images but excludes the existing response files committed to the repository.
Use the backup guidance in [the README](../README.md#updates-and-backups), or your
existing volume backup process, before updates. Response migration is a separate
step if the old records need to become production data.

To roll back code, set the previous successful commit tag (or replace the image
reference with its recorded digest) and update the stack, keeping the same data
volume. Confirm response-format compatibility before rolling back across future
storage changes.
