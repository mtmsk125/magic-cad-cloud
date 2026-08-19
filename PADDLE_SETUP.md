# ============================================================
# Paddle Checkout — Setup Guide
# ============================================================
# This project uses Paddle Checkout (v2) for subscription and per-file
# payments. To activate it you only need a few environment variables.
#
# ── 1. Client side (browser) ─────────────────────────────────
# Create / update `.env` (Vite) with your Paddle CLIENT-side token:
#
#   VITE_PADDLE_CLIENT_TOKEN=  (e.g. test_<...your sandbox token>)
#
# The SDK is auto-loaded from https://cdn.paddle.com/paddle/v2/paddle.js
# and `window.Paddle.Initialize({ token })` is called. The token prefix
# decides the environment automatically:
#     test_  -> sandbox   (https://sandbox.paddle.com)
#     live_  -> production
#
# ── 2. Product / Price IDs ───────────────────────────────────
# The plans are declared in `src/lib/paddle.ts` (PLANS object) with the
# price IDs / aliases used to detect the tier at checkout completion:
#
#     monthly  -> $7 /month   (pri_01kwe9s2cv7fb2x854jkdshw8c | pri_pro_monthly | pri_pro)
#     perFile  -> $2 /file    (pri_per_file | pri_pay_per_file)
#     workshop -> $10 /month  (pri_workshop_monthly | pri_workshop)
#
# Replace these placeholders with your REAL Paddle price IDs (Checkout
# passes `checkout.completed → data.items[].price.id`). detectTier()
# matches a price ID against these aliases (case-insensitive `includes`).
#
# ── 3. "Buy me a coffee" / support tip ───────────────────────
# Optional. Defaults to a placeholder price ID. Override with your own:
#
#   VITE_COFEE=pri_your_support_price_id
# (env var is read in openBuyCoffeeCheckout()).
#
# ── 4. Server side (webhook verification) ────────────────────
# For robust server-side verification of checkout events, expose:
#
#   PADDLE_VENDOR_ID=<your vendor id>
#   PADDLE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...      # PEM
#   PADDLE_SECRET_CODE=<webhook secret for signature check>
#
# (Currently the app trusts the client-side Paddle callback; add
# subscription-auth.ts server verification when you want full security.)
#
# ── 5. Quick checklist ───────────────────────────────────────
#  [ ] Client token (VITE_PADDLE_CLIENT_TOKEN) set
#  [ ] Price IDs in PLANS match your Paddle Dashboard
#  [ ] (Optional) VITE_COFEE support price ID
#  [ ] (Optional) Server keys for webhook verification
#  [ ] Test flow end-to-end in sandbox (test_ token)
#
# After the first real checkout, `markAsSubscribed(tier)` + Paddle
# event listeners in subscription.ts record the user so the
# `isSubscribed()` gate in src/routes/tool.tsx lets them use the tool.
# ============================================================
