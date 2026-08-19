#!/usr/bin/env bash
# =============================================================================
# caijing.today — Production Deployment Script (runs ON the Raspberry Pi)
# =============================================================================
# caijing.today is a read API + frontend GUI. It has NO database and NO collector
# of its own — both are shared with the whereq data platform (whereq-db +
# whereq-collector). This script only (re)builds the api + frontend containers.
#
# Usage:
#   bin/deploy.sh [MODE] [OPTIONS]
#
# MODES (default: full):
#   full        Rebuild both containers: caijing-api + caijing-frontend
#   frontend    Rebuild frontend only  — fastest, no API downtime
#   api         Rebuild api only       — frontend nginx reloaded for the new api IP
#
# OPTIONS:
#   --branch <name>   Git branch to pull (default: main)
#   --no-pull         Skip git pull (deploy current local code as-is)
#   --dry-run         Print commands without executing
#   -h, --help        Show this help
#
# Prereqs on the Pi (once): the shared db + network must be up (owned by the
# data-platform repo), e.g. `docker compose -f docker/docker-compose.postgres.yml up -d`.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}▶${NC} $*"; }
ok()    { echo -e "${GREEN}✔${NC} $*"; }
warn()  { echo -e "${YELLOW}!${NC} $*"; }
error() { echo -e "${RED}✘${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
API_CONTAINER="caijing-api"
FRONTEND_CONTAINER="caijing-frontend"
API_HEALTH_URL="http://localhost:8004/api/v1/health"   # api host port (see compose)
WEB_URL="http://localhost:8084"                        # frontend host port (tunnel target)

MODE="full"; BRANCH="main"; DO_PULL=true; DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        full|frontend|api) MODE="$1"; shift ;;
        --branch) [[ -n "${2:-}" ]] || { error "--branch requires a value"; exit 1; }; BRANCH="$2"; shift 2 ;;
        --no-pull) DO_PULL=false; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) error "Unknown argument: $1"; exit 1 ;;
    esac
done

run() {
    if $DRY_RUN; then echo -e "${YELLOW}[dry-run]${NC} $*"; else eval "$@"; fi
}

info "caijing.today deploy — mode=${BOLD}${MODE}${NC} branch=${BOLD}${BRANCH}${NC} dry-run=${DRY_RUN}"
cd "$PROJECT_ROOT"

# 1. Pull latest code
if $DO_PULL; then
    [[ "$BRANCH" == "main" ]] || warn "Deploying non-main branch '${BRANCH}'."
    info "git pull origin ${BRANCH}"
    run "git pull origin ${BRANCH}"
else
    warn "Skipping git pull (--no-pull)"
fi

# 2. Build + (re)start containers
case "$MODE" in
    full)
        info "Rebuilding api + frontend"
        run "docker compose -f '${COMPOSE_FILE}' up -d --build"
        ;;
    frontend)
        info "Rebuilding frontend only"
        run "docker compose -f '${COMPOSE_FILE}' up -d --build --no-deps ${FRONTEND_CONTAINER}"
        ;;
    api)
        info "Rebuilding api; reloading frontend nginx for the new api IP"
        run "docker compose -f '${COMPOSE_FILE}' up -d --build ${API_CONTAINER}"
        run "docker compose -f '${COMPOSE_FILE}' restart ${FRONTEND_CONTAINER}"
        ;;
esac

# 3. Health checks (skip on dry-run)
if $DRY_RUN; then ok "Dry-run complete."; exit 0; fi

info "Waiting for containers to become healthy…"
health_ok=false
for i in $(seq 1 20); do
    if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1 \
       && curl -fsS -o /dev/null "$WEB_URL" \
       && curl -fsS "${WEB_URL}/api/v1/health" >/dev/null 2>&1; then
        health_ok=true; break
    fi
    sleep 3
done

if $health_ok; then
    ok "API healthy:            ${API_HEALTH_URL}"
    ok "Frontend serving:       ${WEB_URL}"
    ok "Frontend → API proxy:   ${WEB_URL}/api/v1/health"
    echo
    ok "Deploy complete. Cloudflare tunnel target for caijing.today → ${BOLD}${WEB_URL#http://}${NC}"
else
    error "Health checks did not pass within timeout."
    warn  "Inspect: docker compose -f docker/docker-compose.yml ps && ... logs -f ${API_CONTAINER}"
    exit 1
fi
