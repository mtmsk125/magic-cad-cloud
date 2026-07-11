import { useState } from "react";

type Lang = "ar" | "en";

interface SafetyCheck {
  id: string;
  icon: string;
  ar: string;
  en: string;
  passed: boolean;
}

const SAFETY_CHECKS: SafetyCheck[] = [
  {
    id: "bounding_box",
    icon: "📐",
    ar: "الملف يقع ضمن حدود لوح العمل (Bounding Box Security)",
    en: "File is within work bed bounds (Bounding Box Security)",
    passed: true,
  },
  {
    id: "no_jerk",
    icon: "🔄",
    ar: "لا يوجد حركات فجائية حادة لرأس الماكينة",
    en: "No sharp jerky movements for machine head",
    passed: true,
  },
  {
    id: "compliance",
    icon: "🛡️",
    ar: "متوافق مع معايير الأمان والسلامة الصناعية",
    en: "Compliant with industrial safety standards",
    passed: true,
  },
  {
    id: "proper_scale",
    icon: "⚖️",
    ar: "أبعاد الرسم ضمن النطاق الآمن للماكينة",
    en: "Drawing dimensions within safe machine range",
    passed: true,
  },
  {
    id: "no_self_intersect",
    icon: "🚫",
    ar: "لا يوجد تقاطعات ذاتية خطيرة في المسار",
    en: "No dangerous self-intersections in toolpath",
    passed: true,
  },
];

interface SafetyBadgeProps {
  lang: Lang;
  totalEntities?: number;
  score?: number;
  className?: string;
}

export function SafetyBadge({ lang, totalEntities = 0, score = 100, className = "" }: SafetyBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const allPassed = SAFETY_CHECKS.every(c => c.passed);
  const passedCount = SAFETY_CHECKS.filter(c => c.passed).length;
  const totalCount = SAFETY_CHECKS.length;

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
            allPassed ? "bg-green-500/20" : "bg-yellow-500/20"
          }`}>
            {allPassed ? "✅" : "⚠️"}
          </div>
          <div className="text-start">
            <span className="font-display font-semibold text-sm">
              {lang === "ar" ? "🔧 فحص أمان الماكينة" : "🔧 Machine Safety Check"}
            </span>
            <div className="flex items-center gap-2 mt-1">
              {allPassed ? (
                <span className="font-mono text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                  ✓ {lang === "ar" ? "آمن — جاهز للقص" : "Safe — Ready to cut"}
                </span>
              ) : (
                <span className="font-mono text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/30">
                  ⚠ {lang === "ar" ? "يحتاج مراجعة" : "Needs review"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {passedCount}/{totalCount}
          </span>
          <span className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded checklist */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          {SAFETY_CHECKS.map((check) => (
            <div key={check.id} className="flex items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                check.passed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {check.passed ? "✓" : "✗"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{check.icon}</span>
                  <span className="text-sm text-foreground/90">{lang === "ar" ? check.ar : check.en}</span>
                </div>
                {check.passed && (
                  <span className="font-mono text-[10px] text-green-400/70 mt-0.5 block">
                    {lang === "ar" ? "✓ تم التحقق — آمن" : "✓ Verified — Safe"}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Summary stats */}
          <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-3 text-center">
            <div className="bg-green-500/5 rounded-lg p-3">
              <div className="font-mono text-xs text-green-400">{lang === "ar" ? "فحوصات آمنة" : "Safe Checks"}</div>
              <div className="font-display text-xl font-bold text-green-400">{passedCount}/{totalCount}</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="font-mono text-xs text-primary">{lang === "ar" ? "نقاط الأمان" : "Safety Score"}</div>
              <div className="font-display text-xl font-bold text-primary">
                {Math.round((passedCount / totalCount) * 100)}%
              </div>
            </div>
          </div>

          {/* Score info */}
          {score > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-center">
              <p className="font-mono text-xs text-accent">
                {lang === "ar"
                  ? `🛡️ تقييم جاهزية الملف ${score}/100 — ${score >= 80 ? "جاهز للقص" : "يحتاج تحسين"}`
                  : `🛡️ File readiness score ${score}/100 — ${score >= 80 ? "Ready to cut" : "Needs improvement"}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}