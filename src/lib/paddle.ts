declare global {
  interface Window {
    Paddle: any;
  }
}

import { markAsSubscribed } from '@/lib/subscription';

let initialized = false;

/**
 * Plans configuration for easy tier detection and rendering
 */
const PLANS = {
  pro: {
    priceIds: ['pri_01kwe9s2cv7fb2x854jkdshw8c', 'pri_pro_monthly', 'pri_pro'],
    label: 'Pro',
    price: '$19',
  },
  workshop: {
    priceIds: ['pri_01kwe9yxzj0n4njwbncmgt8he0', 'pri_workshop_monthly', 'pri_workshop', '49'],
    label: 'ورشة',
    price: '$49',
  },
  enterprise: {
    priceIds: ['pri_enterprise_monthly', 'pri_enterprise'],
    label: 'Enterprise',
    price: '$49',
  },
} as const;

/**
 * Detect plan tier from a price ID
 */
function detectTier(priceId: string): 'pro' | 'workshop' | 'enterprise' {
  const lower = priceId.toLowerCase();
  if (PLANS.workshop.priceIds.some(id => lower.includes(id))) {
    return 'workshop';
  }
  if (PLANS.enterprise.priceIds.some(id => lower.includes(id))) {
    return 'enterprise';
  }
  return 'pro';
}

/**
 * Try to get the Paddle client token from environment
 */
function getPaddleToken(): string | null {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (token && token !== 'undefined' && token !== '') {
    return token;
  }
  return null;
}

let paddleLoadPromise: Promise<boolean> | null = null;

export function initPaddle(): Promise<boolean> {
  if (paddleLoadPromise) return paddleLoadPromise;
  if (typeof window === "undefined") return Promise.resolve(false);

  const token = getPaddleToken();
  if (!token) {
    console.log("ℹ️ No Paddle token configured");
    return Promise.resolve(false);
  }

  // Detect environment from token prefix: test_ = sandbox, live_ = production
  const isSandbox = token.startsWith('test_');
  const environment = isSandbox ? 'sandbox' : 'production';
  console.log(`🌊 Paddle environment detected: ${environment} (token prefix: ${token.slice(0, 5)}...)`);

  // If Paddle is already loaded and initialized, resolve immediately
  if (window.Paddle && window.Paddle.Checkout) {
    return Promise.resolve(true);
  }

  paddleLoadPromise = new Promise((resolve) => {
    // Load Paddle SDK
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      if (window.Paddle) {
        // Initialize Paddle with the token and environment
        window.Paddle.Initialize({
          token: token,
          environment: environment,
        });

        console.log(`✅ Paddle initialized successfully in ${environment} mode`);
        resolve(true);
      } else {
        resolve(false);
      }
    };
    script.onerror = () => {
      console.error("❌ Failed to load Paddle SDK");
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return paddleLoadPromise;
}

export async function openCheckout(priceId: string, email?: string) {
  if (!priceId || priceId === 'undefined' || priceId.trim() === '') {
    console.error("Invalid priceId:", priceId);
    alert("عذراً، معرف السعر غير صحيح.");
    return;
  }

  const tier = detectTier(priceId);
  console.log(`🌊 openCheckout called: tier=${tier}, priceId=${priceId}`);

  const token = getPaddleToken();
  if (!token) {
    console.log("ℹ️ No Paddle token — using mock checkout");
    openMockCheckout(tier, priceId, email);
    return;
  }

  // ✅ انتظر تحميل Paddle SDK بالكامل قبل فتح Checkout
  console.log("⏳ Loading Paddle SDK...");
  
  // Start loading paddle in background
  const paddlePromise = initPaddle();
  
  // Wait for paddle to load with a timeout (5 seconds max)
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      console.warn("⏰ Paddle SDK loading timed out");
      resolve(false);
    }, 5000);
  });
  
  const initialized = await Promise.race([paddlePromise, timeoutPromise]);
  
  if (!initialized || !window.Paddle) {
    console.warn("❌ Paddle SDK failed to initialize. Using mock checkout.");
    openMockCheckout(tier, priceId, email);
    return;
  }

  console.log("✅ Paddle SDK loaded, opening checkout...");

  try {
    // Paddle v2 API: `Paddle.Checkout.open()` returns a Promise
    // that resolves when checkout is completed
    const checkoutResult = await window.Paddle.Checkout.open({
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      // Optional: pre-fill customer email
      ...(email ? { customer: { email } } : {}),
    });
    
    // If we reach here, checkout was completed successfully
    console.log("✅ Paddle checkout completed for tier:", tier, checkoutResult);
    
    // Extract customer info from checkout result
    const customerEmail = checkoutResult?.customer?.email || email;
    const customerId = checkoutResult?.customer?.id;
    const transactionId = checkoutResult?.transaction?.id;
    
    markAsSubscribed(tier as 'pro' | 'workshop' | 'enterprise', customerId, transactionId, customerEmail);
    window.location.href = '/tool';
  } catch (checkoutError: any) {
    // Check if user cancelled or actual error
    if (checkoutError?.message?.includes('cancelled') || checkoutError?.message?.includes('closed')) {
      console.log("ℹ️ User cancelled checkout");
    } else {
      console.warn("⚠️ Paddle checkout error, falling back to mock:", checkoutError?.message || checkoutError);
      openMockCheckout(tier, priceId, email);
    }
  }
}

// ─── Mock Checkout (offline/local payment simulation) ───────────────

const MOCK_CHECKOUT_KEY = 'dxfix_mock_checkout';

interface MockCheckoutData {
  tier: string;
  priceId: string;
  email: string;
  name: string;
  phone: string;
  completedAt: number;
}

/**
 * Get stored mock checkout completions (for admin panel)
 */
export function getMockCheckouts(): MockCheckoutData[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const stored = localStorage.getItem(MOCK_CHECKOUT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Open a mock checkout dialog instead of real Paddle
 * This is used when Paddle token is not configured or fails
 */
function openMockCheckout(tier: string, priceId: string, email?: string) {
  const planLabels: Record<string, { name: string; price: string }> = {
    pro: { name: 'Pro', price: '$19/month' },
    workshop: { name: 'Workshop', price: '$49/month' },
    enterprise: { name: 'Enterprise', price: '$49/month' },
  };
  const plan = planLabels[tier] || { name: tier, price: '' };

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'mock-checkout-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;
    direction: rtl;
  `;
  overlay.innerHTML = `
    <div style="
      background: #0d1117; border: 1px solid rgba(0,212,255,0.3);
      border-radius: 24px; padding: 32px; max-width: 420px; width: 90%;
      box-shadow: 0 0 40px rgba(0,212,255,0.15);
      color: #e6edf3; text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
      <h3 style="font-size: 22px; font-weight: 700; margin: 0 0 8px 0;">
        اشترك في ${plan.name}
      </h3>
      <p style="font-size: 14px; color: #8b949e; margin: 0 0 4px 0;">
        ${plan.price}
      </p>
      <p style="font-size: 12px; color: #8b949e; margin: 0 0 20px 0;">
        اشترك الآن وافتح جميع الميزات
      </p>

      <div id="mock-checkout-form" style="text-align: right;">
        <label style="display: block; font-size: 12px; color: #8b949e; margin-bottom: 4px;">
          الاسم كامل
        </label>
        <input id="mock-name" type="text" placeholder="أدخل اسمك"
          style="width: 100%; padding: 10px 14px; margin-bottom: 12px;
            background: #161b22; border: 1px solid #30363d; border-radius: 10px;
            color: #e6edf3; font-size: 14px; box-sizing: border-box;" />

        <label style="display: block; font-size: 12px; color: #8b949e; margin-bottom: 4px;">
          البريد الإلكتروني
        </label>
        <input id="mock-email" type="email" value="${email || ''}" placeholder="أدخل بريدك"
          style="width: 100%; padding: 10px 14px; margin-bottom: 12px;
            background: #161b22; border: 1px solid #30363d; border-radius: 10px;
            color: #e6edf3; font-size: 14px; direction: ltr; box-sizing: border-box;" />

        <label style="display: block; font-size: 12px; color: #8b949e; margin-bottom: 4px;">
          رقم الهاتف (اختياري)
        </label>
        <input id="mock-phone" type="tel" placeholder="مثال: 07951234567"
          style="width: 100%; padding: 10px 14px; margin-bottom: 20px;
            background: #161b22; border: 1px solid #30363d; border-radius: 10px;
            color: #e6edf3; font-size: 14px; direction: ltr; box-sizing: border-box;" />

        <div style="background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.2);
          border-radius: 12px; padding: 12px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 11px; color: #8b949e; margin: 0 0 4px 0;">
            سيتم تفعيل حسابك فوراً
          </p>
          <p style="font-size: 13px; color: #00d4ff; font-weight: 600; margin: 0;">
            ${plan.price} — ${plan.name}
          </p>
        </div>

        <button id="mock-subscribe-btn"
          style="width: 100%; padding: 14px; border: none; border-radius: 12px;
            background: linear-gradient(135deg, #00d4ff, #7c3aed);
            color: white; font-size: 15px; font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,212,255,0.3); margin-bottom: 8px;">
          ✓ اشترك الآن - ${plan.price}
        </button>

        <button id="mock-cancel-btn"
          style="width: 100%; padding: 10px; border: 1px solid #30363d;
            background: transparent; border-radius: 10px;
            color: #8b949e; font-size: 13px; cursor: pointer;">
          إلغاء
        </button>
      </div>

      <div id="mock-checkout-success" style="display: none;">
        <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
        <h3 style="font-size: 22px; font-weight: 700; color: #00d4ff; margin: 0 0 8px 0;">
          تم الاشتراك بنجاح!
        </h3>
        <p style="font-size: 14px; color: #8b949e; margin: 0;">
          جارٍ تحويلك إلى الأداة...
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Add event listeners
  document.getElementById('mock-subscribe-btn')?.addEventListener('click', () => {
    const name = (document.getElementById('mock-name') as HTMLInputElement)?.value || 'مستخدم';
    const userEmail = (document.getElementById('mock-email') as HTMLInputElement)?.value || email || 'user@example.com';
    const phone = (document.getElementById('mock-phone') as HTMLInputElement)?.value || '';

    if (!userEmail) {
      (document.getElementById('mock-email') as HTMLInputElement)?.focus();
      (document.getElementById('mock-email') as HTMLInputElement)?.style.setProperty('border-color', '#ef4444');
      return;
    }

    // Save checkout data
    const checkoutData: MockCheckoutData = {
      tier,
      priceId,
      email: userEmail,
      name: name,
      phone: phone,
      completedAt: Date.now(),
    };

    try {
      const existing = getMockCheckouts();
      existing.push(checkoutData);
      localStorage.setItem(MOCK_CHECKOUT_KEY, JSON.stringify(existing));
    } catch {}

    // Mark user as subscribed
    markAsSubscribed(tier as 'pro' | 'workshop' | 'enterprise', undefined, undefined, userEmail);

    // Show success
    document.getElementById('mock-checkout-form')!.style.display = 'none';
    document.getElementById('mock-checkout-success')!.style.display = 'block';

    // Redirect after 2 seconds
    setTimeout(() => {
      document.body.removeChild(overlay);
      window.location.href = '/tool';
    }, 2000);
  });

  document.getElementById('mock-cancel-btn')?.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}