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
  if (!(enquiry in ENQUIRY_LABELS)) return "Invalid enquiry type.";

  return { name, email, message, company: company || null, enquiry };
}

function notificationHtml(f) {
  const label = esc(ENQUIRY_LABELS[f.enquiry]);
  const row = (k, v) =>
    `<tr><td style="padding:10px 16px;color:#5A5A62;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #2E2E34;white-space:nowrap;">${k}</td><td style="padding:10px 16px;color:#F5F0E8;font-size:13px;border-bottom:1px solid #2E2E34;">${v}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Enquiry — ASYM Capital</title></head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Courier New',Courier,monospace;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0C0C0E;padding:40px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:#141416;border:1px solid #2E2E34;padding:24px 32px;border-bottom:none;"><p style="margin:0;color:#E8521A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">ASYM Capital</p><h1 style="margin:8px 0 0;color:#FEFCF8;font-size:20px;font-weight:700;letter-spacing:0.04em;">New Enquiry Received</h1></td></tr>
<tr><td style="background:#1C1C20;border:1px solid #2E2E34;border-top:none;border-bottom:none;padding:16px 32px;"><span style="display:inline-block;background:#E8521A;color:#0C0C0E;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;padding:4px 10px;">${label}</span></td></tr>
<tr><td style="background:#1C1C20;border:1px solid #2E2E34;border-top:none;border-bottom:none;padding:0 0 8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
${row("Name", esc(f.name))}
${row("Email", `<a href="mailto:${esc(f.email)}" style="color:#E8521A;text-decoration:none;">${esc(f.email)}</a>`)}
${f.company ? row("Company", esc(f.company)) : ""}
${row("Enquiry&nbsp;Type", label)}
</table></td></tr>
<tr><td style="background:#1C1C20;border:1px solid #2E2E34;padding:24px 32px;"><p style="margin:0 0 12px;color:#5A5A62;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Message</p><p style="margin:0;color:#F5F0E8;font-size:14px;line-height:1.8;white-space:pre-wrap;">${esc(f.message)}</p></td></tr>
<tr><td style="background:#141416;border:1px solid #2E2E34;border-top:none;padding:16px 32px;"><p style="margin:0;color:#5A5A62;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">ASYM Capital · asymcapital.uk</p></td></tr>
</table></td></tr></table></body></html>`;
}

function autoreplyHtml(name) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Thank you — ASYM Capital</title></head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Courier New',Courier,monospace;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0C0C0E;padding:40px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:#141416;border:1px solid #2E2E34;padding:24px 32px;border-bottom:3px solid #E8521A;"><p style="margin:0;color:#E8521A;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">ASYM Capital</p><h1 style="margin:8px 0 0;color:#FEFCF8;font-size:20px;font-weight:700;letter-spacing:0.04em;">We've received your message.</h1></td></tr>
<tr><td style="background:#1C1C20;border:1px solid #2E2E34;border-top:none;padding:32px;">
<p style="margin:0 0 20px;color:#F5F0E8;font-size:14px;line-height:1.8;">Dear ${esc(name)},</p>
<p style="margin:0 0 20px;color:#B5AFA3;font-size:14px;line-height:1.8;">Thank you for reaching out to <strong style="color:#F5F0E8;">ASYM Capital</strong>. Your enquiry has been received and a member of our team will be in touch within <strong style="color:#E8521A;">24 hours</strong>.</p>
<p style="margin:0 0 20px;color:#B5AFA3;font-size:14px;line-height:1.8;">We work with a select number of clients and take great care in every engagement. If your requirements are time-sensitive, please reply to this email directly and we will prioritise your enquiry.</p>
<p style="margin:0;color:#B5AFA3;font-size:14px;line-height:1.8;">Regards,<br><strong style="color:#F5F0E8;">ASYM Capital</strong></p></td></tr>
<tr><td style="background:#141416;border:1px solid #2E2E34;border-top:none;padding:16px 32px;"><p style="margin:0 0 8px;color:#8F8A80;font-size:10px;line-height:1.6;letter-spacing:0.04em;">${LEGAL_LINE}</p><p style="margin:0;color:#8F8A80;font-size:10px;line-height:1.6;letter-spacing:0.04em;">Trading involves substantial risk. Past performance is not indicative of future results.</p></td></tr>
</table></td></tr></table></body></html>`;
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

const MAINTENANCE_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex"><title>Under Maintenance — ASYM Capital</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0C0C0E;font-family:'Courier New',Courier,monospace;color:#F5F0E8;text-align:center;">
<div style="padding:32px;max-width:520px;">
<p style="margin:0 0 16px;color:#E8521A;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">ASYM Capital</p>
<h1 style="margin:0 0 16px;font-size:24px;letter-spacing:0.04em;color:#FEFCF8;">Under maintenance</h1>
<p style="margin:0;font-size:14px;line-height:1.8;color:#B5AFA3;">We're making some improvements and will be back shortly. Thank you for your patience.</p>
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
