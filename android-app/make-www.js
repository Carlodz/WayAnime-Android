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
['renderer.js', 'ui.css', 'cinema.css', 'fonts'].forEach((f) => cp(f));
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
['icon.png', 'logo.png', 'itachi.mp4', 'logos', 'cards'].forEach((f) => { try { cp('assets/' + f, 'assets/' + f); } catch {} });
fs.copyFileSync(path.join(__dirname, 'mobile.css'), path.join(OUT, 'mobile.css'));
fs.copyFileSync(path.join(__dirname, 'drawer.js'), path.join(OUT, 'drawer.js'));
fs.copyFileSync(path.join(__dirname, 'player-fs.js'), path.join(OUT, 'player-fs.js'));
fs.copyFileSync(path.join(__dirname, 'diag.js'), path.join(OUT, 'diag.js'));

let html = rd('index.html');
if (!/name="viewport"/.test(html)) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
html = html.replace('</head>', '<link rel="stylesheet" href="mobile.css">\n</head>');
html = html.replace('<script src="renderer.js"></script>', '<script src="android-api.js"></script>\n<script src="renderer.js"></script>\n<script src="drawer.js"></script>\n<script src="player-fs.js"></script>\n<script src="diag.js"></script>');
if (!html.includes('android-api.js')) throw new Error('index.html: ما لقيتش مكان renderer.js');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

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

// fetch عبر HTTP الأصلي ديال Android (بلا CORS، وكيقبل Referer/Cookie/User-Agent)
const __call = (p, m, o) => { const C = window.Capacitor; return C && C.Plugins && C.Plugins[p] && C.Plugins[p][m] ? C.Plugins[p][m](o) : C.nativePromise(p, m, o); };
async function fetch(url, o = {}) {
  if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return window.fetch(url, { ...o, signal: undefined });
  const headers = { ...(o.headers || {}) };
  if (!Object.keys(headers).some((k) => k.toLowerCase() === 'user-agent')) headers['User-Agent'] = UA_ANDROID;
  let data = o.body;
  // URLSearchParams كيتحوّل لـ {} فـ الجسر ديال Capacitor + بلا Content-Type ما كيتصيفطش الجسم أصلاً (هادا كان سبب الكتالوج الفارغ)
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) data = data.toString();
  let ck = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
  if (typeof data === 'string' && !ck) { headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'; ck = 'Content-Type'; }
  if (data && ck && /json/i.test(headers[ck])) { try { data = JSON.parse(data); } catch {} }
  else if (typeof data === 'string' && ck && /x-www-form-urlencoded/i.test(headers[ck])) data = Object.fromEntries(new URLSearchParams(data));
  const r = await __call('CapacitorHttp', 'request', { url: String(url), method: String(o.method || 'GET').toUpperCase(), headers, data, responseType: 'text', connectTimeout: 20000, readTimeout: 30000 });
  const raw = {}; Object.keys(r.headers || {}).forEach((k) => { raw[k.toLowerCase()] = r.headers[k]; });
  const txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data == null ? '' : r.data);
  const sc = raw['set-cookie'];
  return {
    ok: r.status >= 200 && r.status < 300, status: r.status, url: r.url || String(url), body: null,
    headers: { get: (k) => (raw[String(k).toLowerCase()] == null ? null : String(raw[String(k).toLowerCase()])), getSetCookie: () => (sc ? (Array.isArray(sc) ? sc : String(sc).split(/,(?=\\s*[\\w-]+=)/)) : []) },
    text: async () => txt, json: async () => JSON.parse(txt)
  };
}

const __H = {};
const ipcMain = { handle: (n, f) => { __H[n] = f; } };
const __bus = {};
const sidGet = () => { try { return localStorage.getItem('wayanime-sid') || ''; } catch { return ''; } };
const sidSet = (v) => { try { v ? localStorage.setItem('wayanime-sid', v) : localStorage.removeItem('wayanime-sid'); } catch {} };
const readSid = sidGet, saveSid = sidSet;
`;

const footer = `
const __NOOP = { 'bg:set': true, 'notify:show': false, 'update:state': null, 'update:install': null, 'win:min': true, 'win:max': false, 'win:close': true, 'custom:list': [], 'custom:open': null, 'media:stop': true };
async function __invoke(n, ...a) {
  if (n === 'open:external') { window.open(String(a[0]), '_system'); return true; }
  if (n === 'logos:list') return LOGOS;
  if (n in __H) return __H[n]({}, ...a);
  if (n in __NOOP) return __NOOP[n];
  if (n === 'torrent:start') throw new Error('التورنت غير مدعوم فـ نسخة Android');
  if (n.indexOf('media:') === 0 || n === 'transcode:start') throw new Error('هاد الصيغة ما كتتشغلش فـ Android. جرّب سيرفر آخر.');
  throw new Error('هاد الميزة غير متوفرة فـ نسخة Android');
}
// نفس واجهة preload.js ديال الويندوز
(function () {
  const require = () => ({
    contextBridge: { exposeInMainWorld: (k, v) => { window[k] = v; } },
    ipcRenderer: { invoke: (n, ...a) => __invoke(n, ...a), on: (ch, cb) => { (__bus[ch] = __bus[ch] || []).push(cb); } },
    webUtils: { getPathForFile: () => '' }
  });
${rd('preload.js')}
})();
// زر الرجوع ديال Android
document.addEventListener('DOMContentLoaded', () => {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App) return;
  App.addListener('backButton', () => {
    if (document.body.classList.contains('dr-open') || document.body.classList.contains('cb-open')) return document.dispatchEvent(new CustomEvent('wa-close-drawer'));
    if (document.querySelector('#pl')) return document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const b = document.querySelector('#wBack');
    if (b && !b.disabled) b.click(); else if (App.minimizeApp) App.minimizeApp();
  });
});
window.__wayHandlers = __H; window.__waFetch = fetch;   // للاختبار
})();
`;

let out = header + '\n' + blkAddon + '\n' + blkAcct + '\n' + blkB + '\n' + blkC + footer;
const bad = out.match(/require\((?!\))|process\.|__dirname|Buffer\.|ipcRenderer\.send|shell\.|app\.getPath|safeStorage/g);
// preload.js كيستعمل require('electron') داخل الـ wrapper — هادا مقبول
const left = (out.match(/\brequire\([^)]*\)/g) || []).filter((x) => x !== "require('electron')");
if (left.length) throw new Error('بقاو require فـ الكود المولّد: ' + left.join(', '));
fs.writeFileSync(path.join(OUT, 'android-api.js'), out);
console.log('OK → ' + OUT + ' (' + Math.round(out.length / 1024) + ' KB)', bad ? '[تنبيه: ' + [...new Set(bad)].join(',') + ']' : '');
