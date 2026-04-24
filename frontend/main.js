/* ─────────────────────────────────────────────────────────────────────────────
   ASYM Capital — main.js
   All interactive behaviour: smooth scroll, nav highlighting, mobile menu,
   contact form, external-link hardening, CTA wiring.
───────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const NAV_HEIGHT = 80;

  /* ── 1. SMOOTH SCROLL ───────────────────────────────────────────────────── */
  function smoothScrollTo(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;
    const targetId = hash.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;
    e.preventDefault();
    smoothScrollTo(targetId);
  });

  /* ── 2. ACTIVE NAV HIGHLIGHTING (IntersectionObserver) ──────────────────── */
  const sectionIds = ['about', 'services', 'philosophy', 'tech', 'contact'];
  const navLinks   = document.querySelectorAll('.nav-links a');

  function setActiveNav(id) {
    navLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' + id) {
        a.classList.add('nav-active');
      } else {
        a.classList.remove('nav-active');
      }
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

  function closeMobileMenu() {
    if (!mobileMenu || !navToggle) return;
    mobileMenu.classList.remove('open');
    navToggle.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', function () {
      const isOpen = mobileMenu.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileMenu();
      });
    });
  }

  /* ── 4. EXTERNAL LINKS (_blank + rel) ───────────────────────────────────── */
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  /* ── 5. "START A CONVERSATION" BUTTON ──────────────────────────────────── */
  // Wire the mailto CTA to scroll to #contact and focus the name field instead
  const ctaBtn = document.querySelector('a[href="mailto:contact@asymcapital.in"].btn-primary');
  if (ctaBtn) {
    ctaBtn.removeAttribute('href');
    ctaBtn.setAttribute('href', '#contact');
    ctaBtn.addEventListener('click', function (e) {
      e.preventDefault();
      smoothScrollTo('contact');
      setTimeout(function () {
        const nameField = document.getElementById('cf-name');
        if (nameField) nameField.focus();
      }, 150);
    });
  }

  /* ── 6. CONTACT FORM ────────────────────────────────────────────────────── */
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

  function validateClient() {
    const name = (nameEl && nameEl.value.trim()) || '';
    const email = (emailEl && emailEl.value.trim()) || '';
    const msg   = (msgEl && msgEl.value.trim()) || '';

    if (name.length < 2) {
      setStatus('Please enter your name (minimum 2 characters).', 'error');
      nameEl && nameEl.focus();
      return false;
    }
    if (!isValidEmail(email)) {
      setStatus('Please enter a valid email address.', 'error');
      emailEl && emailEl.focus();
      return false;
    }
    if (msg.length < 20) {
      setStatus('Message must be at least 20 characters.', 'error');
      msgEl && msgEl.focus();
      return false;
    }
    return true;
  }

  if (form) {
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

})();
