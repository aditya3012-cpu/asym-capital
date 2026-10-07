# ASYM Capital website — handoff for the redesign

This file tells you how asymcapital.uk is hosted and deployed, what state it is in, and what to watch out for. It was written at the end of the setup session (7 Oct 2026). The next job is a redesign: the current site looks templated / "vibe coded", and the goal is a site that reads like a serious, boutique quantitative investment and advisory firm.

---

## 1. Current state at a glance

| Item | State |
|---|---|
| Live domain | **https://asymcapital.uk** |
| What visitors see right now | **A 503 "Under maintenance" page** (deliberate; see §5) |
| Hosting | Cloudflare Workers with static assets, Worker name **`asym-capital-uk`** |
| workers.dev URL | https://asym-capital-uk.bars-cocoon-49.workers.dev (also in maintenance) |
| Source repo | GitHub **`aditya3012-cpu/asym-capital`** |
| Branch that deploys | **`cloudflare-uk`** (pushing to it auto-deploys in ~40–60 s) |
| `main` branch | Untouched original FastAPI + vanilla JS app (Railway). **Do not deploy from it.** |
| Contact form email | **Not working.** Cloudflare Email Sending needs the paid Workers plan, which hasn't been bought (see §6) |

---

## 2. Things that must stay separate (do not touch)

The owner has a **second, older setup** in the same Cloudflare account. Keep it completely separate:

- **Worker `asym-capital`** (no `-uk`) serves **asymcapital.in**. Do not edit, redeploy or rename it.
- **asymcapital.in**: do not change its DNS, routes or custom domains.
- **`main` branch** of the repo: the original Railway deployment (FastAPI backend + `frontend/`). Leave it alone unless the owner asks.
- Railway project: unrelated to Cloudflare; ignore it.

All the asymcapital.uk work lives on the `cloudflare-uk` branch and the `asym-capital-uk` Worker.

---

## 3. How the deployment works

**Cloudflare account:** `Bars_cocoon_49@icloud.com's Account` (account ID `a570d530c0b68e95fdadd297d960e76e`). The owner signs in themselves; never enter credentials.

**Workers Builds (Git integration)** is connected to the repo:

- Production branch: `cloudflare-uk`
- Root directory: `/`
- Build command: *(none)*
- Deploy command: `npx wrangler deploy`
- Preview builds: enabled (other branches get `*-asym-capital-uk.bars-cocoon-49.workers.dev` preview URLs)
- The Worker name in the dashboard **must stay `asym-capital-uk`** and match `name` in `wrangler.jsonc`, or builds fail.

So the workflow is: commit to `cloudflare-uk` → push → Cloudflare builds and deploys automatically. Build logs are in the dashboard under Workers & Pages → asym-capital-uk → Deployments → build history.

If you add a build step (e.g. a framework or bundler), set the **Build command** in the dashboard (Settings → Build) and make sure `assets.directory` in `wrangler.jsonc` points at the build output.

### `wrangler.jsonc` (repo root, current)

```jsonc
{
  "name": "asym-capital-uk",
  "main": "worker/index.js",
  "compatibility_date": "2026-10-03",
  "assets": {
    "directory": "./frontend",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "send_email": [{ "name": "EMAIL" }],
  "vars": {
    "MAINTENANCE": "true",
    "CONTACT_FROM_EMAIL": "contact@asymcapital.uk",
    "CONTACT_TO_EMAIL": "contact@asymcapital.uk"
  },
  "observability": { "enabled": true }
}
```

### `worker/index.js`: what the Worker does

0. Plain-HTTP requests get a 301 to HTTPS (localhost exempt for `wrangler dev`). Every response carries security headers: HSTS (1 year), nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy and a same-origin Content-Security-Policy (inline style/script allowed). `/fonts/*` is cached for 30 days.
1. If `env.MAINTENANCE === "true"`, return a 503 maintenance page for every request (JSON 503 for `/api/*`), with `Retry-After: 3600` and `noindex`.
2. `GET /api/health` returns `{status:"ok", timestamp}`.
3. `POST /api/contact`: the contact form backend:
   - Validates `name` (2–200 chars), `email` (regex, ≤254), `message` (20–5000), optional `company` (≤200), `enquiry_type` (one of `systematic_trading`, `algorithmic_execution`, `quantitative_analytics`, `backtesting`, `market_signals`, `risk_management`, `general`). Returns 422 with `{detail}` on failure.
   - Rate limit: 3 per hour per IP, in memory per isolate (best effort only; invalid submissions count too). A Cloudflare WAF rate-limiting rule on `POST /api/contact` would be the proper fix.
   - Sends a notification email to `CONTACT_TO_EMAIL` (reply-to = the enquirer), then a best-effort auto-reply to the enquirer, via the `EMAIL` (Email Service) binding. User input is HTML-escaped. The auto-reply footer carries the DERIVQ LIMITED company details (`LEGAL_LINE`), matching the site footer.
   - Returns `{status:"ok", message}` or `{detail}` with 400/422/429/500.
4. Any other `/api/*` returns 404; everything else is served by `env.ASSETS.fetch(request)` (the static site). `assets.not_found_handling` is `"404-page"`, so unknown paths get `frontend/404.html` with a 404 status (verified locally with `wrangler dev`).

The frontend (`frontend/main.js`, ~line 104) posts the form as JSON to same-origin `/api/contact` and expects the response shapes above. If you rebuild the frontend, keep that contract or update the Worker to match.

---

## 4. Domain and DNS (asymcapital.uk)

- Registrar: **GoDaddy**. Nameservers changed to Cloudflare: `elaine.ns.cloudflare.com`, `fattouche.ns.cloudflare.com`. The zone is **active** on the Cloudflare **Free** plan.
- **Custom domain:** `asymcapital.uk` is attached to the `asym-capital-uk` Worker (Production). Cloudflare manages its DNS record and SSL automatically.
- GoDaddy's two parking A records (`15.197.148.33`, `3.33.130.190`) were deleted so the custom domain could attach.
- Remaining DNS records (left on purpose):
  - `www` CNAME → `asymcapital.uk` (proxied). **Confirmed broken on 7 Oct 2026: https://www.asymcapital.uk returns Cloudflare error 522**, because the CNAME points at a Worker custom domain rather than an origin. Fix: delete the CNAME and add `www.asymcapital.uk` as a second custom domain on the Worker, or keep a proxied record and add a redirect rule www → apex.
  - `_domainconnect` CNAME (GoDaddy leftover, harmless)
  - `_dmarc` TXT: `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` (a GoDaddy default; revisit when setting up email sending, since `p=quarantine` with no SPF/DKIM yet means any mail from the domain gets quarantined)
- **Mail (added after the setup session):** MX records point to Fastmail (`eu1-smtp.messagingengine.com`, `eu2-smtp.messagingengine.com`) and SPF is `v=spf1 include:spf.messagingengine.com ?all`, so `contact@asymcapital.uk` receives mail. If Cloudflare Email Sending or another provider is added for the contact form, its SPF/DKIM records must be added alongside Fastmail's (DMARC is `p=quarantine`).

---

### Second domain: derivq.com (owner's request, 7 Oct 2026)

The owner owns derivq.com and wants the same website served there. It is served by the **same** `asym-capital-uk` Worker, so both domains always show identical content. Canonical tags, Open Graph URLs, the sitemap and structured data all point to `https://asymcapital.uk/...`, so Google treats asymcapital.uk as the main address and folds derivq.com into it (no duplicate-content split). The Worker redirects `http://` and `www.` on either domain to `https://<apex>` in one hop.

As of 7 Oct 2026 derivq.com uses GoDaddy nameservers (`ns39/ns40.domaincontrol.com`), points at a GoDaddy parking page, and has **no MX records** (no email to preserve). To attach it:
1. Cloudflare dashboard → Add a domain → `derivq.com` → Free plan. In the imported DNS records, delete GoDaddy's two A records (`76.223.105.230`, `13.248.243.5`) and the `www` CNAME.
2. GoDaddy → derivq.com → Nameservers → "I'll use my own" → enter the two Cloudflare nameservers shown. Wait for the zone to become Active.
3. Workers & Pages → `asym-capital-uk` → Settings → Domains & Routes → Add → Custom domain: `derivq.com`, then again for `www.derivq.com`.
4. Same fix for the broken `www.asymcapital.uk`: delete its CNAME in the asymcapital.uk DNS, then add `www.asymcapital.uk` as a custom domain on the Worker (the Worker redirects it to the apex).

Do not add these domains via `routes` in `wrangler.jsonc` unless asymcapital.uk is listed there too: a Wrangler deploy can replace dashboard-managed routes.

## 5. Maintenance mode (currently ON)

The owner asked for the site to be taken offline while it's redone.

- **Turn off (site live):** set `"MAINTENANCE": "false"` in `wrangler.jsonc` on `cloudflare-uk`, commit and push. It's live again in about a minute.
- **Turn on:** set it back to `"true"`.
- While building the redesign, work on a **separate branch** (e.g. `redesign`). Workers Builds will give it a preview URL like `https://<branch>-asym-capital-uk.bars-cocoon-49.workers.dev`. Preview deployments use the same `wrangler.jsonc`, so set `MAINTENANCE` to `"false"` on that branch to see the site, then merge into `cloudflare-uk` and flip the flag there when the owner approves the launch.
- Confirm the preview URL pattern in the dashboard (Domains tab) before relying on it.

---

## 6. Open issues and decisions pending

1. **Contact form email doesn't send.** The Worker uses the Cloudflare Email Service `send_email` binding, but Email Sending says it's "only available with the Workers Paid plan" (~US$5/month). The owner hasn't chosen yet. Options:
   - Buy Workers Paid, then onboard `asymcapital.uk` to Email Sending (adds SPF/DKIM DNS records) and send a test enquiry. No code change needed.
   - Switch the Worker to a third-party API (Resend, Brevo, Postmark, …) using `fetch` + an API key stored as a Worker **secret** (`wrangler secret put`), with that provider's DNS records on asymcapital.uk.
   - Send through the owner's Fastmail account via Fastmail's JMAP API, with an API token stored as a Worker secret (no extra DNS needed, since Fastmail already sends for the domain).
   - Replace the form with a `mailto:` link.
   Until resolved, the Worker returns 500, and the frontend falls back: it opens a pre-filled email to contact@asymcapital.uk (the form's `data-mailto`) in the visitor's own mail app and shows a backup link. The same fallback covers 429, other 5xx responses and network errors; 400/422 show the server's validation message. The owner confirmed enquiries go to contact@asymcapital.uk only (not asymcapital.com, a domain whose ownership is unconfirmed).
2. ~~Branding/copy still references asymcapital.in.~~ Resolved: the site and `CONTACT_TO_EMAIL` now use contact@asymcapital.uk (see §8 for the confirmed company details).
2a. **Analytics: none installed.** Recommended: Cloudflare Web Analytics (free, cookieless, so no cookie banner needed). Dashboard → Analytics & Logs → Web Analytics → Add a site → asymcapital.uk; with the zone proxied, choose automatic setup, or paste the provided `<script>` tag into the pages and add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in the Worker's CSP. Then update the privacy policy's cookies/analytics section.
2c. **Search and AI answers (Google, Gemini/AI Overviews).** Nothing can be indexed while MAINTENANCE is "true" (every URL returns 503). The homepage carries Organization + WebSite JSON-LD naming ASYM Capital with legalName/alternateName DERIVQ LIMITED, the company number and a sameAs link to Companies House; the meta description and the About section say "ASYM Capital is registered under DERIVQ LIMITED (CRN 09852527)"; the footer and legal pages repeat it. After launch: verify the domain in Google Search Console (DNS TXT record in Cloudflare), submit /sitemap.xml, request indexing for /. External profiles that state the same relationship (Crunchbase, LinkedIn) help Google connect the entity; add their URLs to the JSON-LD `sameAs` list when they exist.
2b. **Performance (7 Oct 2026, Lighthouse via `wrangler dev`):** 100 performance / 100 accessibility / 100 best practices / 100 SEO on both mobile and desktop presets; 107 KB total page weight; no cookies set.
3. **Rate limiting** is per-isolate only; add a Cloudflare rate-limiting rule for `POST /api/contact` (Security → WAF → Rate limiting rules).
4. **Spam protection:** none yet. Consider Cloudflare Turnstile on the form (verify the token in the Worker).
5. **`www` subdomain** returns error 522 (see §4). Fix before launch.

---

## 7. Repo layout (`cloudflare-uk` branch)

```
frontend/index.html     # whole site: one HTML file with inline CSS (see §8 design system)
frontend/main.js        # mobile menu, Enquire preselect, footer year, contact form (posts to /api/contact)
frontend/404.html       # "Page not found" page (served with a 404 status for any unknown path)
frontend/privacy.html, terms.html   # Privacy policy and terms of use, served at /privacy and /terms
frontend/fonts/         # Archivo, self-hosted Latin subset (woff2) + OFL licence; no Google Fonts requests
frontend/favicon.svg, favicon.ico, apple-touch-icon.png, og.png (1200x630 link preview), robots.txt, sitemap.xml
worker/index.js         # Cloudflare Worker (maintenance, health, contact API, assets)
wrangler.jsonc          # Worker config (see §3)
asymcapital-website-v3.html  # older standalone copy of the site; not deployed
backend/                # original FastAPI app (Railway, from main); NOT used on Cloudflare
Dockerfile, Procfile, nixpacks.toml, railway.json, start.sh, .env.example  # Railway-only
README.md               # describes the FastAPI/Railway setup, not Cloudflare
```

Everything Cloudflare serves comes from `frontend/` (static) and `worker/index.js`. The Python backend is dead weight on this branch; the redesign can remove it from `cloudflare-uk` (keep it on `main`).

---

## 8. About the firm (context for the redesign)

- **ASYM Capital**: boutique quantitative investment and advisory firm, presented on asymcapital.uk as London-based.
- **Confirmed by the owner (7 Oct 2026):**
  - Established **2022**. Do not mention Bengaluru on the UK site.
  - Markets traded (as shown on the site): NASDAQ, NYSE, CME, LSE.
  - The owner will not disclose the basis of the Sharpe ratio (period, book); don't ask again. The "60+" signals figure and the "60+ equities" in the Market Signal Intelligence copy are the same number.
  - The firm does both proprietary trading and client services. All six services below are real and offered.
  - Audience: institutions, family offices, high-net-worth individuals and funds (anyone the firm pitches to).
  - Registered entity: **DERIVQ LIMITED**, company number **09852527**, registered in England and Wales (incorporated 2 Nov 2015). Registered office (per Companies House): 53 Kilby Court, Southern Way, North Greenwich, London SE10 0PR. The site states "ASYM Capital is a trading name of DERIVQ LIMITED" in the footer.
  - Contact: contact@asymcapital.uk, +44 7743 262560, office 53 Kilby Court, Southern Way, London SE10 0PR.
  - The published figures are real: Sharpe ratio 1.87, 240μs execution latency, 60+ signals in production, 3 asset classes.
  - No GitHub or LinkedIn links on the site.
  - A compliance officer reviews the site before publishing.
- Services the site and form list: systematic trading strategies, algorithmic execution, quantitative analytics (QaaS), backtesting infrastructure, market signal intelligence, portfolio risk management.
- **Design system (chosen by the owner, 7 Oct 2026: "Hairline Lab").** The owner's brief: it must not look like a "vibe-coded" or template site.
  - Near-white `#FCFCFB` page, ink `#0B0D10` text, muted `#555B65`, rules `#C9CDD2`, faint grid `#E6E8EB`. Brand orange `#E8521A` is a graphic accent only (wordmark dot, the histogram's upside tail, hover/focus lines); orange text uses `#B23E12`. Dark footer `#0B0D10`.
  - One typeface: Archivo (Google Fonts), using its width axis: light 300 for headings and figures, 400 body, expanded 125% caps for small labels.
  - A 12-column grid (1280px max) is drawn faintly behind the page; content cells sit on the same tracks. 4 columns on phones.
  - Fig. 1 (hero) is a precomputed skew-normal histogram and Fig. 2 a conceptual payoff diagram. Both are captioned "not performance data". Never add charts that look like real performance.
  - Copy rules: plain declarative sentences, sentence case, en-GB spelling. Avoid AI-copy tells: "X, not Y" slogans, triads, "Where X becomes Y" taglines, buzzwords such as "institutional-grade solutions", em-dash rhythm. Don't add animations, counters, tickers, custom cursors or decorative chips.
  - The contact form is shown only when JS runs (`html.js`); without JS a `<noscript>` line gives the email and phone. The mobile menu is a `<details>` element, so it works without JS.
  - The Worker's maintenance page and both emails use the same light style (Arial/Helvetica in email).
- The site carries a risk disclaimer ("Trading involves substantial risk. Past performance is not indicative of future results."). Keep appropriate financial-services disclaimers in the redesign, and don't invent performance figures, client names, regulatory status or team members. Ask the owner for real content.

---

## 9. Gotchas from the setup session

- Static assets **skip the Worker** unless `run_worker_first` covers the path. That's why maintenance mode needed `run_worker_first: true`. If you set it back to `["/api/*"]` for performance, maintenance mode will only cover the API.
- The first Workers Build ran from `main` before the branch was switched and deployed a static-only version; it was replaced. The production branch is now correctly `cloudflare-uk`.
- `DMARC p=quarantine` is already published. Set up SPF/DKIM before sending any mail from the domain, or it will land in spam or quarantine.
- Never edit the `asym-capital` Worker or asymcapital.in (see §2).
