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
    console.log("ℹ️ No Paddle token configured");
    return;
  }

  // Load Paddle SDK
  const script = document.createElement("script");
  script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
  script.async = true;
  script.onload = () => {
    if (window.Paddle) {
      // Always set environment to production
      window.Paddle.Environment.set('production');

      // Initialize Paddle with the token
      window.Paddle.Initialize({
        token: token,
      });

      console.log(`✅ Paddle initialized successfully in production mode`);
    }
  };
  script.onerror = () => {
    console.error("❌ Failed to load Paddle SDK");
  };
  document.head.appendChild(script);
}

export function openCheckout(priceId: string, email?: string) {
  if (!priceId || priceId === 'undefined' || priceId.trim() === '') {
    console.error("Invalid priceId:", priceId);
    alert("عذراً، معرف السعر غير صحيح.");
    return;
  }

  const tier = detectTier(priceId);
  console.log(`🌊 openCheckout called: tier=${tier}, priceId=${priceId}`);

  const token = getPaddleToken();
  if (!token) {
    console.error("❌ No Paddle client token available. Cannot open checkout.");
    alert("عذراً، لم يتم إعداد الدفع بعد. يرجى المحاولة لاحقاً.");
    return;
  }

  // Ensure Paddle is initialized
  initPaddle();

  // Check if Paddle SDK is loaded, if not wait for it
  const attemptOpen = (retries: number) => {
    if (window.Paddle && window.Paddle.Checkout) {
      window.Paddle.Checkout.open({
        settings: {
          displayMode: "overlay",
          theme: "light",
        },
        items: [
          {
            priceId: priceId,
            quantity: 1,
          },
        ],
        eventCallback: (event: any) => {
          if (event.name === 'checkout-completed') {
            console.log("✅ Paddle checkout completed for tier:", tier);
            markAsSubscribed(tier, event.data?.customer?.id, event.data?.transaction?.id, email || event.data?.customer?.email);
            window.location.href = '/tool';
          }
        },
      });
    } else if (retries > 0) {
      console.log(`⏳ Waiting for Paddle SDK to load... (${retries} retries left)`);
      setTimeout(() => attemptOpen(retries - 1), 500);
    } else {
      console.error("❌ Paddle SDK failed to load after multiple retries");
      alert("عذراً، حدث خطأ في تحميل نظام الدفع. يرجى المحاولة مرة أخرى.");
    }
  };

  // Give the SDK time to load (up to 3 seconds with retries)
  setTimeout(() => attemptOpen(5), 500);
}
