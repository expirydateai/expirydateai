# ExpiryDate

Static landing page + one serverless function, ready to deploy to Vercel.

## Structure

```
index.html        the whole site (single page, no build step)
api/score.js       serverless function that calls the Anthropic API server-side
public/logo.jpg     your uploaded stamp logo (favicon + on-page brandmark)
package.json        just declares the Node version Vercel should use
```

## Deploy

**Option A — Vercel CLI**
```
npm install -g vercel
cd expirydate
vercel
```

**Option B — Git**
Push this folder to a GitHub/GitLab/Bitbucket repo, then "Import Project" in the
Vercel dashboard and point it at that repo. No build command or output
directory needed — it's a static site with one `/api` function.

## Required environment variable

The scoring form calls `POST /api/score`, which calls the real Anthropic API
using a key that stays on the server. Before (or right after) deploying, set:

- **Key:** `ANTHROPIC_API_KEY`
- **Value:** your Anthropic API key (starts with `sk-ant-...`)

In the Vercel dashboard: **Project → Settings → Environment Variables** →
add it for Production (and Preview/Development if you want it working on
preview deploys too) → redeploy.

Without this variable set, `/api/score` returns a 500 and the page falls back
to its offline heuristic scoring so the UI still works, just without live
Claude-generated results.

## Local testing

```
vercel dev
```
This runs both the static site and the `/api/score` function locally with
the same env var requirement.
