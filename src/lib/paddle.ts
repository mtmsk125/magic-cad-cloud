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
    priceIds: ['pri_pro_monthly', 'pri_pro'],
    label: 'Pro',
    price: '$19',
  },
  workshop: {
    priceIds: ['pri_workshop_monthly', 'pri_workshop', '49'],
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

export function initPaddle() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const token = getPaddleToken();
  if (!token) {
    console.log("ℹ️ No Paddle token configured - will show mock checkout in development");
    return;
  }

  // Load Paddle SDK
  const script = document.createElement("script");
  script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
  script.async = true;
  script.onload = () => {
    if (window.Paddle) {
      // Detect environment from token prefix: test_ = sandbox, live_ = production
      const isSandboxToken = token.startsWith('test_');
      const environment = isSandboxToken ? "sandbox" : "live";
      console.log(`🌊 Initializing Paddle in ${environment} mode (token: ${token.substring(0, 5)}...)`);

      // Set sandbox environment only if the token is a test token
      if (isSandboxToken) {
        window.Paddle.Environment.set('sandbox');
      }

      // Initialize Paddle with the token
      window.Paddle.Initialize({
        token: token,
      });

      console.log(`✅ Paddle initialized successfully`);
    }
  };
  script.onerror = () => {
    console.error("❌ Failed to load Paddle SDK");
  };
  document.head.appendChild(script);
}

/**
 * Show a mock checkout modal that mimics Paddle's payment UI
 * Used when Paddle SDK is not available (e.g. during development)
 */
function showMockCheckout(priceId: string, onComplete: () => void) {
  const tier = detectTier(priceId);
  const planInfo = PLANS[tier];
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'mock-paddle-checkout';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; font-family: 'Space Grotesk', sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      background: #11161e; border: 1px solid #1e293b;
      border-radius: 16px; max-width: 420px; width: 100%;
      padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: fadeIn 0.3s ease;
      direction: rtl;
    ">
      <style>
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mock-input { 
          background: #0b0e14; border: 1px solid #1e293b;
          color: #e8edf5; padding: 12px 14px; border-radius: 8px;
          font-size: 14px; width: 100%; outline: none; transition: border-color 0.2s;
          box-sizing: border-box; font-family: 'JetBrains Mono', monospace;
        }
        .mock-input:focus { border-color: #10b981; }
        .mock-input::placeholder { color: #4a5568; }
        .mock-btn {
          width: 100%; padding: 14px; border: none; border-radius: 8px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          background: #10b981; color: #0b0e14; transition: opacity 0.2s;
          font-family: 'Space Grotesk', sans-serif;
        }
        .mock-btn:hover { opacity: 0.9; }
        .mock-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mock-row { margin-bottom: 16px; }
        .mock-label { 
          display: block; font-size: 12px; color: #8b95a5;
          margin-bottom: 6px; font-weight: 500;
        }
        .mock-badge {
          background: #10b98120; color: #10b981; border: 1px solid #10b98140;
          padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;
        }
        .mock-price {
          display: flex; align-items: baseline; gap: 4px;
        }
        .mock-price-amount { font-size: 36px; font-weight: 700; color: #e8edf5; }
        .mock-price-period { font-size: 14px; color: #8b95a5; }
      </style>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #e8edf5;">💳 الدفع</span>
        <span class="mock-badge">Sandbox تجريبي</span>
      </div>

      <div style="text-align: center; margin-bottom: 24px; padding: 16px; background: #10b98110; border-radius: 12px; border: 1px solid #10b98120;">
        <div style="font-size: 14px; color: #8b95a5;">الخطة المختارة</div>
        <div style="font-size: 18px; font-weight: 600; color: #e8edf5; margin-top: 4px;">${planInfo.label}</div>
        <div class="mock-price" style="justify-content: center; margin-top: 8px;">
          <span class="mock-price-amount">${planInfo.price}</span>
          <span class="mock-price-period">/ شهرياً</span>
        </div>
      </div>

      <div class="mock-row">
        <label class="mock-label">رقم البطاقة</label>
        <input class="mock-input" id="mock-card" value="4242 4242 4242 4242" placeholder="1234 5678 9012 3456" style="direction: ltr; text-align: left;">
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="mock-row" style="margin-bottom: 0;">
          <label class="mock-label">تاريخ الانتهاء</label>
          <input class="mock-input" id="mock-expiry" value="12/28" placeholder="MM/YY" style="direction: ltr; text-align: left;">
        </div>
        <div class="mock-row" style="margin-bottom: 0;">
          <label class="mock-label">CVV</label>
          <input class="mock-input" id="mock-cvv" value="123" placeholder="123" style="direction: ltr; text-align: left;">
        </div>
      </div>

      <div style="margin-top: 8px; margin-bottom: 20px;">
        <label class="mock-label">اسم حامل البطاقة</label>
        <input class="mock-input" id="mock-name" value="Test User" placeholder="الاسم على البطاقة" style="direction: rtl; text-align: right;">
      </div>

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button id="mock-cancel" style="
          flex: 1; padding: 14px; border: 1px solid #1e293b; border-radius: 8px;
          background: transparent; color: #8b95a5; font-size: 14px; cursor: pointer;
          font-weight: 500; transition: background 0.2s;
        " onmouseover="this.style.background='#1a2230'" onmouseout="this.style.background='transparent'">
          إلغاء
        </button>
        <button id="mock-pay" class="mock-btn">
          ✓ ادفع الآن
        </button>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: #1a2230; border-radius: 8px; font-size: 12px; color: #8b95a5; text-align: center; line-height: 1.6;">
        🧪 <strong>وضع تجريبي</strong> — استخدم بيانات البطاقة التجريبية أعلاه<br>
        <span style="color: #10b981;">هذه محاكاة للدفع، لن يتم خصم أي مبلغ حقيقي</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const payBtn = document.getElementById('mock-pay')!;
  const cancelBtn = document.getElementById('mock-cancel')!;

  const simulatePayment = () => {
    (payBtn as HTMLButtonElement).disabled = true;
    payBtn.textContent = '⏳ جاري المعالجة...';
    
    setTimeout(() => {
      document.body.removeChild(overlay);
      onComplete();
    }, 2500);
  };

  payBtn.addEventListener('click', simulatePayment);
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', handler);
      document.body.removeChild(overlay);
    }
  });
}

export function openCheckout(priceId: string, email?: string) {
  if (!priceId || priceId === 'undefined' || priceId.trim() === '') {
    console.error("Invalid priceId:", priceId);
    alert("عذراً، معرف السعر غير صحيح.");
    return;
  }

  const tier = detectTier(priceId);
  console.log(`🌊 openCheckout called: tier=${tier}, priceId=${priceId}`);

  // Check if real Paddle token is available for actual payments
  const token = getPaddleToken();
  const hasRealPaddle = token !== null;
  
  if (hasRealPaddle) {
    // Use real Paddle checkout
    console.log("🌊 Using real Paddle checkout for tier:", tier, "priceId:", priceId);
    
    // Ensure Paddle is initialized
    initPaddle();
    
    // Small delay to ensure Paddle SDK is loaded
    setTimeout(() => {
      if (window.Paddle && window.Paddle.Checkout) {
        window.Paddle.Checkout.open({
          items: [{ priceId: priceId, quantity: 1 }],
          customer: email ? { email } : undefined,
          settings: {
            allowLogout: false,
            displayMode: 'overlay',
            theme: 'dark',
          },
          eventCallback: (event: any) => {
            if (event.name === 'checkout-completed') {
              console.log("✅ Paddle checkout completed for tier:", tier);
              markAsSubscribed(tier, event.data?.customer?.id, event.data?.transaction?.id, email || event.data?.customer?.email);
              window.location.href = '/tool';
            }
          },
        });
      } else {
        console.warn("⚠️ Paddle SDK not loaded yet, falling back to mock checkout");
        showMockCheckout(priceId, () => {
          markAsSubscribed(tier, undefined, undefined, email);
          console.log("✅ Mock checkout complete - redirecting to /tool");
          window.location.href = '/tool';
        });
      }
    }, 1000); // 1 second delay for Paddle SDK to initialize
  } else {
    // No real Paddle token - use mock checkout for development
    console.log("🧪 Using mock checkout (no Paddle token configured) for tier:", tier, "priceId:", priceId);
    
    showMockCheckout(priceId, () => {
      markAsSubscribed(tier, undefined, undefined, email);
      console.log("✅ Mock checkout complete - redirecting to /tool");
      window.location.href = '/tool';
    });
  }
}
