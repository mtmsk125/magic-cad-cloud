  /**
 * AdBanner — Smart Multi-Network Advertisement Component
 *
 * - Reads `isPremium` from `usePremiumStatus` hook.
 * - If `isPremium === true` → renders nothing.
 * - If `isPremium === false` → picks the highest-paying ad network
 *   and renders it with automatic waterfall fallback.
 * - If a network fails to load, it automatically tries the next
 *   highest-eCPM network in the waterfall.
 * - Networks with empty/unconfigured .env values are skipped entirely.
 *
 * Props:
 * - format: "horizontal" | "rectangle" | "vertical"
 * - className: additional CSS classes
 * - lang: "ar" | "en" for localised text
 * - network: specific network to use (optional, auto-selects best if omitted)
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePremiumStatus } from "@/lib/subscription-status";
import {
  getAdHtml,
  getBestAdNetwork,
  getAdWaterfall,
  getNextWaterfallNetwork,
  type AdNetwork,
} from "@/lib/ad-networks";
import type { Lang } from "@/lib/i18n";
import { track } from '@vercel/analytics';

export interface AdBannerProps {
  format?: "horizontal" | "rectangle" | "vertical";
  className?: string;
  lang?: Lang;
  network?: AdNetwork;
}

export function AdBanner({
  format = "horizontal",
  className = "",
  lang = "ar",
  network,
}: AdBannerProps) {
  const { isPremium, isLoading } = usePremiumStatus();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentNetwork, setCurrentNetwork] = useState<AdNetwork | null>(null);
  const [adError, setAdError] = useState(false);
  const [waterfallIndex, setWaterfallIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const pushed = useRef(false);
  const waterfall = useRef<AdNetwork[]>([]);

  // ✅ Guard: Wait until component is fully mounted on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Build the waterfall list once on mount (only after isMounted)
  useEffect(() => {
    if (!isMounted || isLoading || isPremium) return;
    // If a specific network is requested, use only that one
    if (network) {
      waterfall.current = [network];
    } else {
      waterfall.current = getAdWaterfall();
    }
    // Start with the first (highest eCPM) network
    setWaterfallIndex(0);
    if (waterfall.current.length > 0) {
      setCurrentNetwork(waterfall.current[0]);
    } else {
      // No networks configured at all — show fallback
      setCurrentNetwork(null);
    }
  }, [isMounted, isLoading, isPremium, network]);

  // When waterfallIndex changes, update the current network
  useEffect(() => {
    if (!isMounted) return;
    if (waterfall.current.length === 0) {
      setCurrentNetwork(null);
    } else if (waterfallIndex < waterfall.current.length) {
      setCurrentNetwork(waterfall.current[waterfallIndex]);
      setAdError(false);
      pushed.current = false;
    } else {
      // Exhausted all networks — show fallback
      setCurrentNetwork(null);
    }
  }, [isMounted, waterfallIndex]);

  // Advance to the next network in the waterfall
  const advanceWaterfall = useCallback(() => {
    setWaterfallIndex(prev => prev + 1);
  }, []);

  // Push ad to network's queue after render (only after isMounted)
  useEffect(() => {
    if (!isMounted || isLoading || isPremium || !currentNetwork || adError) return;
    if (pushed.current) return;

    // For AdSense, inject the official loader script once (client id from env or default)
    if (currentNetwork === 'adsense') {
      const clientId =
        import.meta.env.VITE_ADSENSE_CLIENT_ID ||
        import.meta.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
        'ca-pub-8107638298388341';
      if (!(window as any).__adsenseLoaderLoaded) {
        try {
          const s = document.createElement('script');
          s.async = true;
          s.crossOrigin = 'anonymous';
          s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
          document.head.appendChild(s);
          (window as any).__adsenseLoaderLoaded = true;
        } catch (e) {
          console.warn('AdSense loader injection failed:', e);
        }
      }
    }

    const timer = setTimeout(() => {
      try {
        // For AdSense, push to the global queue
        if (currentNetwork === 'adsense') {
          const adsbygoogle = (window as any).adsbygoogle;
          if (adsbygoogle && Array.isArray(adsbygoogle)) {
            adsbygoogle.push({});
            pushed.current = true;
          }
        }
        // For other networks, they auto-initialize via script tags
        pushed.current = true;

        // Track ad impression
        const isLocalhost = window.location.hostname === "localhost";
        const isAdmin = window.location.search.includes("admin=true");
        if (!isLocalhost && !isAdmin) {
          track('Ad Impression', { 
            network: currentNetwork,
            format,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn(`Ad push failed for ${currentNetwork}:`, e);
        setAdError(true);
        // Automatically try the next network in the waterfall
        advanceWaterfall();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isMounted, isLoading, isPremium, currentNetwork, adError, format, advanceWaterfall]);

  // If still loading or premium, render nothing
  if (isLoading || isPremium) {
    return null;
  }

  // If ad error or no network, show a neutral fallback CTA (no external links)
  if (adError || !currentNetwork) {
    return (
      <div className={`ad-banner-fallback rounded-xl border border-border/60 bg-card/30 p-4 text-center ${className}`}>
        <p className="font-mono text-xs text-muted-foreground/50">
          {lang === "ar"
            ? "🚀 الأداة مجانية 100% — لا إعلانات حالياً"
            : "🚀 The tool is 100% free — no ads right now"}
        </p>
      </div>
    );
  }

  const adUnit = getAdHtml(currentNetwork, format);

  return (
    <div
      className={`ad-banner-wrapper rounded-xl border border-border/60 bg-card/30 p-3 text-center ${className}`}
      role="complementary"
      aria-label={lang === "ar" ? "إعلان" : "Advertisement"}
    >
      {/* Label */}
      <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
        <span>{lang === "ar" ? "إعلان" : "Sponsored"}</span>
        <span className="text-[8px] opacity-30">|</span>
        <span className="text-[8px] opacity-30">
          {lang === "ar" ? `شبكة: ${currentNetwork}` : `Network: ${currentNetwork}`}
        </span>
      </div>

      {/* Ad container */}
      <div
        ref={containerRef}
        className="flex items-center justify-center overflow-hidden rounded-lg ad-container"
        dangerouslySetInnerHTML={{ __html: adUnit.html }}
      />

      {/* Subtle support CTA */}
      <p className="font-mono text-[10px] text-muted-foreground/30 mt-2 leading-tight">
        {lang === "ar"
          ? "الإعلانات تساعدنا على إبقاء الأداة مجانية"
          : "Ads help us keep the tool free"}
      </p>
    </div>
  );
}

/**
 * AdGateModal — Forces user to watch an ad before downloading
 * After ad completes, shows email collection form
 */
interface AdGateModalProps {
  lang: "ar" | "en";
  isOpen: boolean;
  onClose: () => void;
  onComplete: (email?: string) => void;
}

export function AdGateModal({ lang, isOpen, onClose, onComplete }: AdGateModalProps) {
  const [adWatched, setAdWatched] = useState(false);
  const [adTimer, setAdTimer] = useState(7);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  if (!isOpen) return null;

  const handleWatchAd = () => {
    // Start timer
    setAdTimer(7);
    const interval = setInterval(() => {
      setAdTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setAdWatched(true);
          setShowEmailForm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Save email to server
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Also save locally
      localStorage.setItem("dxfix_waitlist_email", email);
    } catch (err) {
      console.warn("Failed to save email:", err);
      localStorage.setItem("dxfix_waitlist_email", email);
    }

    setEmailSubmitted(true);
    setTimeout(() => {
      onComplete(email);
    }, 1500);
  };

  const adUnit = getAdHtml(getBestAdNetwork(), "horizontal");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative bg-card border border-accent/40 rounded-2xl p-8 max-w-md w-full shadow-[var(--shadow-spark)] text-center">
        <button
          onClick={onClose}
          className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg"
        >✕</button>

        {emailSubmitted ? (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-display text-2xl font-bold mb-3">
              {lang === "ar" ? "تم التحميل!" : "Download ready!"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {lang === "ar"
                ? "شكراً لك! سيبدأ التحميل تلقائياً."
                : "Thank you! Your download will start automatically."}
            </p>
          </>
        ) : showEmailForm ? (
          <>
            <div className="text-5xl mb-4">✉️</div>
            <h3 className="font-display text-2xl font-bold mb-3">
              {lang === "ar"
                ? "اشترك لتصلك آخر التحديثات"
                : "Subscribe for updates"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {lang === "ar"
                ? "سجل بريدك الإلكتروني لتصلك أدوات جديدة وعروض حصرية."
                : "Enter your email to get new tools and exclusive offers."}
            </p>
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === "ar" ? "بريدك الإلكتروني" : "Your email"}
                dir="ltr"
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]"
              >
                {lang === "ar" ? "اشترك وحمل الملف ←" : "Subscribe & Download →"}
              </button>
            </form>
            <p className="mt-3 font-mono text-xs text-muted-foreground/50">
              {lang === "ar" ? "لن نرسل لك بريداً مزعجاً. يمكنك الإلغاء في أي وقت." : "No spam. Unsubscribe anytime."}
            </p>
          </>
        ) : adWatched ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h3 className="font-display text-2xl font-bold mb-3">
              {lang === "ar" ? "تم مشاهدة الإعلان!" : "Ad watched!"}
            </h3>
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-3.5 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]"
            >
              ⬇ {lang === "ar" ? "تحميل الملف" : "Download now"}
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">📺</div>
            <h3 className="font-display text-2xl font-bold mb-3">
              {lang === "ar"
                ? "شاهد إعلاناً قصيراً لتحميل الملف"
                : "Watch a short ad to download"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {lang === "ar"
                ? "ادعم الأداة بمشاهدة إعلان قصير. سيتم تفعيل التحميل بعد انتهاء الإعلان."
                : "Support the tool by watching a short ad. Download will be enabled after the ad ends."}
            </p>

            {/* Ad Container */}
            <div className="bg-background border border-border/60 rounded-xl p-4 mb-4 min-h-[120px] flex flex-col items-center justify-center">
              {adTimer > 0 && adTimer < 7 ? (
                <div className="text-3xl mb-2">⏳</div>
              ) : (
                <div className="text-3xl mb-2">📺</div>
              )}
              <div
                className="ad-container w-full"
                dangerouslySetInnerHTML={{ __html: adUnit.html }}
              />
            </div>

            {/* Timer / Watch Button */}
            {adTimer > 0 && adTimer < 7 ? (
              <div className="w-full py-3 rounded-lg bg-accent/20 text-accent font-semibold">
                {lang === "ar" ? `⏳ انتظر ${adTimer} ثوانٍ...` : `⏳ Wait ${adTimer}s...`}
              </div>
            ) : (
              <button
                onClick={handleWatchAd}
                className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]"
              >
                {lang === "ar" ? "▶ شاهد الإعلان" : "▶ Watch Ad"}
              </button>
            )}

            {/* Skip link */}
            <div className="mt-4">
              <a
                href="/?redirect=pricing"
                className="font-mono text-xs text-muted-foreground/60 hover:text-foreground transition underline"
              >
                {lang === "ar" ? "اشترك لإزالة الإعلانات" : "Subscribe to remove ads"}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}