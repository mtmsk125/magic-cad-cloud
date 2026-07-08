/**
 * Subscription Required Banner
 * Shows when user is redirected from /tool due to lack of subscription
 */

import { useEffect, useState } from "react";

interface SubscriptionPromptProps {
  lang?: "ar" | "en";
  onDismiss?: () => void;
}

export function SubscriptionPrompt({ lang = "ar", onDismiss }: SubscriptionPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side only
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Check if redirected from tool
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect") === "pricing" || params.get("redirect") === "tool") {
      setIsVisible(true);
      
      // Auto-scroll to pricing section after 500ms
      const timer = setTimeout(() => {
        const pricingSection = document.getElementById("pricing");
        if (pricingSection) {
          pricingSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isClient]);

  // Don't render anything on server
  if (!isClient) {
    return null;
  }

  if (!isVisible) return null;

  const isRTL = lang === "ar";
  const messages = {
    ar: {
      title: "اشتراك مطلوب",
      description: "يجب أن تشترك أولاً لاستخدام أداة إصلاح ملفات DXF.",
      cta: "اختر خطة الآن",
      dismiss: "حسناً",
    },
    en: {
      title: "Subscription Required",
      description: "You need to subscribe first to use the DXF repair tool.",
      cta: "Choose a plan now",
      dismiss: "Got it",
    },
  };

  const m = messages[lang];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="fixed top-20 left-4 right-4 z-50 max-w-md">
      <div className="bg-accent/95 border border-accent text-accent-foreground rounded-lg p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{m.title}</h3>
            <p className="text-xs text-accent-foreground/80 mt-1">{m.description}</p>
            <button
              onClick={() => {
                const pricingSection = document.getElementById("pricing");
                if (pricingSection) {
                  pricingSection.scrollIntoView({ behavior: "smooth" });
                }
                setIsVisible(false);
              }}
              className="mt-3 text-xs font-semibold hover:underline"
            >
              {m.cta} →
            </button>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss?.();
            }}
            className="text-accent-foreground/60 hover:text-accent-foreground transition text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
