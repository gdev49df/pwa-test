/* генератор кодов активации pro.
   node tools/make-code.js M 50     50 месячных кодов (31 день)
   node tools/make-code.js Y 20     20 годовых кодов (366 дней)
   node tools/make-code.js env      печатает строку для переменной PRO_CODES воркера (хеш:дни через запятую)
   коды печатаются один раз и нигде не сохраняются, в config.js попадают только хеши. раздавай коды покупателям, а саму выдачу не коммить. */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const CONFIG = path.join(__dirname, '..', 'planner', 'config.js');
const DAYS = { M: 31, Y: 366 };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без путающихся символов: 0 O 1 I

const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const part = () => Array.from(crypto.randomBytes(4), (b) => ALPHA[b % ALPHA.length]).join('');
const makeCode = (type) => ['DDX', type, part(), part(), part()].join('-');

let cfg = fs.readFileSync(CONFIG, 'utf8');
const existing = () => {
  const m = /codes:\s*\{([\s\S]*?)\n  \}/.exec(cfg);
  const out = {};
  (m ? m[1] : '').replace(/'([0-9a-f]{64})':\s*(\d+)/g, (x, h, d) => { out[h] = Number(d); return x; });
  return out;
};

const [a, b] = process.argv.slice(2);
if (a === 'env') {
  console.log(Object.entries(existing()).map(([h, d]) => h + ':' + d).join(','));
  process.exit(0);
}
const type = String(a || '').toUpperCase();
const n = Math.max(1, Math.min(500, parseInt(b, 10) || 1));
if (!DAYS[type]) { console.error('использование: node tools/make-code.js M|Y количество  или  node tools/make-code.js env'); process.exit(1); }

const have = existing(), codes = [], lines = [];
while (codes.length < n) {
  const c = makeCode(type), h = sha(norm(c));
  if (have[h]) continue;
  have[h] = DAYS[type]; codes.push(c); lines.push("    '" + h + "': " + DAYS[type]);
}
cfg = cfg.replace(/(codes:\s*\{[\s\S]*?)(\n  \})/, (m, body, end) => body.replace(/\s*$/, '') + ',\n' + lines.join(',\n') + end);
fs.writeFileSync(CONFIG, cfg);
console.log(codes.join('\n'));
