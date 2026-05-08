# Deploying DevSuite Hub to Cloudflare from GitHub

This project is a TanStack Start app targeting **Cloudflare Workers** (see
`wrangler.jsonc`). Deploy it via Cloudflare's Workers Builds (CI/CD from GitHub).

> Vercel will not work without a full stack rewrite — the build output is a
> Cloudflare Worker bundle, not a static site or a Node serverless function.

## One-time setup

1. Push this repo to GitHub (Lovable → GitHub → Connect project).
2. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**.
3. Select your repository.
4. Configure the build:
   - **Build command:** `npm install && npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/` (leave default)
   - **Node version:** `20` or newer
5. Click **Save and Deploy**. Every push to your default branch will redeploy.

Your Worker URL will be `https://devsuite-hub.<your-subdomain>.workers.dev`.
You can attach a custom domain from the Worker's **Settings → Domains & Routes**.

## Deploy manually from your machine (optional)

```bash
npm install
npx wrangler login        # one-time
npm run deploy            # vite build && wrangler deploy
```

## Why not Vercel?

`wrangler.jsonc` + `@cloudflare/vite-plugin` produce a Cloudflare Worker bundle
(`main: "@tanstack/react-start/server-entry"`). Vercel cannot execute that
runtime, so the deployed site returns 404 on every route. Switching to Vercel
would require swapping the TanStack Start target to `vercel` and removing the
Cloudflare plugin — a non-trivial migration. Cloudflare is the native fit.
