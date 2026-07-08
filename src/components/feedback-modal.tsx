/**
 * Feedback & Review Modal Component
 * Floating button + modal for submitting workshop reviews
 */

import { useState } from "react";
import { submitFeedback } from "@/lib/feedback";

interface FeedbackModalProps {
  lang?: "ar" | "en";
}

const MACHINE_TYPES = {
  ar: ["CNC Router", "Laser", "Plasma", "Waterjet", "CNC Mill", "أخرى"],
  en: ["CNC Router", "Laser", "Plasma", "Waterjet", "CNC Mill", "Other"],
};

const T = {
  ar: {
    button: "شاركنا رأيك وتجربتك",
    title: "شاركنا رأيك وتجربتك",
    subtitle: "تقييمك يساعدنا نطور الأداة لخدمتك بشكل أفضل",
    nameLabel: "الاسم أو اسم الورشة / المصنع",
    namePlaceholder: "مثال: ورشة الرياض للنجارة",
    machineLabel: "نوع الماكينة المستخدمة",
    ratingLabel: "التقييم بالنجوم",
    messageLabel: "رأيك أو المشكلة التي واجهتك",
    messagePlaceholder: "شاركنا تجربتك مع الأداة...",
    submitBtn: "إرسال التقييم",
    successTitle: "شكراً لمشاركتك! 🎉",
    successMsg: "تم استلام تقييمك بنجاح. سنقوم بمراجعته ونشره قريباً.",
    closeBtn: "إغلاق",
    errorMsg: "عذراً، حدث خطأ. حاول مرة أخرى.",
  },
  en: {
    button: "Share Your Feedback",
    title: "Share Your Feedback & Experience",
    subtitle: "Your review helps us improve the tool to serve you better",
    nameLabel: "Name or Workshop / Company Name",
    namePlaceholder: "e.g., Riyadh Wood Workshop",
    machineLabel: "Machine Type Used",
    ratingLabel: "Star Rating",
    messageLabel: "Your Feedback or Issue Encountered",
    messagePlaceholder: "Share your experience with the tool...",
    submitBtn: "Submit Review",
    successTitle: "Thank you for sharing! 🎉",
    successMsg: "Your review has been submitted successfully. We'll review and publish it soon.",
    closeBtn: "Close",
    errorMsg: "Sorry, an error occurred. Please try again.",
  },
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition-all hover:scale-110 ${
            star <= value ? "text-yellow-400" : "text-muted-foreground/30"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function FeedbackModal({ lang = "ar" }: FeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [machineType, setMachineType] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const t = T[lang];
  const isRTL = lang === "ar";
  const machines = MACHINE_TYPES[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !machineType || rating === 0 || !message.trim()) {
      setError(lang === "ar" ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }

    setSubmitting(true);

    try {
      submitFeedback({
        name: name.trim(),
        machineType,
        rating,
        message: message.trim(),
      });

      // Simulate slight delay for UX
      await new Promise(resolve => setTimeout(resolve, 600));
      setSubmitted(true);
    } catch {
      setError(t.errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setMachineType("");
    setRating(0);
    setMessage("");
    setSubmitted(false);
    setError("");
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 end-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-accent-foreground font-semibold text-sm shadow-[var(--shadow-spark)] hover:opacity-90 transition-all hover:scale-105"
      >
        <span>💬</span>
        <span className="hidden sm:inline">{t.button}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div dir={isRTL ? "rtl" : "ltr"} className="relative bg-card border border-accent/40 rounded-2xl p-8 max-w-lg w-full shadow-[var(--shadow-spark)] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setIsOpen(false); resetForm(); }}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg"
            >
              ✕
            </button>

            {submitted ? (
              <div className="text-center py-6">
                <div className="text-6xl mb-6">🎉</div>
                <h3 className="font-display text-2xl font-bold mb-3">{t.successTitle}</h3>
                <p className="text-muted-foreground mb-6">{t.successMsg}</p>
                <button
                  onClick={() => { setIsOpen(false); resetForm(); }}
                  className="px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition"
                >
                  {t.closeBtn}
                </button>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-4 text-center">💬</div>
                <h3 className="font-display text-2xl font-bold text-center mb-2">{t.title}</h3>
                <p className="text-sm text-muted-foreground text-center mb-6">{t.subtitle}</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name Field */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.nameLabel}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition"
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                  </div>

                  {/* Machine Type */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.machineLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {machines.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMachineType(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                            machineType === m
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-border text-muted-foreground hover:border-accent/50 hover:text-accent"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.ratingLabel}</label>
                    <StarRating value={rating} onChange={setRating} />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.messageLabel}</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.messagePlaceholder}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition resize-none"
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)] disabled:opacity-50"
                  >
                    {submitting ? "⏳ ..." : `⭐ ${t.submitBtn}`}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}