import { useEffect, useState } from "react";

/**
 * AdvertiseWithUs - زر "أعلن معنا"
 * يفتح تطبيق البريد مباشرة إلى بريد الإدارة.
 */
export default function AdvertiseWithUs({ className = "" }: { className?: string }) {
  return (
    <a
      href="mailto:mtmsk125@yahoo.com?subject=%D8%A5%D8%B9%D9%84%D8%A7%D9%86%20%D9%85%D8%B9%D9%86%D8%A7%20-%20Magic%20CAD%20Cloud"
      className={"inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20 hover:border-amber-400/60 " + className}
      aria-label="أعلن معنا عبر البريد الإلكتروني"
    >
      <span aria-hidden="true">📢</span>
      أعلن معنا
    </a>
  );
}
