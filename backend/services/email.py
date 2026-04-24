from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from backend.config import settings
from backend.models.contact import ContactForm, ENQUIRY_LABELS

logger = logging.getLogger(__name__)


def _build_notification_html(form: ContactForm) -> str:
    enquiry_label = ENQUIRY_LABELS.get(form.enquiry_type, form.enquiry_type)
    company_row = (
        f"""
        <tr>
          <td style="padding:10px 16px;color:#5A5A62;font-size:12px;
              letter-spacing:0.1em;text-transform:uppercase;
              border-bottom:1px solid #2E2E34;white-space:nowrap;">Company</td>
          <td style="padding:10px 16px;color:#F5F0E8;font-size:13px;
              border-bottom:1px solid #2E2E34;">{form.company}</td>
        </tr>"""
        if form.company
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New Enquiry — ASYM Capital</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#0C0C0E;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#141416;border:1px solid #2E2E34;
                       padding:24px 32px;border-bottom:none;">
              <p style="margin:0;color:#E8521A;font-size:11px;
                         letter-spacing:0.2em;text-transform:uppercase;">
                ASYM Capital
              </p>
              <h1 style="margin:8px 0 0;color:#FEFCF8;font-size:20px;
                          font-weight:700;letter-spacing:0.04em;">
                New Enquiry Received
              </h1>
            </td>
          </tr>

          <!-- Enquiry type badge -->
          <tr>
            <td style="background:#1C1C20;border:1px solid #2E2E34;
                       border-top:none;border-bottom:none;padding:16px 32px;">
              <span style="display:inline-block;background:#E8521A;color:#0C0C0E;
                           font-size:10px;letter-spacing:0.12em;
                           text-transform:uppercase;padding:4px 10px;">
                {enquiry_label}
              </span>
            </td>
          </tr>

          <!-- Details table -->
          <tr>
            <td style="background:#1C1C20;border:1px solid #2E2E34;
                       border-top:none;border-bottom:none;padding:0 0 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:10px 16px 6px;color:#5A5A62;font-size:12px;
                      letter-spacing:0.1em;text-transform:uppercase;
                      border-bottom:1px solid #2E2E34;white-space:nowrap;">Name</td>
                  <td style="padding:10px 16px 6px;color:#F5F0E8;font-size:13px;
                      border-bottom:1px solid #2E2E34;">{form.name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#5A5A62;font-size:12px;
                      letter-spacing:0.1em;text-transform:uppercase;
                      border-bottom:1px solid #2E2E34;white-space:nowrap;">Email</td>
                  <td style="padding:10px 16px;border-bottom:1px solid #2E2E34;">
                    <a href="mailto:{form.email}"
                       style="color:#E8521A;font-size:13px;text-decoration:none;">
                      {form.email}
                    </a>
                  </td>
                </tr>
                {company_row}
                <tr>
                  <td style="padding:10px 16px;color:#5A5A62;font-size:12px;
                      letter-spacing:0.1em;text-transform:uppercase;
                      white-space:nowrap;">Enquiry&nbsp;Type</td>
                  <td style="padding:10px 16px;color:#F5F0E8;font-size:13px;">
                    {enquiry_label}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="background:#1C1C20;border:1px solid #2E2E34;
                       border-top:1px solid #2E2E34;padding:24px 32px;">
              <p style="margin:0 0 12px;color:#5A5A62;font-size:11px;
                         letter-spacing:0.14em;text-transform:uppercase;">Message</p>
              <p style="margin:0;color:#F5F0E8;font-size:14px;line-height:1.8;
                         white-space:pre-wrap;">{form.message}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#141416;border:1px solid #2E2E34;
                       border-top:none;padding:16px 32px;">
              <p style="margin:0;color:#2E2E34;font-size:10px;
                         letter-spacing:0.08em;text-transform:uppercase;">
                ASYM Capital · asymcapital.in · Bengaluru, India
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_autoreply_html(name: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Thank you — ASYM Capital</title>
</head>
<body style="margin:0;padding:0;background:#0C0C0E;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#0C0C0E;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#141416;border:1px solid #2E2E34;
                       padding:24px 32px;border-bottom:3px solid #E8521A;">
              <p style="margin:0;color:#E8521A;font-size:11px;
                         letter-spacing:0.2em;text-transform:uppercase;">
                ASYM Capital
              </p>
              <h1 style="margin:8px 0 0;color:#FEFCF8;font-size:20px;
                          font-weight:700;letter-spacing:0.04em;">
                We've received your message.
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1C1C20;border:1px solid #2E2E34;
                       border-top:none;padding:32px;">
              <p style="margin:0 0 20px;color:#F5F0E8;font-size:14px;line-height:1.8;">
                Dear {name},
              </p>
              <p style="margin:0 0 20px;color:#7A7468;font-size:14px;line-height:1.8;">
                Thank you for reaching out to <strong style="color:#F5F0E8;">ASYM Capital</strong>.
                Your enquiry has been received and a member of our team will be in touch
                within <strong style="color:#E8521A;">24 hours</strong>.
              </p>
              <p style="margin:0 0 20px;color:#7A7468;font-size:14px;line-height:1.8;">
                We work with a select number of clients and take great care in every engagement.
                If your requirements are time-sensitive, please reply to this email directly
                and we will prioritise your enquiry.
              </p>
              <p style="margin:0;color:#7A7468;font-size:14px;line-height:1.8;">
                Regards,<br>
                <strong style="color:#F5F0E8;">ASYM Capital</strong><br>
                <span style="color:#E8521A;">Bengaluru, India</span>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background:#141416;border:1px solid #2E2E34;
                       border-top:none;padding:16px 32px;">
              <p style="margin:0;color:#2E2E34;font-size:10px;
                         letter-spacing:0.08em;text-transform:uppercase;">
                ASYM Capital · contact@asymcapital.in · asymcapital.in
              </p>
              <p style="margin:6px 0 0;color:#2E2E34;font-size:9px;
                         letter-spacing:0.06em;">
                Trading involves substantial risk. Past performance is not indicative of future results.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_emails_sync(form: ContactForm) -> None:
    """Synchronous email send — called via run_in_executor to avoid blocking."""
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASS)

        enquiry_label = ENQUIRY_LABELS.get(form.enquiry_type, form.enquiry_type)

        # ── Notification email to ASYM team ──────────────────────────────────
        notification = MIMEMultipart("alternative")
        notification["Subject"] = f"[ASYM Enquiry] {enquiry_label} — {form.name}"
        notification["From"] = settings.SMTP_USER
        notification["To"] = settings.CONTACT_TO_EMAIL
        notification["Reply-To"] = str(form.email)

        notification.attach(MIMEText(_build_notification_html(form), "html"))
        smtp.sendmail(settings.SMTP_USER, settings.CONTACT_TO_EMAIL, notification.as_string())
        logger.info("Notification email sent for enquiry from %s", form.email)

        # ── Auto-reply to enquirer ────────────────────────────────────────────
        autoreply = MIMEMultipart("alternative")
        autoreply["Subject"] = "Thank you for contacting ASYM Capital"
        autoreply["From"] = settings.SMTP_USER
        autoreply["To"] = str(form.email)

        autoreply.attach(MIMEText(_build_autoreply_html(form.name), "html"))
        smtp.sendmail(settings.SMTP_USER, str(form.email), autoreply.as_string())
        logger.info("Auto-reply sent to %s", form.email)


async def send_contact_emails(form: ContactForm) -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_emails_sync, form)
