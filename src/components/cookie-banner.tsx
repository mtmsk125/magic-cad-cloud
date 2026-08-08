import React, { useEffect, useState } from 'react';

export default function CookieBanner() {
  const [accepted, setAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dxfix_cookies_accepted') === '1';
    } catch { return false; }
  });

  useEffect(() => {
    if (accepted) {
      try { localStorage.setItem('dxfix_cookies_accepted', '1'); } catch {}
    }
  }, [accepted]);

  if (accepted) return null;

  return (
    <div style={{ position: 'fixed', right: 16, left: 16, bottom: 16, zIndex: 9999 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', background: '#0f1724', color: 'white', padding: '12px 16px', borderRadius: 12, boxShadow: '0 6px 30px rgba(2,6,23,0.6)', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14 }}>
          نستخدم ملفات تعريف الارتباط لتحسين تجربتك ولعرض إعلانات مناسبة. بموافقتك نستخدم خدمات طرف ثالث مثل Google AdSense.
          <div style={{ opacity: 0.85, marginTop: 6, fontSize: 12 }}>
            يمكنك قراءة <a href="/privacy" style={{ color: '#7dd3fc' }}>سياسة الخصوصية</a> لمزيد من التفاصيل.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => {
            setAccepted(true);
            try { localStorage.setItem('dxfix_cookies_accepted', '1'); } catch {}
            try { window.dispatchEvent(new Event('dxfix-cookies-accepted')); } catch {}
          }} style={{ background: '#10b981', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none', fontWeight: 600 }}>أوافق</button>
          <a href="/privacy" style={{ alignSelf: 'center', color: '#94a3b8', textDecoration: 'underline' }}>إعدادات</a>
        </div>
      </div>
    </div>
  );
}
