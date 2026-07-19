/**
 * Viral Unlock Modal Component
 * Stunning popup modal for free Pro unlock via newsletter or referral
 */

import { useState } from "react";
import { saveEmail, getReferralLink, getReferralCount, getOrCreateReferralCode, setUserSubscribed, hasReachedReferralThreshold, incrementReferralCount } from "@/lib/viral-launch";
import { type Lang } from "@/lib/i18n";

interface ViralUnlockModalProps {
  lang: Lang;
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  triggerLabel?: string;
}

const T = {
  ar: {
    title: "افتح ميزات الـ Pro مجاناً لفترة محدودة!",
    subtitle: "اختر طريقة التفعيل المجاني وابدأ التحميل فوراً",
    pathALabel: "اشترك بنشرتنا البريدية وافتح التحميل فوراً",
    pathAPlaceholder: "أدخل بريدك الإلكتروني",
    pathABtn: "افتح التحميل مجاناً",
    pathASuccess: "تم الاشتراك! تم فتح التحميل ✓",
    pathBTitle: "انشر الرابط لـ 3 من أصدقائك في جروبات الـ CNC",
    pathBDesc: "شارك رابطك مع زملائك في ورش CNC. عندما ينقر 3 أشخاص على رابطك، سيتم فتح جميع ميزات Pro لك مجاناً!",
    pathBCopy: "نسخ الرابط",
    pathBCopied: "تم النسخ! ✓",
    pathBShare: "مشاركة عبر الواتساب",
    pathBProgress: "عدد النقرات على رابطك",
    pathBThreshold: "من 3",
    pathBUnlocked: "🎉 تم فتح الميزات! شكراً لمشاركتك!",
    closeBtn: "ربما لاحقاً",
    emailError: "يرجى إدخال بريد إلكتروني صحيح",
    emailRequired: "البريد الإلكتروني مطلوب",
    proFeature: "⭐ ميزة Pro",
    lockIcon: "🔒",
  },
  en: {
    title: "Unlock Pro Features Free — Limited Time!",
    subtitle: "Choose your free activation path and start downloading instantly",
    pathALabel: "Join our newsletter & unlock download instantly",
    pathAPlaceholder: "Enter your email address",
    pathABtn: "Unlock Free Download",
    pathASuccess: "Subscribed! Download unlocked ✓",
    pathBTitle: "Share the link with 3 CNC friends in their groups",
    pathBDesc: "Share your link with colleagues in CNC workshops. When 3 people click your link, all Pro features unlock for you free!",
    pathBCopy: "Copy link",
    pathBCopied: "Copied! ✓",
    pathBShare: "Share on WhatsApp",
    pathBProgress: "Link clicks",
    pathBThreshold: "of 3",
    pathBUnlocked: "🎉 Features unlocked! Thanks for sharing!",
    closeBtn: "Maybe later",
    emailError: "Please enter a valid email",
    emailRequired: "Email is required",
    proFeature: "⭐ Pro Feature",
    lockIcon: "🔒",
  },
};

export function ViralUnlockModal({ lang, isOpen, onClose, onUnlocked }: ViralUnlockModalProps) {
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "referral">("email");
  const [unlocked, setUnlocked] = useState(false);

  const t = T[lang as keyof typeof T] || T.en;
  const isRTL = lang === "ar";
  const referralLink = getReferralLink();
  const referralCode = getOrCreateReferralCode();
  const referralCount = getReferralCount();
  const thresholdReached = hasReachedReferralThreshold();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!email.trim()) {
      setEmailError(t.emailRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t.emailError);
      return;
    }

    saveEmail(email.trim(), "viral_unlock");
    setEmailSubmitted(true);
    setUnlocked(true);
    setUserSubscribed(true);
    setTimeout(() => {
      onUnlocked();
      resetAndClose();
    }, 1500);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const shareWhatsApp = () => {
    const msg = lang === "ar"
      ? `🔥 جرّب أداة إصلاح DXF المجانية! ارسل ملفك واحصل على نتيجة فورية. استخدم رابطي: ${referralLink}`
      : `🔥 Try this free DXF repair tool! Upload your file and get instant results. Use my link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const checkAndUnlock = () => {
    incrementReferralCount();
    if (hasReachedReferralThreshold()) {
      setUnlocked(true);
      setUserSubscribed(true);
      setTimeout(() => {
        onUnlocked();
        resetAndClose();
      }, 1500);
    }
  };

  const resetAndClose = () => {
    setEmail("");
    setEmailSubmitted(false);
    setEmailError("");
    setCopied(false);
    setActiveTab("email");
    setUnlocked(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        dir={isRTL ? "rtl" : "ltr"}
        className="relative bg-gradient-to-br from-gray-900 via-card to-gray-900 border border-accent/30 rounded-3xl p-8 max-w-lg w-full shadow-2xl shadow-accent/10 max-h-[90vh] overflow-y-auto"
      >
        {/* Glow effect */}
        <div className="absolute -top-20 -start-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -end-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={resetAndClose}
          className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg z-10"
        >
          ✕
        </button>

        {unlocked ? (
          /* Unlocked Success State */
          <div className="text-center py-8 relative z-10">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h3 className="font-display text-3xl font-bold text-accent mb-3">
              {lang === "ar" ? "تهانينا! تم فتح جميع ميزات Pro!" : "Congratulations! All Pro Features Unlocked!"}
            </h3>
            <p className="text-muted-foreground text-lg mb-2">
              {lang === "ar" ? "يمكنك الآن تحميل الملف المصلح واستخدام جميع الميزات" : "You can now download fixed files and use all features"}
            </p>
            <div className="mt-6 w-16 h-16 mx-auto rounded-full border-4 border-accent border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative z-10">
              <div className="text-5xl mb-4 text-center">⚡</div>
              <h3 className="font-display text-2xl font-bold text-center mb-2">{t.title}</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">{t.subtitle}</p>
            </div>

            {/* Tab Buttons */}
            <div className="flex gap-2 mb-6 relative z-10">
              <button
                onClick={() => setActiveTab("email")}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "email"
                    ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {lang === "ar" ? "📧 اشتراك بريدي" : "📧 Email"}
              </button>
              <button
                onClick={() => setActiveTab("referral")}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "referral"
                    ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {lang === "ar" ? "🔗 دعوة الأصدقاء" : "🔗 Invite Friends"}
              </button>
            </div>

            {/* Email Path */}
            {activeTab === "email" && (
              <div className="relative z-10 space-y-4">
                {emailSubmitted ? (
                  <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/30 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-green-400 font-semibold text-lg">{t.pathASuccess}</p>
                  </div>
                ) : (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/5 to-purple-500/5 border border-accent/20">
                      <label className="block text-sm font-semibold mb-3">
                        {t.pathALabel}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.pathAPlaceholder}
                        dir={isRTL ? "rtl" : "ltr"}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition"
                      />
                      {emailError && (
                        <p className="text-red-400 text-xs mt-1.5">{emailError}</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-accent/20"
                    >
                      {t.pathABtn}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Referral Path */}
            {activeTab === "referral" && (
              <div className="relative z-10 space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border border-yellow-500/20">
                  <h4 className="font-display font-bold text-sm mb-2">{t.pathBTitle}</h4>
                  <p className="text-xs text-muted-foreground mb-4">{t.pathBDesc}</p>

                  {/* Referral Code Display */}
                  <div className="bg-background border border-border rounded-xl p-3 mb-4 text-center">
                    <span className="font-mono text-lg font-bold tracking-widest text-accent">{referralCode}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{t.pathBProgress}: {Math.min(referralCount, 3)} {t.pathBThreshold}</span>
                      {thresholdReached && <span className="text-green-400 font-bold">{t.pathBUnlocked}</span>}
                    </div>
                    <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          thresholdReached ? "bg-green-500" : "bg-gradient-to-r from-yellow-500 to-accent"
                        }`}
                        style={{ width: `${Math.min((referralCount / 3) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={copyLink}
                      className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition border border-border"
                    >
                      {copied ? t.pathBCopied : `📋 ${t.pathBCopy}`}
                    </button>
                    <button
                      onClick={shareWhatsApp}
                      className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
                    >
                      💬 {t.pathBShare}
                    </button>
                  </div>
                </div>

                {/* Simulate Referral Click (for testing/demo) */}
                <button
                  onClick={checkAndUnlock}
                  className="w-full py-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition underline"
                >
                  {lang === "ar" ? "⚡ محاكاة نقرة (للتجربة)" : "⚡ Simulate referral click (test)"}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 text-center relative z-10">
              <button
                onClick={resetAndClose}
                className="text-sm text-muted-foreground/60 hover:text-foreground transition"
              >
                {t.closeBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}