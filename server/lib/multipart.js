'use strict';
/**
 * Analyseur multipart/form-data minimal (corps déjà borné en taille par readBody).
 */
const { HttpError } = require('./http');

const MAX_PARTS = 30;

function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || '');
  if (!m) throw new HttpError(400, 'Formulaire invalide');
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const fields = {};
  const files = {};

  let pos = buf.indexOf(boundary);
  if (pos < 0) throw new HttpError(400, 'Formulaire invalide');
  let parts = 0;

  while (true) {
    pos += boundary.length;
    if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break; // "--" : fin
    if (buf[pos] === 0x0d && buf[pos + 1] === 0x0a) pos += 2;
    if (++parts > MAX_PARTS) throw new HttpError(400, 'Formulaire invalide');

    const headerEnd = buf.indexOf('\r\n\r\n', pos);
    if (headerEnd < 0) throw new HttpError(400, 'Formulaire invalide');
    const headers = buf.subarray(pos, headerEnd).toString('utf8');
    const next = buf.indexOf(boundary, headerEnd + 4);
    if (next < 0) throw new HttpError(400, 'Formulaire invalide');
    const content = buf.subarray(headerEnd + 4, Math.max(headerEnd + 4, next - 2));

    const name = /\bname="([^"]*)"/i.exec(headers);
    const filename = /\bfilename="([^"]*)"/i.exec(headers);
    const ctype = /content-type:\s*([^\r\n]+)/i.exec(headers);
    if (name) {
      const key = name[1];
      if (filename) {
        if (filename[1] && content.length > 0 && !(key in files)) {
          files[key] = { filename: filename[1], contentType: ctype ? ctype[1].trim().toLowerCase() : '', data: content };
        }
      } else if (!(key in fields)) {
        fields[key] = content.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}

module.exports = { parseMultipart };
