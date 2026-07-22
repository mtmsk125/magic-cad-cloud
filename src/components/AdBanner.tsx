/**
 * AdBanner — Smart Advertisement Component
 *
 * - Reads `isPremium` from the `usePremiumStatus` hook.
 * - If `isPremium === true` → renders nothing (no ad code loaded).
 * - If `isPremium === false` → renders a Google AdSense container
 *   styled to match the dark theme, with automatic ad slot push.
 *
 * Props:
 * - slot: AdSense data-ad-slot identifier (optional, defaults to a placeholder)
 * - format: "horizontal" | "rectangle" | "vertical" (optional, defaults to "horizontal")
 * - className: additional CSS classes
 * - lang: "ar" | "en" for localised placeholder text
 */
"use client";

import { useEffect, useRef } from "react";
import { usePremiumStatus } from "@/lib/subscription-status";

export interface AdBannerProps {
  slot?: string;
  format?: "horizontal" | "rectangle" | "vertical";
  className?: string;
  lang?: "ar" | "en" | "fr" | "zh";
}

const ADSENSE_CLIENT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta.env.VITE_ADSENSE_CLIENT_ID ||
      import.meta.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID)) ||
  "ca-pub-XXXXXXXXXXXXXXXX";

const FORMAT_STYLES: Record<string, React.CSSProperties> = {
  horizontal: { display: "block", minWidth: "300px", width: "100%", height: "90px" },
  rectangle: { display: "block", minWidth: "250px", width: "100%", height: "250px" },
  vertical: { display: "block", minWidth: "160px", width: "160px", height: "600px" },
};

export function AdBanner({
  slot = "XXXXXXXXXX",
  format = "horizontal",
  className = "",
  lang = "ar",
}: AdBannerProps) {
  const { isPremium, isLoading } = usePremiumStatus();
  const adRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  // Push ad slot to AdSense queue whenever the container mounts (for free users only)
  useEffect(() => {
    if (isLoading || isPremium) return;

    // Only push once per mount cycle
    if (pushed.current) return;

    const timer = setTimeout(() => {
      try {
        const adsbygoogle = (window as any).adsbygoogle;
        if (adsbygoogle && Array.isArray(adsbygoogle)) {
          adsbygoogle.push({});
          pushed.current = true;
        }
      } catch (e) {
        // Silently fail — AdSense may not be loaded yet
      }
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, isPremium]);

  // If still loading or premium, render nothing (no ad code at all)
  if (isLoading || isPremium) {
    return null;
  }

  const adStyle: React.CSSProperties = FORMAT_STYLES[format] || FORMAT_STYLES.horizontal;

  return (
    <div
      className={`ad-banner-wrapper rounded-xl border border-border/60 bg-card/30 p-3 text-center ${className}`}
      role="complementary"
      aria-label={lang === "ar" ? "إعلان" : "Advertisement"}
    >
      {/* Label */}
      <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">
        {lang === "ar" ? "إعلان" : "Sponsored Ad"}
      </div>

      {/* Ad container */}
      <div ref={adRef} className="flex items-center justify-center overflow-hidden rounded-lg">
        <ins
          className="adsbygoogle"
          style={adStyle}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slot}
          data-ad-format={format === "horizontal" ? "auto" : format}
          data-full-width-responsive="true"
        />
      </div>

      {/* Subtle upgrade CTA */}
      <p className="font-mono text-[10px] text-muted-foreground/30 mt-2 leading-tight">
        {lang === "ar"
          ? "اشترك في Pro أو Workshop لإزالة الإعلانات"
          : "Subscribe to Pro or Workshop to remove ads"}
      </p>
    </div>
  );
}