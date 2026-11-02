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
let modalOpenedAt = 0;

function initAppointmentModal() {
  const modalBackdrop = document.getElementById('appointmentModal');
  const openButtons = document.querySelectorAll('[data-open-modal="appointment"]');
  const closeButtons = document.querySelectorAll('[data-close-modal]');
  const specialtySelect = document.getElementById('modalSpecialty');
  const doctorSelect = document.getElementById('modalDoctor');
  const dateInput = document.getElementById('modalDate');

  // Bloquer la sélection de dates passées dans le calendrier
  if (dateInput) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
  }

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

      modalOpenedAt = Date.now();
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
   SECURITY UTILITIES (SANITIZATION, VALIDATION, ANTI-SPAM RATE LIMITING)
   ========================================================================== */
function sanitizeInput(str, maxLen = 250) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isValidPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s.\-()]/g, '');
  // Accepte les formats algériens (05/06/07/02/03/04... ou +213 / 00213) et internationaux (8 à 15 chiffres)
  return /^(\+|00)?[0-9]{9,15}$/.test(cleaned);
}

function isFutureOrTodayDate(dateStr) {
  if (!dateStr) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return dateStr >= todayStr;
}

function checkRateLimit(actionKey, cooldownMs) {
  try {
    const storageKey = `csy2_rl_${actionKey}`;
    const lastTime = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
    const now = Date.now();
    if (now - lastTime < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - lastTime)) / 1000);
      return { allowed: false, waitSec };
    }
    sessionStorage.setItem(storageKey, String(now));
    return { allowed: true, waitSec: 0 };
  } catch (_) {
    return { allowed: true, waitSec: 0 };
  }
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

      // 1. Vérification d'événement humain authentique
      if (e.isTrusted === false) {
        console.warn('Untrusted automated submission blocked');
        return;
      }

      // 2. Honeypot anti-bot security check
      const hp = form.querySelector('input[name="clinic_hp_check"]');
      if (hp && hp.value.trim() !== '') {
        console.warn('Bot detected by honeypot');
        return;
      }

      // 3. Vérification du délai humain d'ouverture de la modale (bloque les bots instantanés < 1.2s)
      if (modalOpenedAt > 0 && (Date.now() - modalOpenedAt) < 1200) {
        showToast('Veuillez vérifier les informations saisies avant de valider.');
        return;
      }

      // 4. Nettoyage et validation stricte des champs
      const rawName = document.getElementById('modalName')?.value || '';
      const rawPhone = document.getElementById('modalPhone')?.value || '';
      const rawDate = document.getElementById('modalDate')?.value || '';

      const patientName = sanitizeInput(rawName, 80);
      const patientPhone = sanitizeInput(rawPhone, 25);

      if (patientName.length < 2) {
        showToast('Veuillez indiquer votre nom et prénom complets.');
        return;
      }

      if (!isValidPhone(patientPhone)) {
        showToast('Veuillez saisir un numéro de téléphone valide (ex: 0550 12 34 56).');
        return;
      }

      if (rawDate && !isFutureOrTodayDate(rawDate)) {
        showToast('Veuillez choisir une date de rendez-vous égale ou postérieure à aujourd\'hui.');
        return;
      }

      // 5. Anti-spam Rate Limiting (30 secondes entre deux demandes)
      const rl = checkRateLimit('booking_submit', 30000);
      if (!rl.allowed) {
        showToast(`Une demande vient d'être envoyée. Merci de patienter ${rl.waitSec}s avant une nouvelle demande.`);
        return;
      }

      const modalBackdrop = document.getElementById('appointmentModal');
      if (modalBackdrop) modalBackdrop.classList.remove('open');
      document.body.style.overflow = '';

      showToast(`Merci ${patientName}. Votre demande sécurisée de rendez-vous a bien été enregistrée. Notre secrétariat médical vous contactera sous 2 heures.`);
      form.reset();
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (e.isTrusted === false) return;

      // Honeypot anti-bot security check
      const hp = contactForm.querySelector('input[name="clinic_hp_check"]');
      if (hp && hp.value.trim() !== '') {
        console.warn('Bot detected by honeypot');
        return;
      }

      const rl = checkRateLimit('contact_submit', 30000);
      if (!rl.allowed) {
        showToast(`Veuillez patienter ${rl.waitSec}s avant d'envoyer un nouveau message.`);
        return;
      }

      showToast("Votre message a été transmis de manière sécurisée à la direction médicale de Clinique Sidi Yahia 2. Nous vous répondrons dans les plus brefs délais.");
      contactForm.reset();
    });
  }
}

/* ==========================================================================
   CONTACT & WHATSAPP PROTECTION (ANTI-SPAM, ANTI-SCRAPING & SECURE BOOKING)
   ========================================================================== */
function initContactProtection() {
  // Fragments obfusqués & chiffrés en Base64 pour déjouer les robots collecteurs
  const encP = ['MjEz', 'Nzcw', 'Nzk=', 'NDY=', 'MzA='];
  const encU = 'Y29udGFjdA=='; // contact
  const encD = 'Y2xpbmlxdWVzaWRpeWFoaWEy'; // cliniquesidiyahia2
  const encT = 'Y29t'; // com

  const decodeB64 = (s) => atob(s);

  const getDigitsOnly = () => encP.map(decodeB64).join('');
  const getPhoneRaw = () => '+' + getDigitsOnly();
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

    // Affichage visuel du texte WhatsApp SANS exposer l'URL wa.me dans le DOM (anti-scraping)
    document.querySelectorAll('[data-safe-whatsapp]').forEach(el => {
      el.setAttribute('href', '#whatsapp-secure');
      const textHolder = el.querySelector('.safe-wa-text');
      if (textHolder) textHolder.textContent = fullPhoneFormatted;
      el.classList.add('is-revealed');
    });
  };

  // Construction sécurisée du message de rendez-vous WhatsApp depuis la modale
  const buildSecureModalWhatsAppMsg = (defaultMsg) => {
    const form = document.getElementById('bookingModalForm');
    if (!form) return defaultMsg;

    const specialty = sanitizeInput(document.getElementById('modalSpecialty')?.value || '', 80);
    const doctor = sanitizeInput(document.getElementById('modalDoctor')?.value || '', 80);
    const name = sanitizeInput(document.getElementById('modalName')?.value || '', 80);
    const phone = sanitizeInput(document.getElementById('modalPhone')?.value || '', 25);
    const date = sanitizeInput(document.getElementById('modalDate')?.value || '', 20);
    const slot = sanitizeInput(document.getElementById('modalSlot')?.value || '', 40);
    const motif = sanitizeInput(document.getElementById('modalMotif')?.value || '', 160);

    const lines = ['Bonjour Clinique Sidi Yahia 2, je souhaite prendre un rendez-vous :'];
    if (specialty) lines.push(`• Pôle : ${specialty}`);
    if (doctor) lines.push(`• Praticien : ${doctor}`);
    if (date) lines.push(`• Date souhaitée : ${date}${slot ? ' (' + slot + ')' : ''}`);
    if (name) lines.push(`• Patient(e) : ${name}`);
    if (phone) lines.push(`• Tél : ${phone}`);
    if (motif) lines.push(`• Motif : ${motif}`);

    return lines.length > 1 ? lines.join('\n') : defaultMsg;
  };

  // Gestionnaire de clic WhatsApp ultra-sécurisé (aucune exposition DOM de wa.me, vérification anti-bot & anti-flood)
  document.querySelectorAll('[data-safe-whatsapp]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();

      // 1. Exiger un clic humain authentique (bloque les clics synthétiques de scripts)
      if (e.isTrusted === false) {
        console.warn('Blocked synthetic click on WhatsApp trigger');
        return;
      }

      if (!isRevealed) revealContactDetails();

      // 2. Si le bouton est dans la modale de rendez-vous, vérifier le honeypot et la validité des champs remplis
      const insideModal = el.closest('#appointmentModal');
      if (insideModal) {
        const hp = insideModal.querySelector('input[name="clinic_hp_check"]');
        if (hp && hp.value.trim() !== '') {
          console.warn('Bot detected by modal honeypot on WhatsApp click');
          return;
        }

        const rawPhone = document.getElementById('modalPhone')?.value?.trim() || '';
        if (rawPhone && !isValidPhone(rawPhone)) {
          showToast('Veuillez vérifier le format de votre numéro de téléphone avant de continuer sur WhatsApp.');
          return;
        }

        const rawDate = document.getElementById('modalDate')?.value || '';
        if (rawDate && !isFutureOrTodayDate(rawDate)) {
          showToast('Veuillez sélectionner une date égale ou postérieure à aujourd\'hui.');
          return;
        }
      }

      // 3. Limitation de débit (Rate-limit de 10 secondes contre le spam d'ouverture)
      const rl = checkRateLimit('whatsapp_open', 10000);
      if (!rl.allowed) {
        showToast(`Redirection WhatsApp déjà lancée. Veuillez patienter ${rl.waitSec}s.`);
        return;
      }

      // 4. Génération à la volée de l'URL WhatsApp uniquement en mémoire
      const rawDigits = getDigitsOnly();
      const baseMsg = sanitizeInput(
        el.getAttribute('data-msg') || 'Bonjour, je souhaite contacter la Clinique Sidi Yahia 2',
        200
      );
      const finalMsg = insideModal ? buildSecureModalWhatsAppMsg(baseMsg) : baseMsg;
      const waUrl = `https://wa.me/${rawDigits}?text=${encodeURIComponent(finalMsg)}`;

      const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (win) win.opener = null;
    });
  });

  // Déclenchement automatique au premier signal d'activité humaine réelle
  const humanTriggers = ['mousemove', 'touchstart', 'scroll', 'keydown', 'pointerdown'];
  const onHumanAction = (e) => {
    if (e && e.isTrusted === false) return;
    revealContactDetails();
    humanTriggers.forEach(ev => window.removeEventListener(ev, onHumanAction));
  };
  humanTriggers.forEach(ev => window.addEventListener(ev, onHumanAction, { passive: true, once: true }));

  // Fallback direct au clic / tap pour téléphone et email
  document.querySelectorAll('[data-safe-phone], [data-safe-email]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.isTrusted === false) {
        e.preventDefault();
        return;
      }
      if (!isRevealed) revealContactDetails();
    });
  });

  // Boutons de copie rapide sécurisée
  document.querySelectorAll('[data-copy-contact]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.isTrusted === false) return;
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
