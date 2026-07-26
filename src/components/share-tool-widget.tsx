/**
 * ShareToolWidget — Lightweight Referral & Social Share Component
 *
 * Displays a compact widget inviting users to share the tool with colleagues.
 * Uses the existing viral-launch referral system for link generation.
 * Targets LinkedIn, WhatsApp, and Twitter/X — the main channels for engineers.
 *
 * Props:
 * - lang: "ar" | "en" for localised text
 * - variant: "sidebar" | "inline" | "compact" for different layout styles
 * - className: additional CSS classes
 */
"use client";

import { useState, useCallback } from "react";
import { getReferralLink, getOrCreateReferralCode } from "@/lib/viral-launch";

interface ShareToolWidgetProps {
  lang: "ar" | "en";
  variant?: "sidebar" | "inline" | "compact";
  className?: string;
}

const T = {
  ar: {
    title: "ادعم الأداة — شاركها مع زملائك",
    prompt: "هل تستفيد من أدوات CAD المجانية؟ شاركها مع فريقك الهندسي أو زملائك في الجامعة لنساعد في إبقاء هذا المشروع مجانياً 100% ونشطاً!",
    copyLink: "نسخ رابط الإحالة",
    copied: "تم النسخ! ✓",
    linkedin: "مشاركة على LinkedIn",
    whatsapp: "مشاركة على WhatsApp",
    twitter: "مشاركة على X/Twitter",
    orShare: "أو شارك الرابط مباشرة",
    refCode: "رمز الإحالة",
  },
  en: {
    title: "Support the Tool — Share with Colleagues",
    prompt: "Enjoying our free CAD tools? Share them with your engineering team or university colleagues to help us keep this project 100% free and active!",
    copyLink: "Copy Referral Link",
    copied: "Copied! ✓",
    linkedin: "Share on LinkedIn",
    whatsapp: "Share on WhatsApp",
    twitter: "Share on X/Twitter",
    orShare: "Or share the link directly",
    refCode: "Referral Code",
  },
};

export function ShareToolWidget({
  lang,
  variant = "inline",
  className = "",
}: ShareToolWidgetProps) {
  const [copied, setCopied] = useState(false);
  const isRTL = lang === "ar";
  const t = T[lang];

  const referralLink = getReferralLink();
  const referralCode = getOrCreateReferralCode();

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [referralLink]);

  const shareLinkedIn = useCallback(() => {
    const url = encodeURIComponent(referralLink);
    const text = encodeURIComponent(
      lang === "ar"
        ? "أداة مجانية لإصلاح ملفات DXF — جرّبها وانشرها لفريقك!"
        : "Free DXF repair tool — try it and share with your team!"
    );
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [referralLink, lang]);

  const shareWhatsApp = useCallback(() => {
    const msg = encodeURIComponent(
      lang === "ar"
        ? `🔥 أداة مجانية لإصلاح ملفات DXF للورش! ارفع ملفك واحصل على نتيجة فورية. استخدم الرابط: ${referralLink}`
        : `🔥 Free DXF repair tool for workshops! Upload your file and get instant results. Use this link: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  }, [referralLink, lang]);

  const shareTwitter = useCallback(() => {
    const text = encodeURIComponent(
      lang === "ar"
        ? `أداة مجانية لإصلاح ملفات DXF للورش الهندسية 🛠️\\n\\n${referralLink}`
        : `Free DXF repair tool for engineering workshops 🛠️\\n\\n${referralLink}`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [referralLink]);

  // ─── Compact variant (small badge-style, for tight spaces) ───
  if (variant === "compact") {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className={`flex items-center gap-2 ${className}`}
      >
        <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap">
          {lang === "ar" ? "شارك:" : "Share:"}
        </span>
        <button
          onClick={shareLinkedIn}
          className="w-7 h-7 rounded-md bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center transition text-xs"
          title={t.linkedin}
          aria-label={t.linkedin}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#0A66C2]">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </button>
        <button
          onClick={shareWhatsApp}
          className="w-7 h-7 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 flex items-center justify-center transition text-xs"
          title={t.whatsapp}
          aria-label={t.whatsapp}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25D366]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
        <button
          onClick={shareTwitter}
          className="w-7 h-7 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 flex items-center justify-center transition text-xs"
          title={t.twitter}
          aria-label={t.twitter}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
      </div>
    );
  }

  // ─── Sidebar variant (vertical stack, for side panels) ───
  if (variant === "sidebar") {
    return (
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className={`rounded-xl border border-border/60 bg-card/30 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤝</span>
          <h4 className="font-display font-semibold text-sm">{t.title}</h4>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed mb-4">
          {t.prompt}
        </p>

        {/* Referral code display */}
        <div className="bg-background border border-border/60 rounded-lg px-3 py-2 mb-3 text-center">
          <span className="font-mono text-xs text-muted-foreground/50">{t.refCode}:</span>
          <span className="font-mono text-sm font-bold tracking-wider text-accent ms-1">{referralCode}</span>
        </div>

        {/* Social buttons — vertical */}
        <div className="space-y-2">
          <button
            onClick={shareLinkedIn}
            className="w-full py-2 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 border border-[#0A66C2]/20 text-[#0A66C2] font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#0A66C2]">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            {t.linkedin}
          </button>
          <button
            onClick={shareWhatsApp}
            className="w-full py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {t.whatsapp}
          </button>
          <button
            onClick={shareTwitter}
            className="w-full py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border/60 text-foreground font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            {t.twitter}
          </button>
        </div>

        {/* Copy link button */}
        <button
          onClick={copyLink}
          className="w-full mt-3 py-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent font-semibold text-xs transition flex items-center justify-center gap-2"
        >
          {copied ? (
            <>✅ {t.copied}</>
          ) : (
            <>📋 {t.copyLink}</>
          )}
        </button>
      </div>
    );
  }

  // ─── Inline variant (horizontal, for footer/widget areas) ───
  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`rounded-xl border border-border/60 bg-gradient-to-r from-accent/5 to-primary/5 p-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon & text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🤝</span>
            <h4 className="font-display font-semibold text-sm">{t.title}</h4>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
            {t.prompt}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:items-end gap-2 shrink-0 w-full sm:w-auto">
          {/* Social share row */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap">
              {t.orShare}
            </span>
            <button
              onClick={shareLinkedIn}
              className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 flex items-center justify-center transition"
              title={t.linkedin}
              aria-label={t.linkedin}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#0A66C2]">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </button>
            <button
              onClick={shareWhatsApp}
              className="w-8 h-8 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 flex items-center justify-center transition"
              title={t.whatsapp}
              aria-label={t.whatsapp}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
            <button
              onClick={shareTwitter}
              className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition"
              title={t.twitter}
              aria-label={t.twitter}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
          </div>

          {/* Copy link button */}
          <button
            onClick={copyLink}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent font-semibold text-xs transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {copied ? (
              <>✅ {t.copied}</>
            ) : (
              <>📋 {t.copyLink}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}