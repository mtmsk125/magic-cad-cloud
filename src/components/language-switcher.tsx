/**
 * Language Switcher Component
 * Supports: العربية, English, Svenska, Français, Русский, 中文
 */

import { LANGS, type Lang } from "@/lib/i18n";

interface LanguageSwitcherProps {
  currentLang: Lang;
  onLangChange: (lang: Lang) => void;
  className?: string;
}

export function LanguageSwitcher({ currentLang, onLangChange, className = "" }: LanguageSwitcherProps) {
  const current = LANGS.find(l => l.code === currentLang) || LANGS[0];

  return (
    <div className={`relative group ${className}`}>
      <button
        className="font-mono text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/60 hover:text-primary transition flex items-center gap-1.5"
        title="Change language"
      >
        <span>{current.name}</span>
        <span className="text-[10px] opacity-60">▼</span>
      </button>
      <div className="absolute top-full mt-1 end-0 w-40 bg-card border border-border rounded-xl shadow-[var(--shadow-elegant)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onLangChange(lang.code)}
            className={`w-full text-right px-4 py-2.5 text-sm transition flex items-center gap-2 ${
              lang.code === currentLang
                ? "bg-accent/10 text-accent font-semibold"
                : "text-foreground hover:bg-muted/30"
            }`}
          >
            <span className="text-base">
              {lang.code === "ar" ? "🇸🇦" :
               lang.code === "en" ? "��" :
               lang.code === "fr" ? "🇫🇷" :
               lang.code === "zh" ? "🇨🇳" : "🌐"}
            </span>
            <span>{lang.name}</span>
            {lang.code === currentLang && <span className="me-auto text-accent">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}