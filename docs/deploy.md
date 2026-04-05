# CI/CD Deployment Guide

Build happens in **GitHub Actions** (free). The server only runs the pre-built image — no Node.js, no Maven, no build memory pressure.

---

## Branch Workflow (industry standard)

The key rule: **`main` is always production-ready.** Never push unfinished work directly to `main`.

```
Daily dev work  →  feature branch  →  push freely, no deploy triggered
Module complete →  merge to main   →  deploy triggered automatically
```

### Creating a feature branch

```bash
# Start a new module / feature
git checkout -b feature/module-6-spaces

# Work, commit as usual
git add .
git commit -m "Add spaces list page"

# Push the branch to GitHub (safe — does NOT trigger deploy)
git push -u origin feature/module-6-spaces
```

### Merging to main when the module is done

```bash
# Switch to main and merge
git checkout main
git merge feature/module-6-spaces

# Push main → triggers GitHub Actions → auto-deploys to server
git push origin main
```

### Cleaning up after merge

```bash
# Delete the feature branch locally
git branch -d feature/module-6-spaces

# Delete it on GitHub too
git push origin --delete feature/module-6-spaces
```

### Branch naming convention

| Type | Pattern | Example |
|---|---|---|
| New feature / module | `feature/description` | `feature/module-6-spaces` |
| Bug fix | `fix/description` | `fix/journal-search-crash` |
| Design / style work | `style/description` | `style/dashboard-mobile` |

---

## How it works

```
Push to main
    ↓
GitHub Actions
  1. Build Docker image (frontend + backend, multi-stage)
  2. Push image to GitHub Container Registry (ghcr.io)
    ↓
Server
  3. Pull new image
  4. docker compose up -d
```

The existing `Dockerfile` already handles everything (frontend Vite build → Spring Boot jar → JRE image). No changes needed to the Dockerfile.

---

## One-time setup

### Step 1 — Update docker-compose.yml

Add an `image:` field alongside `build:` in the `app` service. Docker Compose will:
- **On server** (`docker compose pull`): pull the pre-built image from ghcr.io
- **Local dev** (`docker compose up --build`): build locally as before

```yaml
app:
  build: .
  image: ghcr.io/spring0210/my-journey:latest   # ← add this line
  container_name: my-journey-app
  ...
```

### Step 2 — Create the GitHub Actions workflow

Create `.github/workflows/deploy.yml` at the repo root:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      packages: write      # required to push to ghcr.io

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # auto-provided by GitHub, no setup needed

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/spring0210/my-journey:latest
          cache-from: type=gha         # layer cache — speeds up repeat builds significantly
          cache-to: type=gha,mode=max

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/my-journey
            echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u spring0210 --password-stdin
            docker compose pull
            docker compose up -d --remove-orphans
            docker image prune -f
```

### Step 3 — Add GitHub Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
|---|---|
| `SERVER_HOST` | Your server IP (e.g. `143.xxx.xxx.xxx`) |
| `SERVER_USER` | SSH login user (e.g. `root`) |
| `SERVER_SSH_KEY` | Private SSH key — see Step 4 |
| `GHCR_TOKEN` | GitHub Personal Access Token — see Step 5 |

### Step 4 — Generate SSH key for GitHub Actions

Run this **locally** (not on the server):

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy -N ""
```

Copy the **public key** to the server:

```bash
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub root@YOUR_SERVER_IP
# or manually: cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys on the server
```

Copy the **private key** content into the `SERVER_SSH_KEY` GitHub secret:

```bash
cat ~/.ssh/github_actions_deploy
```

Paste the entire output (including `-----BEGIN...` and `-----END...` lines) as the secret value.

### Step 5 — Create a GitHub Personal Access Token (for server to pull image)

Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**.

Scopes needed: `read:packages`

Save the token value as the `GHCR_TOKEN` GitHub secret.

### Step 6 — Prepare the server

SSH into your server and set up the deployment directory:

```bash
mkdir -p /opt/my-journey
cd /opt/my-journey
```

Copy your `docker-compose.yml` and `.env` file to `/opt/my-journey/` on the server.
The `.env` file holds all secrets (never committed to git):

```
MYSQL_ROOT_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## After setup — normal workflow

Every `git push` to `main` triggers the full pipeline automatically.

Manual deploy (if needed):

```bash
ssh root@YOUR_SERVER_IP
cd /opt/my-journey
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
```

---

## Local development — no change

Local dev works exactly as before:

```bash
# build and run locally
docker compose up --build

# or run frontend dev server separately
cd frontend && npm run dev
```

---

## Troubleshooting

**Check Action logs:** GitHub repo → Actions tab → click the failing run.

**Check server container logs:**
```bash
docker logs my-journey-app --tail 100 -f
docker logs my-journey-mysql --tail 50
```

**Image not found / 403 on pull:**
Make sure the GitHub package visibility is set to **Public**, or confirm the server is logged in to ghcr.io using the token from Step 5.
To set package visibility: GitHub → your profile → Packages → my-journey → Package settings → Change visibility → Public.

**Build cache miss (slow build):** Normal on the first run after a dependency change. Subsequent pushes that don't touch `package.json` or `pom.xml` will be fast due to layer caching.

---

## Build time estimates

| Scenario | Approx time |
|---|---|
| First build (no cache) | 4–7 min |
| Code-only change (deps cached) | 1.5–3 min |
| Server deploy step only | ~20 sec |
