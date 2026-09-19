# GitHub build and Portainer deployment

The deployment path is:

```text
Changes pushed to migration-to-new-site
  -> GitHub Actions tests and builds the image
  -> GitHub Container Registry stores the image
  -> You deploy/update the stack in Portainer
```

The local preparation itself did not run GitHub Actions or publish an image.
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
syntax checks, validates both Compose files, and builds a Linux AMD64 test image.
It checks page/API responses, the non-root user, response-volume writes and
persistence after container replacement, and the Docker health check. Only after
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
2. Choose **Stacks -> Add stack** and name it `genaisis-activities`.
3. Paste [portainer-stack.yaml](../portainer-stack.yaml) into the web editor.
4. Select the GHCR registry if Portainer requests a registry selection.
5. Set stack environment variables as needed, then deploy the stack.

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE_TAG` | `migration-to-new-site` | Set `sha-<full commit hash>` to choose a reviewed build. Use `latest` only after the later merge to `main`. |
| `APP_PORT` | `8080` | Use a free host port. |
| `BIND_ADDRESS` | `127.0.0.1` | Bind to the host loopback interface by default. |

The default is suitable for a reverse proxy running on the same Linux host. That
proxy forwards the website hostname to `http://127.0.0.1:8080` and terminates HTTPS.
For LAN-only review without a host proxy, set `BIND_ADDRESS` to the server's LAN
IP and visit that IP/port from your computer. With the default loopback bind,
the service cannot be reached directly using the server's LAN/public IP.

If the reverse proxy runs in Docker, connect `web` to its existing proxy network
and use a unique service network alias as the upstream on port 8000. In that
arrangement the published host port can be removed. The exact proxy/network
configuration depends on the server and is not assumed by the supplied stack.

There is no `build:` directive in this stack: Portainer downloads the image built
by GitHub. Do not paste `compose.yaml` instead; that file is for building from a
source checkout.

Source: [Portainer stack creation](https://docs.portainer.io/user/docker/stacks/add).

## 4. Verify, update, and roll back

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
