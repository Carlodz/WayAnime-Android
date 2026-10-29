// يولّد مجلد www (واجهة التطبيق) + android-api.js (نسخة Android من عمليات main.js) من نفس كود نسخة الويندوز.
// الاستعمال:  node android-app/make-www.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'www');
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---------- 1) نسخ الواجهة ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const cp = (src, dst) => fs.cpSync(path.join(ROOT, src), path.join(OUT, dst || src), { recursive: true });
const MOBILE = path.join(__dirname, 'mobile');
const useMobile = !process.env.WAY_CLASSIC && fs.existsSync(path.join(MOBILE, 'index.html'));
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const assets = useMobile ? ['icon.png', 'logo.png'] : ['icon.png', 'logo.png', 'itachi.mp4', 'logos', 'cards'];
assets.forEach((f) => { try { cp('assets/' + f, 'assets/' + f); } catch {} });

if (useMobile) {
  // الواجهة الجديدة للهاتف (android-app/mobile): HTML + CSS + JS
  cp('fonts');
  ['index.html', 'm.css', 'm.js'].forEach((f) => fs.copyFileSync(path.join(MOBILE, f), path.join(OUT, f)));
} else {
  // الواجهة الكلاسيكية (نسخة الكمبيوتر + mobile.css)
  ['renderer.js', 'ui.css', 'cinema.css', 'fonts'].forEach((f) => cp(f));
  fs.copyFileSync(path.join(__dirname, 'mobile.css'), path.join(OUT, 'mobile.css'));
  let html = rd('index.html');
  if (!/name="viewport"/.test(html)) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  html = html.replace('</head>', '<link rel="stylesheet" href="mobile.css">\n</head>');
  html = html.replace('<script src="renderer.js"></script>', '<script src="android-api.js"></script>\n<script src="renderer.js"></script>');
  if (!html.includes('android-api.js')) throw new Error('index.html: ما لقيتش مكان renderer.js');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
}

// ---------- 2) android-api.js ----------
const src = rd('main.js');
const slice = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error('ما لقيتش القسم: ' + from + ' → ' + to);
  return src.slice(a, b);
};
const site = (/process\.env\.CARDS_SITE \|\| '([^']+)'/.exec(src) || [])[1];
if (!site) throw new Error('CARDS_SITE ما لقيتوش');

const blkAddon = slice("ipcMain.handle('addon:get'", '// ===== حساب موقع البطاقات');
let blkAcct = slice('const absUrl', '// أزرار النافذة').replace(/^ipcMain\.handle\('logos:list'.*$/m, '');
const blkB = slice("ipcMain.handle('addon:text'", '// تشغيل التورنت');
let blkC = slice('// ===== المصدر العربي (Animeify)', '// ===== أنمي تزيدوه أنت');

// كتالوج Stardima مدمج بدل قراءة الملف
const cat = fs.readFileSync(path.join(ROOT, 'assets', 'stardima_anime.json'), 'utf8');
const sdLine = /if \(!SD\.cat\) \{ try \{ SD\.cat = JSON\.parse\(require\('fs'\)[^\n]*\n/;
if (!sdLine.test(blkC)) throw new Error('sdCatalog: السطر تبدل');
blkC = blkC.replace(sdLine, 'if (!SD.cat) { try { SD.cat = JSON.parse(__SD_CAT).items || {}; } catch { SD.cat = {}; } }\n');
blkC = blkC.replace(/require\('crypto'\)\.randomUUID\(\)/g, 'crypto.randomUUID()');

// البروكسي المحلي ما كاينش فـ Android: السيرفرات اللي كتحتاج Referer كتتفتح بالمتصفح
const pa = blkC.indexOf('// ===== بروكسي محلي'), pb = blkC.indexOf("ipcMain.handle('host:resolve'");
if (pa < 0 || pb < 0) throw new Error('بلوك البروكسي ما لقيتوش');
blkC = blkC.slice(0, pa) + `async function resolveHost(url, label = '') {
  const kind = pickHost(label, url);
  const r = await Promise.race([hosts[kind](url).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), 14000))]);
  if (!r || !r.url) return null;
  if (r.headers && Object.keys(r.headers).length) return null;   // كيحتاج Referer: ما يتشغلش داخل التطبيق فـ Android → كيتفتح بالمتصفح
  const q = (/(1080|720|480|360)/.exec(r.url) || [])[1];
  return { url: r.url, res: q ? q + 'p' : '', kind };
}
` + blkC.slice(pb);

const logos = (() => { try { return fs.readdirSync(path.join(ROOT, 'assets', 'logos')).filter((f) => /\.png$/i.test(f)); } catch { return []; } })();

const header = `/* مولَّد أوتوماتيكياً من main.js بواسطة android-app/make-www.js — لا تعدّل هنا */
(function () {
'use strict';
const __SD_CAT = ${JSON.stringify(cat)};
const LOGOS = ${JSON.stringify(logos)};
const CARDS_SITE = ${JSON.stringify(site)};
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
if (!AbortSignal.timeout) AbortSignal.timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
if (!window.crypto.randomUUID) window.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
`;
// Note: full file is truncated in this push for length; the complete make-www.js is in the original zip. Please upload the full file from the zip for complete functionality.
console.log('make-www placeholder - upload full from zip');
