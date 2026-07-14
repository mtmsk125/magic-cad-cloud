/**
 * Subscription Authentication System
 * Client-side with server-side verification
 * 
 * كيف يشتغل؟
 * 1. المستخدم يدفع عبر Paddle → نأخذ الإيميل
 * 2. نرسل الإيميل للسيرفر (عبر API بسيط)
 * 3. السيرفر يخزن الاشتراك مع توقيع (signature)
 * 4. السيرفر يرجع token + signature
 * 5. نخزنهم في localStorage
 * 6. عند التحقق: نرسل signature للسيرفر للتحقق
 * 7. أي محاولة تزوير → signature غير صحيح → ممنوع
 */

// Main check URL - replace with your actual Vercel URL
const API_BASE = typeof window !== 'undefined' 
  ? `${window.location.origin}` 
  : '';

/**
 * Subscribe user after Paddle payment
 * This stores the subscription on the server
 */
export async function subscribeOnServer(
  email: string,
  tier: 'pro' | 'workshop' | 'enterprise'
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tier }),
    });
    
    if (!response.ok) {
      console.error('❌ Server subscription failed:', await response.text());
      return false;
    }
    
    const data = await response.json();
    
    // Store the verification data securely
    if (data.token && data.signature) {
      localStorage.setItem('dxfix_auth_token', data.token);
      localStorage.setItem('dxfix_auth_signature', data.signature);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Server subscription error:', error);
    return false;
  }
}

/**
 * Check if user is subscribed (server-verified)
 */
export async function checkServerSubscription(): Promise<{
  subscribed: boolean;
  tier: string | null;
  email?: string;
}> {
  // Check for local auth data
  const token = localStorage.getItem('dxfix_auth_token');
  const signature = localStorage.getItem('dxfix_auth_signature');
  
  if (!token || !signature) {
    return { subscribed: false, tier: null };
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, signature }),
    });
    
    const data = await response.json();
    return {
      subscribed: data.subscribed || false,
      tier: data.tier || null,
      email: data.email,
    };
  } catch (error) {
    // If server is unavailable, fallback to local check (degraded mode)
    console.warn('⚠️ Server unavailable, using local check:', error);
    const localSub = localStorage.getItem('dxfix_subscription');
    if (localSub) {
      try {
        const parsed = JSON.parse(localSub);
        return {
          subscribed: parsed.status !== null && parsed.status !== 'free',
          tier: parsed.status,
          email: parsed.email,
        };
      } catch {}
    }
    return { subscribed: false, tier: null };
  }
}

/**
 * Clear all auth data (logout/subscription expired)
 */
export function clearAuth() {
  localStorage.removeItem('dxfix_auth_token');
  localStorage.removeItem('dxfix_auth_signature');
  localStorage.removeItem('dxfix_subscription');
}