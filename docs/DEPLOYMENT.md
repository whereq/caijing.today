# caijing.today — Production Deployment

caijing.today deploys like the other whereq-family apps: the code lives on GitHub,
is checked out on the Raspberry Pi at `~/git/caijing.today`, runs as Docker
containers on the shared `whereq-network`, and is exposed publicly through the
existing `rp4-tunnel` Cloudflare Tunnel. **No inbound ports are opened.**

## Architecture

```
Browser ──HTTPS──▶ Cloudflare edge ──tunnel──▶ cloudflared (Pi)
                                                   │ HTTP
                                                   └─▶ localhost:8082 → caijing-frontend (nginx)
                                                                            │ /api/* proxied
                                                                            └─▶ caijing-api:8000 (FastAPI)
                                                                                   │ reads
                                                                                   └─▶ whereq-db (shared)
```

The frontend nginx proxies `/api/` to `caijing-api`, so **one public route is
enough** — no separate `api.caijing.today` hostname is required.

## Host ports (offset from other apps so they coexist on the Pi)

| Container | Container port | Host port |
|-----------|----------------|-----------|
| `caijing-frontend` (nginx) | 80 | **8082** |
| `caijing-api` (FastAPI) | 8000 | 8001 |

(flowdesk uses 8080 / 8000; these avoid the collision.)

## Cloudflare — Published Application Route

In **one.dash.cloudflare.com → Networks → Connectors → rp4-tunnel → Published
application routes**, add:

| Field | Value |
|-------|-------|
| Subdomain | *(leave empty)* |
| Domain | `caijing.today` |
| Path | *(leave empty)* |
| Service Type | `HTTP` |
| URL | `localhost:8082` |

Optionally repeat with Subdomain `www`. If Cloudflare reports *"An A/AAAA/CNAME
record already exists"*, delete the conflicting record under **dash.cloudflare.com
→ caijing.today → DNS → Records** first (keep any `*.cfargotunnel.com` CNAMEs).

No `api.caijing.today` route is needed (the frontend proxies `/api`).

## First-time deploy (on the Pi)

```bash
# 1. Clone (the shared db + whereq-network are already up from the data platform)
cd ~/git
git clone git@whereq.github.com:whereq/caijing.today.git
cd caijing.today

# 2. Prod env (real shared-db credentials)
cp docker/.env.example docker/.env && nano docker/.env

# 3. Build + start + health-check
bin/deploy.sh
```

`bin/deploy.sh` prints the tunnel target (`localhost:8082`) on success.

## Updating

```bash
cd ~/git/caijing.today
bin/deploy.sh              # full: pull main, rebuild api + frontend, health-check
bin/deploy.sh frontend     # frontend only (fastest, no API downtime)
bin/deploy.sh api          # api only, reload frontend nginx
bin/deploy.sh --dry-run    # preview
```

## Verify

```bash
# On the Pi
curl -I http://localhost:8082                 # frontend → 200
curl http://localhost:8001/api/v1/health      # api → {"status":"ok",...}
curl http://localhost:8082/api/v1/health      # through the nginx proxy

# External (after the route is live)
curl -I https://caijing.today
curl https://caijing.today/api/v1/health
```

## Notes

- **No migrations here.** The schema (incl. `cj_*` tables and the `cj_news_feed`
  view) is owned by the data platform. caijing only reads.
- **Keycloak realm** `caijing.today` can be created later — public browsing works
  without it; only sign-in requires it. `VITE_KEYCLOAK_*` are baked at frontend
  build time from `docker/.env`, so rebuild the frontend after the realm exists.
