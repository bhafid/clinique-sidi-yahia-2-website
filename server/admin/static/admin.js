/* Administration - Clinique Sidi Yahia 2 (aucun script en ligne : CSP stricte) */
(function () {
  'use strict';
  var MAX_BYTES = 2 * 1024 * 1024;
  var ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

  document.addEventListener('DOMContentLoaded', function () {
    // Cadrage des photos (miniatures + aperçu)
    document.querySelectorAll('img[data-pos]').forEach(function (img) {
      img.style.objectPosition = img.getAttribute('data-pos');
    });

    // Confirmation avant suppression
    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
      });
    });

    // Prévisualisation + vérification de la photo avant envoi
    var input = document.getElementById('photo');
    var preview = document.getElementById('photoPreview');
    var error = document.getElementById('photoError');
    var position = document.getElementById('photo_position');
    var objectUrl = null;

    if (input && preview) {
      input.addEventListener('change', function () {
        error.textContent = '';
        var file = input.files && input.files[0];
        if (!file) return;
        if (ALLOWED.indexOf(file.type) === -1) {
          error.textContent = 'Format non autorisé : JPG, PNG ou WebP uniquement.';
          input.value = '';
          return;
        }
        if (file.size > MAX_BYTES) {
          error.textContent = 'Fichier trop volumineux (' + (file.size / 1048576).toFixed(1) + ' Mo) : 2 Mo maximum.';
          input.value = '';
          return;
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        preview.src = objectUrl;
      });
    }
    if (position && preview) {
      position.addEventListener('change', function () {
        preview.style.objectPosition = position.value;
      });
    }
  });
})();
