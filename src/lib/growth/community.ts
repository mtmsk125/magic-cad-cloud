/**
 * growth/community.ts â€” Community configuration.
 * WhatsApp channel is fixed; Telegram is configurable (NOT guessed).
 */

import { CommunitySettings } from "./config";

export const DEFAULT_WHATSAPP_URL = "https://whatsapp.com/channel/0029Vb8U58jIXnlsaNklwU2k";

export interface CommunityLinks {
  whatsapp: string;
  telegram: string; // "TELEGRAM_URL_NOT_CONFIGURED" until set
  telegramConfigured: boolean;
}

export function getCommunityLinks(settings?: Partial<CommunitySettings>): CommunityLinks {
  const whatsapp = settings?.whatsapp_url || DEFAULT_WHATSAPP_URL;
  const telegram = settings?.telegram_url || "TELEGRAM_URL_NOT_CONFIGURED";
  return {
    whatsapp,
    telegram,
    telegramConfigured: /^https?:/i.test(telegram) && !telegram.includes("NOT_CONFIGURED"),
  };
}

/** Default share message (editable later). */
export function defaultShareMessage(referralLink: string, lang: "ar" | "en"): string {
  const base =
    lang === "ar"
      ? "ظˆط¬ط¯طھ ط£ط¯ط§ط© طھظپط­طµ ظˆطھطµظ„ط­ ظ…ظ„ظپط§طھ DXF ظ‚ط¨ظ„ ط§ظ„ظ‚طµ ط¨ط§ظ„ظ„ظٹط²ط± ط£ظˆ CNC."
      : "Found a tool that checks and repairs DXF files before laser or CNC cutting.";
  return `${base}\n${lang === "ar" ? "ط¬ط±ظ‘ط¨ظ‡ط§ ظ…ط¬ط§ظ†ظ‹ط§:" : "Try it free:"}\n${referralLink}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}