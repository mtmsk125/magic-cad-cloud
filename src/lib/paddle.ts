declare global {
  interface Window {
    Paddle: any;
  }
}

let initialized = false;

export function initPaddle() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const script = document.createElement("script");
  script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
  script.async = true;
  script.onload = () => {
    if (window.Paddle) {
      window.Paddle.Setup({
        token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
      });
    }
  };
  document.head.appendChild(script);
}

export function openCheckout(priceId: string, email?: string) {
  if (!window.Paddle) {
    alert("جاري تحميل نظام الدفع... حاول مرة أخرى بعد ثانية.");
    return;
  }

  const refCode = new URLSearchParams(window.location.search).get("ref") || "";

  window.Paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    ...(refCode ? { customData: { ref: refCode } } : {}),
    settings: {
      displayMode: "overlay",
      theme: "dark",
    },
  });
}
