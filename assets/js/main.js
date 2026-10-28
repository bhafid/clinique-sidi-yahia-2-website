/**
 * Clinique Sidi Yahia 2 - Main JavaScript Controller
 * Interactive Features: Calculator, Booking Modal, Filter, Accordion, Mobile Nav
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initStickyHeader();
  initAppointmentModal();
  initFaqAccordion();
  initDoctorFilters();
  initBookingFormSubmit();
  initContactProtection();
});

/* ==========================================================================
   MOBILE NAVIGATION
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    const isExpanded = navMenu.classList.contains('open');
    toggleBtn.setAttribute('aria-expanded', isExpanded);
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !toggleBtn.contains(e.target) && navMenu.classList.contains('open')) {
      navMenu.classList.remove('open');
    }
  });

  // Close on link click
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  });
}

/* ==========================================================================
   STICKY HEADER SCROLL SHADOW
   ========================================================================== */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.style.boxShadow = '0 8px 30px rgba(10, 37, 64, 0.12)';
      header.style.background = 'rgba(255, 255, 255, 0.98)';
    } else {
      header.style.boxShadow = '0 2px 20px rgba(10, 37, 64, 0.06)';
      header.style.background = 'rgba(255, 255, 255, 0.95)';
    }
  });
}

/* ==========================================================================
   APPOINTMENT MODAL & DIRECT DOCTOR BOOKING
   ========================================================================== */
function initAppointmentModal() {
  const modalBackdrop = document.getElementById('appointmentModal');
  const openButtons = document.querySelectorAll('[data-open-modal="appointment"]');
  const closeButtons = document.querySelectorAll('[data-close-modal]');
  const specialtySelect = document.getElementById('modalSpecialty');
  const doctorSelect = document.getElementById('modalDoctor');

  if (!modalBackdrop) return;

  // Open modal handler
  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const specialty = btn.getAttribute('data-specialty');
      const doctor = btn.getAttribute('data-doctor');
      const packageType = btn.getAttribute('data-package');

      if (specialty && specialtySelect) {
        specialtySelect.value = specialty;
      }
      if (doctor && doctorSelect) {
        doctorSelect.value = doctor;
      }

      if (packageType) {
        const motifInput = document.getElementById('modalMotif');
        if (motifInput) {
          motifInput.value = `Demande de réservation séjour : ${packageType}`;
        }
      }

      modalBackdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close handlers
  const closeModal = () => {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  };

  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
      closeModal();
    }
  });
}

/* ==========================================================================
   FAQ ACCORDION
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!questionBtn || !answer) return;

    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all others
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherAnswer = otherItem.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.maxHeight = null;
        }
      });

      if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      } else {
        item.classList.remove('active');
        answer.style.maxHeight = null;
      }
    });
  });

  // Open first item by default if exists
  if (faqItems[0]) {
    const firstAnswer = faqItems[0].querySelector('.faq-answer');
    faqItems[0].classList.add('active');
    if (firstAnswer) firstAnswer.style.maxHeight = firstAnswer.scrollHeight + 'px';
  }
}

/* ==========================================================================
   DOCTOR DIRECTORY FILTER
   ========================================================================== */
function initDoctorFilters() {
  const filterBtns = document.querySelectorAll('.doctor-filter-btn');
  const doctorCards = document.querySelectorAll('.team-card[data-category]');

  if (!filterBtns.length || !doctorCards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-filter');

      filterBtns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');

      doctorCards.forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   FORM SUBMISSION & TOAST NOTIFICATION
   ========================================================================== */
function initBookingFormSubmit() {
  const form = document.getElementById('bookingModalForm');
  const contactForm = document.getElementById('contactPageForm');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Honeypot anti-bot security check
      const hp = form.querySelector('input[name="clinic_hp_check"]');
      if (hp && hp.value.trim() !== '') {
        console.warn('Bot detected by honeypot');
        return;
      }

      const patientName = document.getElementById('modalName')?.value || 'Cher(e) Patient(e)';
      const modalBackdrop = document.getElementById('appointmentModal');
      if (modalBackdrop) modalBackdrop.classList.remove('open');
      document.body.style.overflow = '';

      showToast(`Merci ${patientName}. Votre demande de rendez-vous a bien été enregistrée. Notre secrétariat médical vous contactera sous 2 heures.`);
      form.reset();
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Honeypot anti-bot security check
      const hp = contactForm.querySelector('input[name="clinic_hp_check"]');
      if (hp && hp.value.trim() !== '') {
        console.warn('Bot detected by honeypot');
        return;
      }

      showToast("Votre message a été transmis à la direction médicale de Clinique Sidi Yahia 2. Nous vous répondrons dans les plus brefs délais.");
      contactForm.reset();
    });
  }
}

/* ==========================================================================
   CONTACT PROTECTION (ANTI-SPAM & ANTI-BOT HARVESTING)
   ========================================================================== */
function initContactProtection() {
  // Fragments obfusqués & chiffrés en Base64 pour déjouer les robots collecteurs
  const encP = ['MjEz', 'Nzcw', 'Nzk=', 'NDY=', 'MzA='];
  const encU = 'Y29udGFjdA=='; // contact
  const encD = 'Y2xpbmlxdWVzaWRpeWFoaWEy'; // cliniquesidiyahia2
  const encT = 'Y29t'; // com

  const decodeB64 = (s) => atob(s);

  const getPhoneRaw = () => '+' + encP.map(decodeB64).join('');
  const getPhoneFormatted = () => {
    const p = encP.map(decodeB64);
    return `+${p[0]} ${p[1]} ${p[2]} ${p[3]} ${p[4]}`;
  };
  const getEmail = () => `${decodeB64(encU)}@${decodeB64(encD)}.${decodeB64(encT)}`;

  let isRevealed = false;

  const revealContactDetails = () => {
    if (isRevealed) return;
    isRevealed = true;

    const fullPhoneFormatted = getPhoneFormatted();
    const fullPhoneRaw = getPhoneRaw();
    const fullEmail = getEmail();

    // Rendu dynamique du numéro sécurisé
    document.querySelectorAll('[data-safe-phone]').forEach(el => {
      if (el.tagName === 'A') {
        el.setAttribute('href', `tel:${fullPhoneRaw}`);
      }
      const prefix = el.getAttribute('data-phone-prefix');
      const label = prefix ? `${prefix} : ${fullPhoneFormatted}` : fullPhoneFormatted;
      const textHolder = el.querySelector('.safe-phone-text') || el;
      textHolder.textContent = label;
      el.classList.add('is-revealed');
    });

    // Rendu dynamique de l'adresse email sécurisée
    document.querySelectorAll('[data-safe-email]').forEach(el => {
      if (el.tagName === 'A') {
        el.setAttribute('href', `mailto:${fullEmail}`);
      }
      const textHolder = el.querySelector('.safe-email-text') || el;
      textHolder.textContent = fullEmail;
      el.classList.add('is-revealed');
    });

    // Rendu dynamique des liens WhatsApp
    document.querySelectorAll('[data-safe-whatsapp]').forEach(el => {
      const rawDigits = encP.map(decodeB64).join('');
      const rawMsg = el.getAttribute('data-msg') || 'Bonjour, je souhaite contacter la Clinique Sidi Yahia 2';
      el.setAttribute('href', `https://wa.me/${rawDigits}?text=${encodeURIComponent(rawMsg)}`);
      const textHolder = el.querySelector('.safe-wa-text');
      if (textHolder) textHolder.textContent = fullPhoneFormatted;
      el.classList.add('is-revealed');
    });
  };

  // Déclenchement automatique au premier signal d'activité humaine réelle
  const humanTriggers = ['mousemove', 'touchstart', 'scroll', 'keydown', 'pointerdown'];
  const onHumanAction = () => {
    revealContactDetails();
    humanTriggers.forEach(ev => window.removeEventListener(ev, onHumanAction));
  };
  humanTriggers.forEach(ev => window.addEventListener(ev, onHumanAction, { passive: true, once: true }));

  // Fallback direct au clic / tap si aucune interaction préalable
  document.querySelectorAll('[data-safe-phone], [data-safe-email], [data-safe-whatsapp]').forEach(el => {
    el.addEventListener('click', () => {
      if (!isRevealed) revealContactDetails();
    });
  });

  // Boutons de copie rapide sécurisée
  document.querySelectorAll('[data-copy-contact]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      revealContactDetails();
      const type = btn.getAttribute('data-copy-contact');
      const val = type === 'email' ? getEmail() : getPhoneFormatted();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => {
          showToast(`${type === 'email' ? 'Adresse e-mail copiée' : 'Numéro de téléphone copié'} dans le presse-papier !`);
        }).catch(() => {
          showToast(`Coordonnée : ${val}`);
        });
      } else {
        showToast(`Coordonnée : ${val}`);
      }
    });
  });
}

function showToast(message) {
  let toast = document.querySelector('.toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}
