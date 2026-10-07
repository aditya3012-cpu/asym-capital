/* ─────────────────────────────────────────────────────────────────────────────
   ASYM Capital — main.js
   Mobile menu, "Enquire" links, footer year and the contact form.
   The page is complete without JS; only the contact form depends on it.
───────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── 1. MOBILE MENU (a <details> element, so it also opens without JS) ─── */
  const menu = document.querySelector('.menu');
  const behindMenu = [document.getElementById('main'), document.querySelector('.site-footer')];

  if (menu) {
    menu.addEventListener('toggle', function () {
      document.body.classList.toggle('menu-open', menu.open);
      // Keep keyboard and screen-reader focus out of the page behind the panel.
      behindMenu.forEach(function (el) { if (el) el.inert = menu.open; });
    });

    // Any in-page link (menu items or the logo) closes the menu.
    document.addEventListener('click', function (e) {
      if (menu.open && e.target.closest('a[href^="#"]')) menu.open = false;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });

    // The menu is only used below 1200px; close it if the window grows past that.
    const desktop = window.matchMedia('(min-width: 1200px)');
    const onDesktop = function (e) { if (e.matches) menu.open = false; };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else desktop.addListener(onDesktop); // Safari < 14
  }

  /* ── 2. "ENQUIRE" LINKS PRESELECT THE ENQUIRY TYPE ──────────────────────── */
  const enquiry = document.getElementById('cf-enquiry');
  document.querySelectorAll('[data-enquiry]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (enquiry) enquiry.value = a.dataset.enquiry;
    });
  });

  /* ── 3. FOOTER YEAR ─────────────────────────────────────────────────────── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── 4. CONTACT FORM (JSON POST to /api/contact) ────────────────────────── */
  const form    = document.getElementById('contact-form');
  const submit  = document.getElementById('cf-submit');
  const label   = document.getElementById('cf-label');
  const status  = document.getElementById('cf-status');
  const nameEl  = document.getElementById('cf-name');
  const emailEl = document.getElementById('cf-email');
  const company = document.getElementById('cf-company');
  const msgEl   = document.getElementById('cf-message');

  function setStatus(msg, type) {
    status.textContent = msg;
    status.className   = 'status' + (type ? ' ' + type : '');
  }

  function invalid(el, msg) {
    setStatus(msg, 'error');
    el.setAttribute('aria-invalid', 'true');
    el.focus();
    return false;
  }

  function validateClient() {
    if (nameEl.value.trim().length < 2) return invalid(nameEl, 'Please enter your name (minimum 2 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) return invalid(emailEl, 'Please enter a valid email address.');
    if (msgEl.value.trim().length < 20) return invalid(msgEl, 'Message must be at least 20 characters.');
    return true;
  }

  if (form) {
    form.addEventListener('input', function (e) {
      e.target.removeAttribute('aria-invalid');
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setStatus('', '');
      if (!validateClient()) return;

      const payload = {
        name:         nameEl.value.trim(),
        email:        emailEl.value.trim(),
        company:      company.value.trim() || undefined,
        enquiry_type: (enquiry && enquiry.value) || 'general',
        message:      msgEl.value.trim(),
      };

      submit.disabled   = true;
      label.textContent = 'Sending…';

      try {
        const res  = await fetch('/api/contact', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        const data = await res.json().catch(function () { return {}; });

        if (res.ok) {
          setStatus("Message sent. We'll be in touch within 24 hours.", 'success');
          form.reset();
        } else {
          const msg = (data && (data.detail || data.message)) || 'Something went wrong. Please try again.';
          setStatus(typeof msg === 'string' ? msg : 'Something went wrong. Please try again.', 'error');
        }
      } catch (err) {
        setStatus('Network error. Please check your connection and try again.', 'error');
      } finally {
        submit.disabled   = false;
        label.textContent = 'Send message';
      }
    });
  }

  // Tells the <head> fallback that the script ran, so the form stays visible.
  window.asymReady = true;

})();
