/**
 * Auto-Marketing System — تسويق آلي غير مزعج
 * 
 * استراتيجيات تسويق ذكية بدون سبام:
 * 1. **Social Proof** — إشعارات حية بنشاط المستخدمين (موجود)
 * 2. **Smart Share** — مشاركة ذكية بعد الإنجاز
 * 3. **SEO Auto-Optimizer** — تحسين SEO تلقائي
 * 4. **Viral Loop** — دائرة انتشار فيروسية
 * 5. **WhatsApp Channel** — قناة واتساب للإشعارات
 * 6. **Referral Rewards** — مكافآت الإحالة (موجود)
 */

export interface ShareConfig {
  platform: 'whatsapp' | 'twitter' | 'linkedin' | 'facebook' | 'telegram';
  message: string;
  url: string;
}

// ─── 1. Smart Share After Achievement ───

export function getAchievementShareText(
  achievement: string,
  lang: 'ar' | 'en',
  referralLink: string
): ShareConfig[] {
  const messages: Record<string, { ar: string; en: string }> = {
    file_repaired: {
      ar: `🛠️ أصلحت ملف DXF في ثواني باستخدام DXFix! جربها مجاناً 👇`,
      en: `🛠️ I fixed a DXF file in seconds with DXFix! Try it for free 👇`,
    },
    score_100: {
      ar: `💯 أول ملف DXF أحصل فيه على تقييم 100/100! الأداة مجانية 👇`,
      en: `💯 First DXF file with a 100/100 score! The tool is free 👇`,
    },
    batch_done: {
      ar: `📦 عالجت ${achievement} ملف DXF دفعة واحدة! وفرت ساعات من الشغل 👇`,
      en: `📦 Processed ${achievement} DXF files in one batch! Saved hours 👇`,
    },
    first_use: {
      ar: `🔥 أول استخدام لـ DXFix — أداة عربية لإصلاح ملفات DXF. مجانية! 👇`,
      en: `🔥 First time using DXFix — Arabic DXF repair tool. Free! 👇`,
    },
  };

  const msg = messages[achievement] || messages.first_use;
  const text = lang === 'ar' ? msg.ar : msg.en;
  const fullText = `${text}\n${referralLink}`;
  const encoded = encodeURIComponent(fullText);

  return [
    { platform: 'whatsapp', message: fullText, url: `https://wa.me/?text=${encoded}` },
    { platform: 'twitter', message: fullText, url: `https://twitter.com/intent/tweet?text=${encoded}` },
    { platform: 'telegram', message: fullText, url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}` },
  ];
}

// ─── 2. SEO Auto-Optimizer ───

export interface SeoMeta {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
}

export function getSeoMeta(page: string, lang: 'ar' | 'en'): SeoMeta {
  const seo: Record<string, { ar: SeoMeta; en: SeoMeta }> = {
    home: {
      ar: {
        title: 'DXFix — إصلاح وفحص ملفات DXF لورش CNC | مجاني',
        description: 'أصلح أخطاء ملفات DXF، احصل على تقييم جاهزية القص، وصدّر ملفاً نظيفاً خلال ثوانٍ. مجاني لورش الليزر والبلازما والـ CNC.',
        keywords: 'إصلاح DXF, CNC, ليزر, بلازما, ورشة, أداة عربية, مجاني',
        ogTitle: 'DXFix — أداة إصلاح DXF للورش',
        ogDescription: 'أول أداة عربية مجانية لإصلاح ملفات DXF',
      },
      en: {
        title: 'DXFix — DXF File Repair & Validation for CNC | Free',
        description: 'Fix DXF errors, get cut-readiness score, export clean files in seconds. Free for laser, plasma & CNC workshops.',
        keywords: 'DXF repair, CNC, laser, plasma, workshop, Arabic tool, free',
        ogTitle: 'DXFix — DXF Repair Tool for Workshops',
        ogDescription: 'The first free Arabic DXF repair tool',
      },
    },
    tool: {
      ar: {
        title: 'DXFix — أداة إصلاح وفحص ملفات DXF اونلاين | مجاني',
        description: 'ارفع ملف DXF، نكشف الأخطاء ونصلحها تلقائياً. حمّل ملفاً نظيفاً جاهزاً للماكينة.',
        keywords: 'إصلاح DXF اونلاين, فحص DXF, أداة مجانية, CNC',
        ogTitle: 'DXFix — أداة DXF اونلاين',
        ogDescription: 'ارفع وأصلح ملفات DXF اونلاين مجاناً',
      },
      en: {
        title: 'DXFix — Online DXF Repair & Analysis Tool | Free',
        description: 'Upload DXF, auto-detect & fix errors. Download clean machine-ready files.',
        keywords: 'online DXF repair, DXF analysis, free tool, CNC',
        ogTitle: 'DXFix — Online DXF Tool',
        ogDescription: 'Upload and fix DXF files online for free',
      },
    },
  };

  return seo[page]?.[lang] || seo.home.en;
}

// ─── 3. Viral Loop Triggers ───

export interface ViralTrigger {
  event: string;
  condition: (stats: any) => boolean;
  message: { ar: string; en: string };
  action: 'share' | 'email' | 'whatsapp_channel';
}

export const VIRAL_TRIGGERS: ViralTrigger[] = [
  {
    event: 'file_repaired',
    condition: (stats) => stats.filesRepaired === 1,
    message: {
      ar: '🎉 أول ملف تم إصلاحه! شارك الخبر مع زملائك في الورشة',
      en: '🎉 First file repaired! Share the news with your workshop colleagues',
    },
    action: 'share',
  },
  {
    event: 'score_above_90',
    condition: (stats) => stats.highScore >= 90,
    message: {
      ar: '💯 حصلت على تقييم 90+! هل تعلم أن DXFix مجاني؟ شارك الأداة',
      en: '💯 Scored 90+! Did you know DXFix is free? Share the tool',
    },
    action: 'share',
  },
  {
    event: 'batch_completed',
    condition: (stats) => stats.batchCount >= 3,
    message: {
      ar: '📦 عالجت 3+ ملفات دفعة واحدة! شارك الأداة مع ورشة ثانية',
      en: '📦 Processed 3+ files in one batch! Share with another workshop',
    },
    action: 'share',
  },
  {
    event: 'returning_user',
    condition: (stats) => stats.visits >= 3,
    message: {
      ar: '👋 مرحباً بعودتك! انضم لقناة واتساب لتصلك آخر التحديثات',
      en: '👋 Welcome back! Join our WhatsApp channel for updates',
    },
    action: 'whatsapp_channel',
  },
];

// ─── 4. WhatsApp Channel Auto-Invite ───

export function getWhatsAppChannelUrl(): string {
  return 'https://whatsapp.com/channel/0029Va8n5XxXxXxXxXxXxXx'; // Replace with actual channel
}

export function getWhatsAppInviteMessage(lang: 'ar' | 'en'): string {
  return lang === 'ar'
    ? '🔔 انضم لقناة DXFix على واتساب لتصلك آخر التحديثات والأدوات المجانية'
    : '🔔 Join DXFix WhatsApp channel for latest updates and free tools';
}

// ─── 5. Auto-Track User Stats (for viral triggers) ───

export interface UserStats {
  visits: number;
  filesRepaired: number;
  highScore: number;
  batchCount: number;
  lastVisit: number;
  firstVisit: number;
}

const STATS_KEY = 'dxfix_user_stats';

export function getUserStats(): UserStats {
  if (typeof window === 'undefined') {
    return { visits: 0, filesRepaired: 0, highScore: 0, batchCount: 0, lastVisit: 0, firstVisit: 0 };
  }
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { visits: 0, filesRepaired: 0, highScore: 0, batchCount: 0, lastVisit: 0, firstVisit: 0 };
}

export function trackVisit(): UserStats {
  const stats = getUserStats();
  stats.visits += 1;
  stats.lastVisit = Date.now();
  if (stats.firstVisit === 0) stats.firstVisit = Date.now();
  saveStats(stats);
  return stats;
}

export function trackFileRepaired(score?: number): UserStats {
  const stats = getUserStats();
  stats.filesRepaired += 1;
  if (score && score > stats.highScore) stats.highScore = score;
  saveStats(stats);
  return stats;
}

export function trackBatchProcessed(count: number): UserStats {
  const stats = getUserStats();
  stats.batchCount += count;
  saveStats(stats);
  return stats;
}

function saveStats(stats: UserStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

// ─── 6. Check Viral Triggers ───

export function checkViralTriggers(event: string, lang: 'ar' | 'en'): ViralTrigger | null {
  const stats = getUserStats();
  for (const trigger of VIRAL_TRIGGERS) {
    if (trigger.event === event && trigger.condition(stats)) {
      return trigger;
    }
  }
  return null;
}