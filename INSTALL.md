# Installation

## Requirements

* Docker Engine with the Compose plugin (`docker compose version` should work). Docker Desktop on macOS/Windows already includes this.
* About 200 MB free disk space (app image including the device database).
* Network access from the machine running SmartGuide to your Home Assistant instance.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

This downloads the repository to `~/smartguide`, builds the app, and starts it in a single container. The device knowledge base (4,372 devices) is built into the image — no manual import step.

When it finishes, open **http://localhost:8095**.

### Custom install directory or port

```bash
SMARTGUIDE_INSTALL_DIR=/opt/smartguide SMARTGUIDE_PORT=9000 \
  curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

## Manual Install

If you'd rather not pipe a script into `bash`, do it step by step:

```bash
git clone https://github.com/jenswedem-a11y/home-assistant-integration-assistant.git smartguide
cd smartguide
docker compose up -d --build
```

Open **http://localhost:8095** once the containers report as running (`docker compose ps`).

## First-Time Setup

SmartGuide starts up without any Home Assistant connection configured — this is expected, not an error. Open the web UI, go to the connection setup, and enter:

* Your Home Assistant URL, e.g. `http://homeassistant.local:8123` or `http://192.168.x.x:8123`
* A long-lived access token, created in Home Assistant under **Profile → Security → Long-lived access tokens**

SmartGuide tests the connection before saving it and stores it in `data/ha_config.json` on the host (not in the repository), so it survives container restarts and rebuilds.

## Language

The interface is available in English and German. SmartGuide follows your browser language (English for anything other than German); use the EN/DE switch in the top right to change it.

## Configuration Reference

All optional — SmartGuide runs with sensible defaults if you set none of these. Create a `.env` file next to `docker-compose.yml` to override:

| Variable | Default | Purpose |
|---|---|---|
| `SMARTGUIDE_PORT` | `8095` | Host port the web UI is served on |
| `HOME_ASSISTANT_URL` / `HOME_ASSISTANT_TOKEN` | *(unset)* | Pre-configure the Home Assistant connection instead of using the setup form |

## Updating

```bash
curl -fsSL https://raw.githubusercontent.com/jenswedem-a11y/home-assistant-integration-assistant/main/install.sh | bash
```

Re-running the install script pulls the latest code and rebuilds. Your saved Home Assistant connection is not affected — it lives in the `data/` directory, which the script never touches. The device database ships with the image, so updates bring new devices automatically. Upgrading from a version with a separate Postgres container removes that container; its old data in `data/postgres` is no longer used and can be deleted.

## Uninstalling

```bash
cd ~/smartguide   # or your custom SMARTGUIDE_INSTALL_DIR
docker compose down -v
cd ..
rm -rf smartguide
```

Removing the directory also deletes your saved Home Assistant connection (`data/ha_config.json`).

## Troubleshooting

**"address already in use" on port 8095**
Something else on your machine is already using that port. Install with a different port: `SMARTGUIDE_PORT=8199 curl ... | bash`.

**Docker or the Compose plugin isn't found**
Install Docker from [docs.docker.com/get-docker](https://docs.docker.com/get-docker/). The Compose plugin ships with current Docker versions; on older installs you may need `apt install docker-compose-plugin` (or equivalent) separately.

**Connection test to Home Assistant fails**
* Make sure the URL is reachable *from the machine running SmartGuide*, not just from your browser — `curl` the URL from that machine if in doubt.
* Long-lived access tokens are shown only once at creation time in Home Assistant. If you've lost it, create a new one.
* If Home Assistant and SmartGuide run in Docker on the same host but in different Compose projects, `localhost`/`127.0.0.1` inside the SmartGuide container won't reach Home Assistant — use the host's LAN IP or a Docker network alias instead.
