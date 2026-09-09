/**
 * SubscribeBeforeDownload Modal
 * Shows a "subscribe with us" prompt before the user downloads a repaired DXF.
 * Emails are saved to the durable waitlist (/api/waitlist) — visible in the
 * admin panel CSV export. A localStorage flag prevents nagging on later downloads.
 */

import { useState } from "react";

const SUBSCRIBED_KEY = "dxfix_subscribed";

/** Has this browser already subscribed? (downloads proceed without the modal) */
export function isSubscribed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SUBSCRIBED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persist the subscription flag so future downloads skip the modal */
export function markSubscribed(): void {
  try {
    localStorage.setItem(SUBSCRIBED_KEY, "true");
  } catch {
    // ignore
  }
}

interface SubscribeModalProps {
  lang: "ar" | "en";
  isOpen: boolean;
  /** Called after the user subscribes (email saved) or skips — triggers the download */
  onComplete: () => void;
  onClose: () => void;
}

export function SubscribeModal({ lang, isOpen, onComplete, onClose }: SubscribeModalProps) {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const isRTL = lang === "ar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!clean) {
      setErrorMsg(lang === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setErrorMsg(lang === "ar" ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
    } catch (err) {
      console.warn("Failed to save email (offline):", err);
    }
    markSubscribed();
    setSaving(false);
    setDone(true);
    setTimeout(() => {
      onComplete();
    }, 700);
  };

  const handleSkip = () => {
    onComplete();
  };
return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-accent/30 bg-card shadow-2xl p-6 relative overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 via-accent to-primary/50" />

        {done ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="font-display text-xl font-bold">
              {lang === "ar" ? "تم الاشتراك بنجاح!" : "Subscribed!"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "ar"
                ? "سيصلك كل جديد وتحديثات الأداة. جارٍ تحميل ملفك..."
                : "You'll receive updates & new releases. Preparing your download..."}
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={onClose}
              className="absolute top-3 end-4 text-muted-foreground/60 hover:text-foreground transition text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <div className="text-center mb-5">
              <div className="text-5xl mb-3">📬</div>
              <h3 className="font-display text-xl font-bold">
                {lang === "ar" ? "اشترك معنا قبل تحميل الملف" : "Subscribe before downloading"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {lang === "ar"
                  ? "ضع بريدك ليصلك كل جديد: تحديثات الأداة، أدوات جديدة، وعروض حصرية أثناء فترة الانطلاق."
                  : "Enter your email to get updates, new tools, and exclusive launch offers."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === "ar" ? "بريدك الإلكتروني" : "Your email address"}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-accent transition"
                dir="ltr"
              />
              {errorMsg && (
                <p className="text-xs text-red-400 text-center">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-accent text-accent-foreground font-bold text-sm py-3 hover:opacity-90 transition disabled:opacity-60"
              >
                {saving
                  ? lang === "ar"
                    ? "جارٍ الحفظ..."
                    : "Saving..."
                  : lang === "ar"
                    ? "اشترك وحمّل الملف ←"
                    : "Subscribe & Download →"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition underline"
              >
                {lang === "ar" ? "تخطي مؤقتاً والتحميل الآن" : "Skip for now & download"}
              </button>
            </div>

            <p className="mt-4 font-mono text-[10px] text-muted-foreground/40 text-center">
              {lang === "ar"
                ? "🔒 نلتزم بعدم مشاركة بريدك مع أي طرف ثالث."
                : "🔒 We never share your email with third parties."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}