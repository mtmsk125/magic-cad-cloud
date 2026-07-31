/**
 * PWA Install Prompt — تثبيت التطبيق على الجوال
 * 
 * يظهر تلقائياً للمستخدمين الذين لم يثبتوا التطبيق بعد
 * مع خيار "تثبيت" و "تذكيرني لاحقاً"
 */
"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt({ lang }: { lang: "ar" | "en" }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show instructions after 30 seconds
    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 30000);
    }

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <>
      {/* Install Banner */}
      <div suppressHydrationWarning={true} className="fixed bottom-4 start-4 end-4 z-50 max-w-md mx-auto">
        <div className="bg-card border border-accent/40 rounded-2xl p-5 shadow-[var(--shadow-spark)] backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl flex-shrink-0">
              📱
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-display font-bold text-sm">
                {lang === "ar" ? "ثبّت DXFix على جهازك" : "Install DXFix on your device"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar"
                  ? "استخدم الأداة مباشرة من شاشتك الرئيسية — بدون متصفح"
                  : "Use the tool directly from your home screen — no browser needed"}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-semibold text-xs hover:opacity-90 transition"
                >
                  {lang === "ar" ? "📲 تثبيت" : "📲 Install"}
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-semibold text-xs hover:text-foreground transition"
                >
                  {lang === "ar" ? "لاحقاً" : "Later"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowPrompt(false)}
              className="text-muted-foreground hover:text-foreground transition text-lg leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-accent/40 rounded-2xl p-8 max-w-sm w-full shadow-[var(--shadow-spark)] text-center">
            <div className="text-5xl mb-4">🍎</div>
            <h3 className="font-display text-xl font-bold mb-3">
              {lang === "ar" ? "تثبيت على iPhone/iPad" : "Install on iPhone/iPad"}
            </h3>
            <div className="text-start space-y-3 text-sm text-muted-foreground">
              <p>1. {lang === "ar" ? "اضغط على زر المشاركة" : "Tap the Share button"} <span className="text-foreground">📤</span></p>
              <p>2. {lang === "ar" ? "اختر" : "Select"} <span className="text-foreground font-semibold">"{lang === "ar" ? "إضافة إلى الشاشة الرئيسية" : "Add to Home Screen"}"</span></p>
              <p>3. {lang === "ar" ? "اضغط" : "Tap"} <span className="text-foreground font-semibold">"{lang === "ar" ? "إضافة" : "Add"}"</span></p>
            </div>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition"
            >
              {lang === "ar" ? "تم ✓" : "Got it ✓"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}