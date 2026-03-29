# Budget Tracker - Production Deployment Guide

This guide covers deploying the Budget Tracker application to **DigitalOcean App Platform** using Docker.

## Prerequisites

- GitHub account with the repository pushed
- DigitalOcean account
- Supabase project with authentication enabled

---

## 1. GitHub Repository Setup

### Push to GitHub

```bash
# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/budget-tracker.git

# Push to GitHub
git push -u origin main
```

---

## 2. DigitalOcean App Platform Deployment

### Step 1: Create New App

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Select **GitHub** as the source
4. Authorize DigitalOcean to access your repository
5. Select the `budget-tracker` repository and `main` branch

### Step 2: Configure Build Settings

DigitalOcean will auto-detect the Dockerfile. Verify these settings:

| Setting | Value |
|---------|-------|
| **Source Directory** | `/` |
| **Dockerfile Path** | `Dockerfile` |
| **Build Command** | (leave empty - handled by Dockerfile) |
| **Run Command** | (leave empty - handled by Dockerfile) |

### Step 3: Configure Environment Variables

Add the following environment variables in the App Platform dashboard:

| Variable | Value | Encrypted |
|----------|-------|-----------|
| `NODE_ENV` | `production` | No |
| `PORT` | `5000` | No |
| `DATABASE_URL` | `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres` | **Yes** |
| `SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | No |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | **Yes** |
| `VITE_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | No |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | No |

> ⚠️ **Important**: Mark `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as encrypted!

### Step 4: Configure HTTP Settings

| Setting | Value |
|---------|-------|
| **HTTP Port** | `5000` |
| **Health Check Path** | `/` |
| **Instance Size** | Basic ($5/mo) or higher |

### Step 5: Configure App Spec (Optional)

You can also use an App Spec YAML file for deployment:

```yaml
name: budget-tracker
services:
  - name: web
    dockerfile_path: Dockerfile
    github:
      repo: YOUR_USERNAME/budget-tracker
      branch: main
      deploy_on_push: true
    http_port: 5000
    instance_size_slug: basic-xxs
    instance_count: 1
    health_check:
      http_path: /
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "5000"
      - key: DATABASE_URL
        value: "${DATABASE_URL}"
        type: SECRET
      - key: SUPABASE_URL
        value: "${SUPABASE_URL}"
      - key: SUPABASE_ANON_KEY
        value: "${SUPABASE_ANON_KEY}"
      - key: SUPABASE_SERVICE_ROLE_KEY
        value: "${SUPABASE_SERVICE_ROLE_KEY}"
        type: SECRET
      - key: VITE_SUPABASE_URL
        value: "${VITE_SUPABASE_URL}"
      - key: VITE_SUPABASE_ANON_KEY
        value: "${VITE_SUPABASE_ANON_KEY}"
```

---

## 3. Database Configuration

### Supabase Connection String

Use the **Transaction Pooler** connection (port `6543`) for serverless environments:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres
```

**Example:**
```
postgresql://postgres.gihfofsqtzxbitfpzdzb:YourPassword@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
```

### Why Transaction Pooler?

- DigitalOcean App Platform uses serverless containers
- Transaction pooler handles connection pooling automatically
- Prevents "too many connections" errors
- Port `6543` (not `5432`)

---

## 4. Post-Deployment Steps

### Verify Deployment

1. Open your app URL (e.g., `https://budget-tracker-xxxxx.ondigitalocean.app`)
2. You should see the login page
3. Register a new account
4. Create a test project to verify database connectivity

### Push Schema to Supabase

If not already done, push the Drizzle schema:

```bash
npm run db:push
```

---

## 5. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` | Check DATABASE_URL is using port `6543` |
| `JWT verification failed` | Verify SUPABASE_SERVICE_ROLE_KEY is correct |
| `401 Unauthorized` | Ensure VITE_SUPABASE_ANON_KEY matches frontend |
| Build fails | Check Dockerfile syntax and dependencies |

### View Logs

In DigitalOcean dashboard:
1. Go to your app
2. Click **"Runtime Logs"**
3. Filter by component if needed

---

## 6. Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL is automatically provisioned

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                   DigitalOcean App Platform              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Docker Container                    │    │
│  │  ┌─────────────┐    ┌─────────────────────────┐ │    │
│  │  │   Express   │    │   React (Vite build)    │ │    │
│  │  │   Server    │◄───│   Static Files          │ │    │
│  │  │   :5000     │    │                         │ │    │
│  │  └──────┬──────┘    └─────────────────────────┘ │    │
│  └─────────┼───────────────────────────────────────┘    │
└────────────┼────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                            │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   PostgreSQL    │    │        Auth Service         │ │
│  │   (pooler:6543) │    │    (JWT verification)       │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

