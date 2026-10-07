/* ─────────────────────────────────────────────────────────────────────────────
   ASYM Capital — main.js
   Interactive behaviour: scroll reveal, nav highlighting, mobile menu,
   footer year and the contact form. Smooth scrolling is handled in CSS.
───────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. SCROLL REVEAL (first, so nothing below can leave content hidden) ── */
  const reveals = document.querySelectorAll('.reveal');

  if (reduceMotion) {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  } else {
    // threshold 0 + bottom margin: elements taller than the viewport still reveal.
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });

    // The hero is on screen at load, so reveal it straight away.
    setTimeout(function () {
      document.querySelectorAll('.hero .reveal').forEach(function (el) {
        el.classList.add('visible');
      });
    }, 100);
  }

  /* ── 2. ACTIVE NAV HIGHLIGHTING (IntersectionObserver) ──────────────────── */
  const sectionIds = ['about', 'services', 'philosophy', 'tech', 'contact'];
  const navLinks   = document.querySelectorAll('.nav-links a');

  function setActiveNav(id) {
    navLinks.forEach(function (a) {
      a.classList.toggle('nav-active', a.getAttribute('href') === '#' + id);
    });
  }

  const sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setActiveNav(entry.target.id);
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );

  sectionIds.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  /* ── 3. MOBILE NAV TOGGLE ───────────────────────────────────────────────── */
  const navToggle  = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const behindMenu = [document.getElementById('main'), document.querySelector('footer')];

  function setMenuOpen(open) {
    mobileMenu.classList.toggle('open', open);
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    // Keep keyboard and screen-reader focus out of the page hidden behind the overlay.
    behindMenu.forEach(function (el) { if (el) el.inert = open; });
  }

  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      setMenuOpen(!mobileMenu.classList.contains('open'));
    });

    // Any in-page link (menu items, logo, "Get in Touch") closes the menu.
    document.addEventListener('click', function (e) {
      if (mobileMenu.classList.contains('open') && e.target.closest('a[href^="#"]')) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        setMenuOpen(false);
        navToggle.focus();
      }
    });

    // Close the overlay if the viewport grows past the mobile breakpoint.
    const desktop = window.matchMedia('(min-width: 901px)');
    const onDesktop = function (e) { if (e.matches) setMenuOpen(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else desktop.addListener(onDesktop); // Safari < 14
  }

  /* ── 4. FOOTER YEAR ─────────────────────────────────────────────────────── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── 5. CONTACT FORM ────────────────────────────────────────────────────── */
  const form     = document.getElementById('contact-form');
  const submit   = document.getElementById('cf-submit');
  const status   = document.getElementById('cf-status');
  const nameEl   = document.getElementById('cf-name');
  const emailEl  = document.getElementById('cf-email');
  const msgEl    = document.getElementById('cf-message');
  const enquiry  = document.getElementById('cf-enquiry');
  const company  = document.getElementById('cf-company');

  function setStatus(msg, type) {
    if (!status) return;
    status.textContent = msg;
    status.className   = type; // 'success' | 'error' | ''
  }

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function invalid(el, msg) {
    setStatus(msg, 'error');
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      el.focus();
    }
    return false;
  }

  function validateClient() {
    const name  = (nameEl && nameEl.value.trim()) || '';
    const email = (emailEl && emailEl.value.trim()) || '';
    const msg   = (msgEl && msgEl.value.trim()) || '';

    if (name.length < 2) return invalid(nameEl, 'Please enter your name (minimum 2 characters).');
    if (!isValidEmail(email)) return invalid(emailEl, 'Please enter a valid email address.');
    if (msg.length < 20) return invalid(msgEl, 'Message must be at least 20 characters.');
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
        company:      company && company.value.trim() ? company.value.trim() : undefined,
        enquiry_type: (enquiry && enquiry.value) || 'general',
        message:      msgEl.value.trim(),
      };

      submit.textContent = 'Sending…';
      submit.disabled    = true;

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
          setStatus(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
        }
      } catch (err) {
        setStatus('Network error. Please check your connection and try again.', 'error');
      } finally {
        submit.textContent = 'Send Message →';
        submit.disabled    = false;
      }
    });
  }

  // Tells the <head> fallback that everything above ran, so the page can keep
  // its .js class (and the form stays visible).
  window.asymReady = true;

})();
