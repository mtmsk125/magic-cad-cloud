# Subscription System - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Application Routes (TanStack)             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  /tool (PROTECTED)                                      │   │
│  │  ├─ beforeLoad()                                        │   │
│  │  │  └─ Check subscription                              │   │
│  │  │     ├─ YES → Load component                         │   │
│  │  │     └─ NO → redirect(/?redirect=pricing)            │   │
│  │  └─ ToolPage Component (CAD Editor)                    │   │
│  │                                                         │   │
│  │  / (HOME)                                               │   │
│  │  ├─ SubscriptionPrompt (detects ?redirect=pricing)    │   │
│  │  ├─ Pricing section (#pricing)                         │   │
│  │  └─ Checkout buttons → openCheckout()                  │   │
│  │                                                         │   │
│  │  /admin (Unprotected)                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↑                                      │
│                          │                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         State Management & Hooks (React)                │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  useSubscription()                                       │  │
│  │  ├─ status: 'pro' | 'workshop' | 'free' | null         │  │
│  │  ├─ isSubscribed: boolean                               │  │
│  │  ├─ isLoading: boolean                                  │  │
│  │  ├─ data: SubscriptionData                              │  │
│  │  ├─ markAsSubscribed(tier)                              │  │
│  │  ├─ markAsFree()                                        │  │
│  │  └─ refresh()                                           │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Core Subscription Library Functions                │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  getSubscriptionData() ──────────┐                      │  │
│  │  saveSubscriptionData() ─────┐   │                      │  │
│  │  isSubscribed() ─────┐       │   │                      │  │
│  │  markAsSubscribed()  │       │   │                      │  │
│  │  markAsFree()        │       │   │                      │  │
│  │  clearData()         │       │   │                      │  │
│  │                      ↓       ↓   ↓                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Browser localStorage                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  Key: 'dxfix_subscription'                              │  │
│  │  Value: {                                               │  │
│  │    status: 'pro',                                       │  │
│  │    email: 'user@example.com',                           │  │
│  │    customerId: 'cus_xxx',                               │  │
│  │    subscriptionId: 'sub_xxx',                           │  │
│  │    lastChecked: 1703001234567                           │  │
│  │  }                                                      │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↑                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          UI Components & User Interactions              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  SubscriptionPrompt                                      │  │
│  │  ├─ Detects redirect parameter                          │  │
│  │  ├─ Shows notification banner                           │  │
│  │  └─ Auto-scrolls to pricing                             │  │
│  │                                                          │  │
│  │  SubscriptionStatus                                      │  │
│  │  └─ Displays current tier & email                       │  │
│  │                                                          │  │
│  │  ToolCtaButton                                           │  │
│  │  ├─ Checks subscription on click                        │  │
│  │  ├─ Routes to /tool if subscribed                       │  │
│  │  └─ Routes to /#pricing if not                          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Paddle Integration (Payment Processing)          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  initPaddle()                                            │  │
│  │  ├─ Loads Paddle SDK                                    │  │
│  │  └─ Calls setupPaddleCheckoutListener()                 │  │
│  │                                                          │  │
│  │  setupPaddleCheckoutListener()                           │  │
│  │  ├─ Wraps Paddle.Checkout.open()                        │  │
│  │  ├─ Listens for 'complete' event                        │  │
│  │  ├─ Calls markAsSubscribed()                            │  │
│  │  └─ Redirects to /tool                                  │  │
│  │                                                          │  │
│  │  openCheckout(priceId)                                   │  │
│  │  └─ Opens Paddle overlay with selected plan              │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↕                                      │
└─────────────────────────────────────────────────────────────────┘
                          ↕
         ┌──────────────────────────────────────────┐
         │       PADDLE PAYMENT PROCESSING          │
         ├──────────────────────────────────────────┤
         │                                          │
         │  1. Open Checkout                        │
         │  2. User enters payment info             │
         │  3. Process payment                      │
         │  4. Fire 'complete' event                │
         │  5. Pass to browser callback             │
         │                                          │
         └──────────────────────────────────────────┘
```

## Data Flow

### Access Attempt Flow
```
User Navigates to /tool
        ↓
TanStack Router beforeLoad hook executes
        ↓
getSubscriptionData() called
        ↓
Check localStorage['dxfix_subscription']
        ↓
        ├─ KEY NOT FOUND OR INVALID
        │        ↓
        │   isSubscribed() = FALSE
        │        ↓
        │   throw redirect()
        │        ↓
        └─→ Redirected to /?redirect=pricing
        
        └─ KEY FOUND & VALID
                 ↓
            isSubscribed() = TRUE
                 ↓
            beforeLoad succeeds
                 ↓
                 └─→ ToolPage component loads
```

### Checkout & Subscription Flow
```
User Clicks Plan Button
        ↓
openCheckout(priceId)
        ↓
Paddle.Checkout.open() with custom settings
        ↓
Paddle Overlay Opens
        ↓
User Completes Payment
        ↓
Payment Successful (Server confirms)
        ↓
Paddle fires 'complete' event
        ↓
setupPaddleCheckoutListener callback
        ↓
Determine tier (pro/workshop)
        ↓
markAsSubscribed(tier, email)
        ↓
        ├─ Create subscription object
        ├─ Add lastChecked timestamp
        ├─ Set 24-hour cache
        └─ Save to localStorage['dxfix_subscription']
        ↓
setTimeout(..., 1500)
        ↓
window.location.href = '/tool'
        ↓
Page reloads at /tool
        ↓
beforeLoad checks subscription
        ↓
getSubscriptionData() finds stored data
        ↓
isSubscribed() = TRUE
        ↓
Component loads normally
```

## Component Tree

```
App Root
├─ QueryClientProvider
├─ SubscriptionPrompt (from __root.tsx)
│  └─ Detects redirect parameter
│     └─ Shows notification if ?redirect=pricing
│
└─ Outlet (Routes)
   ├─ / (Home)
   │  ├─ Header with CTAs
   │  ├─ Features section
   │  ├─ Pricing section (#pricing)
   │  │  └─ Plan cards with openCheckout() buttons
   │  ├─ FAQ section
   │  └─ Testimonials
   │
   ├─ /tool (Protected Route)
   │  ├─ beforeLoad: Check subscription
   │  │  └─ If not subscribed: throw redirect()
   │  │
   │  └─ ToolPage
   │     ├─ Header
   │     │  ├─ Logo
   │     │  └─ Language toggle
   │     ├─ Upload section
   │     ├─ Analysis results
   │     ├─ Preview canvas
   │     ├─ Repair button
   │     └─ History
   │
   └─ /admin (Unprotected)
      └─ Admin dashboard
```

## Dependencies Graph

```
useSubscription Hook
    ↓
subscription.ts (Core functions)
    ├─ getSubscriptionData()
    ├─ saveSubscriptionData()
    ├─ isSubscribed()
    └─ Storage management
    
ToolPage Component (/tool)
    ├─ beforeLoad: uses isSubscribed()
    └─ Components can use useSubscription()
    
SubscriptionPrompt Component
    └─ Uses browser APIs (URLSearchParams)
    
paddle.ts (Paddle integration)
    ├─ initPaddle()
    ├─ setupPaddleCheckoutListener()
    ├─ openCheckout()
    └─ Uses markAsSubscribed() from subscription.ts
    
RootComponent
    ├─ Calls initPaddle()
    └─ Renders SubscriptionPrompt
```

## Error Handling Flow

```
Try to access /tool without subscription
        ↓
beforeLoad executes
        ↓
getSubscriptionData() called
        ↓
    ├─ localStorage error? → Return { status: null }
    ├─ JSON parse error? → Return { status: null }
    └─ Data not found? → Return { status: null }
        ↓
isSubscribed() checks status
        ↓
    └─ status === null/free → return FALSE
        ↓
throw redirect() with try-catch
        ↓
TanStack Router catches redirect
        ↓
Navigates to /?redirect=pricing
        ↓
SubscriptionPrompt component renders
```

## Security Layers

```
Layer 1: Route Level
    └─ beforeLoad guard prevents component load
    
Layer 2: Component Level
    └─ Components can check useSubscription()
    
Layer 3: Storage Level
    └─ Data stored with lastChecked timestamp
    
Layer 4: Paddle Integration
    └─ Only marks subscribed after successful payment
```

## Cache & Expiry

```
User Subscribes
    ↓
Data saved to localStorage
    └─ lastChecked = Date.now()
    
User visits site
    ↓
useSubscription() calls getSubscriptionData()
    ↓
Check: now - lastChecked < 24 hours?
    ├─ YES → Use cached data
    └─ NO → Return null (force refresh)
```

---

This architecture provides:
- ✅ Multiple layers of protection
- ✅ Efficient client-side caching
- ✅ Seamless Paddle integration
- ✅ Clean component composition
- ✅ Error resilience
