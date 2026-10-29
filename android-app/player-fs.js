/* ملء الشاشة فـ المشغّل (Android): كيحتل الهاتف كامل، كيدور الشاشة أفقياً، وكيخبّي شريط الحالة.
   Element.requestFullscreen ما كيخدمش مزيان فـ WebView، لهذا كنستعملو CSS (class wa-fs) + إضافات Capacitor إلا كانو. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const plug = (n) => { const C = window.Capacitor; return C && C.Plugins && C.Plugins[n]; };
  let on = false;

  async function native(enter) {
    // 1) الإضافة الأصلية ديالنا (Immersive): أفقي + تخبية شريط الحالة وأزرار التنقل + الـ notch
    try {
      const C = window.Capacitor;
      if (C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise) { await C.nativePromise('Immersive', enter ? 'enter' : 'exit', {}); return; }
    } catch {}
    // 2) احتياط: إضافات Capacitor الرسمية
    try { const so = plug('ScreenOrientation'); if (so) { if (enter) await so.lock({ orientation: 'landscape' }); else await so.unlock(); } } catch {}
    try { const sb = plug('StatusBar'); if (sb) { if (enter) await sb.hide(); else await sb.show(); } } catch {}
  }
  function set(v) {
    const pl = $('#pl'); if (v && !pl) return;
    on = v;
    if (pl) pl.classList.toggle('wa-fs', v);
    document.body.classList.toggle('wa-fs', v);
    native(v);
  }
  // كنعترضو الضغطة قبل ما توصل لـ requestFullscreen القديمة
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#pfs'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); set(!on);
  }, true);
  // سدّ المشغّل (زر X أو الحلقة اللي بعدها) → خرج من ملء الشاشة
  new MutationObserver(() => { if (on && !$('#pl')) set(false); }).observe(document.body, { childList: true });
  // زر الرجوع ديال Android كيبعت Escape (فـ android-api.js): إلا كنا فـ ملء الشاشة نخرجو منو بلا ما نسدو المشغّل
  document.addEventListener('keydown', (e) => {
    if (on && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); set(false); }
  }, true);
})();
