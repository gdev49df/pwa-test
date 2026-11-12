#!/usr/bin/env node
/* выдача pro вручную: создаёт коды активации.
   использование:  node tools/make-code.js month 3   (три кода на месяц)
                   node tools/make-code.js year 2    (два кода на год)

   код отдаёшь человеку после оплаты, а строку с хешем вставляешь в config.js в блок codes.
   в config.js попадает только хеш, сам код в репозитории не хранится. */
'use strict';
const crypto = require('crypto');

const plan = process.argv[2] === 'year' ? 'year' : 'month';
const count = Math.max(1, Math.min(50, parseInt(process.argv[3] || '1', 10) || 1));
const days = plan === 'year' ? 366 : 31;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов: 0/O, 1/I

function random(len) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

const hashes = [];
console.log('коды для выдачи (' + (plan === 'year' ? 'год' : 'месяц') + '):');
for (let i = 0; i < count; i++) {
  const b = random(12);
  const shown = 'DDX-' + (plan === 'year' ? 'Y' : 'M') + '-' + b.slice(0, 4) + '-' + b.slice(4, 8) + '-' + b.slice(8, 12);
  const norm = shown.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hash = crypto.createHash('sha256').update(norm).digest('hex');
  console.log('  ' + shown);
  hashes.push("    '" + hash + "': " + days + ',');
}
console.log('\nстроки для config.js, в блок codes:');
console.log(hashes.join('\n'));
