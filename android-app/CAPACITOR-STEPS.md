# WayAnime — Capacitor (Android Studio)

مجلد `www` مولَّد جاهز (من make-www.js). للبناء المحلي:

    cd android-app
    npm install
    npx cap add android
    npx cap sync android
    # انسخ الملفين native/ImmersivePlugin.java و native/MainActivity.java
    # إلى android/app/src/main/java/com/wayanime/app/
    npx cap open android      # Android Studio ← Build ← Build APK(s)

إذا عدّلت renderer.js أو main.js ارجع شغّل من الجذر:  node android-app/make-www.js  ثم  npx cap sync android
(الأيقونة والتعديلات الإضافية موجودة في .github/workflows/android.yml)
