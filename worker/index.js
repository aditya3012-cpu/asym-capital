// ASYM Capital (asymcapital.uk) — Cloudflare Worker.
// Every request runs here first (assets.run_worker_first): maintenance mode,
// then /api/* (contact form + health check), then the static site in /frontend
// via the ASSETS binding.

const ENQUIRY_LABELS = {
  systematic_trading: "Systematic Trading Strategies",
  algorithmic_execution: "Algorithmic Execution",
  quantitative_analytics: "Quantitative Analytics (QaaS)",
  backtesting: "Backtesting Infrastructure",
  market_signals: "Market Signal Intelligence",
  risk_management: "Portfolio Risk Management",
  general: "General Enquiry",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Company details for outgoing client emails (matches the site footer).
const LEGAL_LINE =
  "ASYM Capital is a trading name of DERIVQ LIMITED, a company registered in England and Wales " +
  "(company number 09852527). Registered office: 53 Kilby Court, Southern Way, North Greenwich, " +
  "London SE10 0PR, United Kingdom.";

// Best-effort per-isolate rate limit (3 submissions / hour / IP).
// For hard limits, add a Cloudflare WAF rate-limiting rule on POST /api/contact.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 3600 * 1000;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => t > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validate(data) {
  if (!data || typeof data !== "object") return "Invalid request.";
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const company = typeof data.company === "string" ? data.company.trim() : "";
  const enquiry = typeof data.enquiry_type === "string" ? data.enquiry_type : "general";

  if (name.length < 2) return "Name must be at least 2 characters.";
  if (name.length > 200) return "Name is too long.";
  if (!EMAIL_RE.test(email) || email.length > 254) return "Please enter a valid email address.";
  if (message.length < 20) return "Message must be at least 20 characters.";
  if (message.length > 5000) return "Message is too long.";
  if (company.length > 200) return "Company name is too long.";
  if (!Object.hasOwn(ENQUIRY_LABELS, enquiry)) return "Invalid enquiry type.";

  return { name, email, message, company: company || null, enquiry };
}

// Email styles: plain, light and table-based so they render in Outlook and Gmail.
const FONT = "Arial,Helvetica,sans-serif";
const WORDMARK = `<span style="font-family:${FONT};font-size:16px;font-weight:bold;letter-spacing:0.06em;color:#0B0D10;">ASYM</span><span style="font-family:${FONT};font-size:16px;color:#0B0D10;"> Capital</span><span style="display:inline-block;width:5px;height:5px;background:#E8521A;margin-left:3px;"></span>`;

function emailShell(title, inner, footer) {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F1F2F2;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F2F2;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #C9CDD2;">
<tr><td style="padding:22px 32px;border-bottom:1px solid #0B0D10;">${WORDMARK}</td></tr>
${inner}
<tr><td style="padding:20px 32px;border-top:1px solid #C9CDD2;font-family:${FONT};font-size:11px;line-height:1.6;color:#555B65;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function notificationHtml(f) {
  const label = esc(ENQUIRY_LABELS[f.enquiry]);
  const row = (k, v) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #E6E8EB;font-family:${FONT};font-size:12px;color:#555B65;width:120px;vertical-align:top;">${k}</td><td style="padding:10px 0;border-bottom:1px solid #E6E8EB;font-family:${FONT};font-size:14px;color:#0B0D10;">${v}</td></tr>`;
  const inner = `<tr><td style="padding:28px 32px 8px;font-family:${FONT};">
<p style="margin:0 0 6px;font-size:12px;color:#555B65;">New website enquiry</p>
<h1 style="margin:0 0 20px;font-size:22px;font-weight:normal;color:#0B0D10;">${label}</h1>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
${row("Name", esc(f.name))}
${row("Email", `<a href="mailto:${esc(f.email)}" style="color:#0B0D10;">${esc(f.email)}</a>`)}
${f.company ? row("Company", esc(f.company)) : ""}
${row("Enquiry type", label)}
</table></td></tr>
<tr><td style="padding:20px 32px 28px;font-family:${FONT};">
<p style="margin:0 0 8px;font-size:12px;color:#555B65;">Message</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#0B0D10;white-space:pre-wrap;">${esc(f.message)}</p></td></tr>`;
  return emailShell("New enquiry: ASYM Capital", inner, "Sent from the contact form on asymcapital.uk. Reply to this email to answer the enquirer directly.");
}

function autoreplyHtml(name) {
  const p = (text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0B0D10;">${text}</p>`;
  const inner = `<tr><td style="padding:28px 32px 12px;font-family:${FONT};">
${p(`Dear ${esc(name)},`)}
${p("Thank you for contacting ASYM Capital. We have received your enquiry and a member of our team will be in touch within 24 hours.")}
${p("If your requirements are time-sensitive, please reply to this email and we will prioritise your enquiry.")}
${p("Kind regards,<br>ASYM Capital")}
</td></tr>`;
  const footer = `contact@asymcapital.uk &middot; +44 7743 262560 &middot; asymcapital.uk<br><br>${LEGAL_LINE}<br>Trading involves substantial risk. Past performance is not indicative of future results.`;
  return emailShell("Thank you for contacting ASYM Capital", inner, footer);
}

async function handleContact(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(ip)) {
    return json({ detail: "Too many submissions. Please try again in an hour." }, 429);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ detail: "Invalid request." }, 400);
  }

  const f = validate(data);
  if (typeof f === "string") return json({ detail: f }, 422);

  const from = { email: env.CONTACT_FROM_EMAIL, name: "ASYM Capital" };
  const label = ENQUIRY_LABELS[f.enquiry];

  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO_EMAIL,
      from,
      replyTo: { email: f.email, name: f.name },
      subject: `[ASYM Enquiry] ${label} — ${f.name}`.replace(/[\r\n]+/g, " "),
      html: notificationHtml(f),
      text: `New enquiry (${label})\nName: ${f.name}\nEmail: ${f.email}\nCompany: ${f.company || "-"}\n\n${f.message}`,
    });
  } catch (err) {
    console.error("Notification email failed", err && err.code, err && err.message);
    return json(
      { detail: `Failed to send message. Please try emailing us directly at ${env.CONTACT_TO_EMAIL}.` },
      500,
    );
  }

  // Auto-reply is best-effort: the enquiry is already delivered to the team.
  try {
    await env.EMAIL.send({
      to: f.email,
      from,
      subject: "Thank you for contacting ASYM Capital",
      html: autoreplyHtml(f.name),
      text: `Dear ${f.name},\n\nThank you for contacting ASYM Capital. Your enquiry has been received and we will be in touch within 24 hours.\n\nASYM Capital\n\n--\n${LEGAL_LINE}\nTrading involves substantial risk. Past performance is not indicative of future results.`,
    });
  } catch (err) {
    console.error("Auto-reply failed", err && err.code, err && err.message);
  }

  return json({ status: "ok", message: "We'll be in touch within 24 hours." });
}

const MAINTENANCE_HTML = `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex"><title>ASYM Capital</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;background:#FCFCFB;color:#0B0D10;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="width:100%;max-width:640px;margin:0 auto;padding:32px 24px;">
<p style="margin:0 0 28px;padding-bottom:20px;border-bottom:1px solid #0B0D10;font-size:17px;"><span style="font-weight:bold;letter-spacing:0.06em;">ASYM</span> Capital<span style="display:inline-block;width:5px;height:5px;background:#E8521A;margin-left:3px;"></span></p>
<h1 style="margin:0 0 12px;font-size:28px;font-weight:300;letter-spacing:-0.01em;">This site is being updated.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#555B65;">Please check back shortly. In the meantime you can reach us at <a href="mailto:contact@asymcapital.uk" style="color:#0B0D10;">contact@asymcapital.uk</a> or <a href="tel:+447743262560" style="color:#0B0D10;">+44 7743 262560</a>.</p>
</div></body></html>`;

function maintenance(request) {
  const wantsJson = new URL(request.url).pathname.startsWith("/api/");
  const headers = { "Retry-After": "3600", "Cache-Control": "no-store" };
  if (wantsJson) {
    return new Response(JSON.stringify({ detail: "Site is under maintenance. Please try again later." }), {
      status: 503,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    // Set MAINTENANCE to "true" in wrangler.jsonc vars to take the site offline.
    if (env.MAINTENANCE === "true") return maintenance(request);

    const { pathname } = new URL(request.url);

    if (pathname === "/api/health") {
      return json({ status: "ok", timestamp: new Date().toISOString() });
    }
    if (pathname === "/api/contact") {
      if (request.method !== "POST") return json({ detail: "Method not allowed." }, 405);
      return handleContact(request, env);
    }
    if (pathname.startsWith("/api/")) return json({ detail: "Not found." }, 404);

    return env.ASSETS.fetch(request);
  },
};
