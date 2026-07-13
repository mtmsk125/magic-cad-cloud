
# Subscription Protection System

## Overview
This document describes the subscription protection system implemented for DXFix. It ensures that only subscribed users can access the CAD Editor/Viewer tool.

## Architecture

### Components

#### 1. **Subscription Management Library** (`src/lib/subscription.ts`)
- Core utility functions for managing subscription state
- **Key Functions:**
  - `getSubscriptionData()` - Retrieves subscription status from localStorage
  - `saveSubscriptionData()` - Persists subscription state
  - `isSubscribed()` - Checks if user has an active subscription
  - `markAsSubscribed(tier, email)` - Marks user as subscribed
  - `markAsFree()` - Marks user as non-subscribed
  - `clearSubscriptionData()` - Clears all stored subscription data

#### 2. **Subscription Hook** (`src/hooks/use-subscription.tsx`)
- React hook for components to interact with subscription system
- **Returns:**
  - `status` - Current subscription tier ('free', 'pro', 'workshop', null)
  - `isSubscribed` - Boolean indicating if user has subscription
  - `isLoading` - Loading state
  - `data` - Full subscription data object
  - `markAsSubscribed()` - Function to mark user as subscribed
  - `markAsFree()` - Function to mark user as free plan
  - `refresh()` - Refresh subscription status

#### 3. **Route Protection** (`src/routes/tool.tsx`)
- Tool route has `beforeLoad` guard that:
  - Checks subscription status before loading component
  - Redirects to `/?redirect=pricing` if not subscribed
  - Throws redirect to prevent component render

#### 4. **Paddle Integration** (`src/lib/paddle.ts`)
- Enhanced to automatically mark users as subscribed after checkout
- **Behavior:**
  - Listens for Paddle checkout completion
  - Determines subscription tier (pro/workshop)
  - Calls `markAsSubscribed()` with tier and email
  - Redirects user to `/tool` after 1.5s delay

#### 5. **Subscription Prompt** (`src/components/subscription-prompt.tsx`)
- Banner component shown when user is redirected from tool attempt
- **Features:**
  - Detects `?redirect=pricing` parameter
  - Scrolls to pricing section automatically
  - Dismissible with close button

#### 6. **Subscription Status Indicators** (`src/components/subscription-status.tsx`)
- Display components for showing subscription status
- **Components:**
  - `SubscriptionStatus` - Compact status badge
  - `SubscriptionDetails` - Detailed status information

## Flow Diagrams

### Unsubscribed User Attempts to Access Tool
```
User clicks "ابدأ" → href="/tool"
                    ↓
        /tool beforeLoad executes
                    ↓
        Checks: getSubscriptionData()
                    ↓
            isSubscribed() = false
                    ↓
        throw redirect(/?redirect=pricing)
                    ↓
        User redirected to home
                    ↓
        SubscriptionPrompt detects redirect param
                    ↓
        Shows banner + scrolls to #pricing
                    ↓
        User sees pricing section
```

### User Completes Subscription
```
User clicks pricing CTA → openCheckout(priceId)
                    ↓
        Paddle checkout overlay opens
                    ↓
        User enters payment info
                    ↓
        Payment successful
                    ↓
        Paddle fires 'complete' event
                    ↓
        markAsSubscribed() called
        localStorage updated with:
        - status: 'pro' | 'workshop'
        - email: user@example.com
        - lastChecked: Date.now()
                    ↓
        window.location.href = '/tool'
                    ↓
        /tool beforeLoad executes
                    ↓
        Checks: getSubscriptionData()
                    ↓
            isSubscribed() = true
                    ↓
        Guard passes, component renders
                    ↓
        User sees CAD tool
```

### Subscribed User Accesses Tool Directly
```
User navigates to /tool
        (already subscribed in localStorage)
                    ↓
        /tool beforeLoad executes
                    ↓
        Checks: getSubscriptionData()
                    ↓
            isSubscribed() = true
                    ↓
        Guard passes, component renders
                    ↓
        User sees CAD tool
```

## Storage Schema

### localStorage Key: `dxfix_subscription`

```json
{
  "status": "pro" | "workshop" | "free" | null,
  "customerId": "string (optional)",
  "subscriptionId": "string (optional)",
  "email": "user@example.com (optional)",
  "expiresAt": 1234567890000,
  "lastChecked": 1234567890000
}
```

## Implementation Details

### Cache Expiration
- Subscription data cached for 24 hours
- After expiry, `getSubscriptionData()` returns empty to force fresh check
- Can be refreshed manually via `useSubscription().refresh()`

### Error Handling
- If Paddle fails to load, users see: "جاري تحميل نظام الدفع... حاول مرة أخرى بعد ثانية."
- If localStorage unavailable, falls back gracefully to null status
- JSON parsing errors in localStorage caught and logged

### Security Considerations
1. **Client-Side Only:** Subscription status stored in browser localStorage
2. **Server-Side Verification:** In production, server-side API should verify subscription with Paddle API
3. **Webhook Validation:** Implement Paddle webhooks for real-time subscription updates
4. **API Protection:** Backend endpoints should independently verify subscription status

## Integration Points

### Paddle Events
- `window.Paddle.Checkout.addEventListener('complete', ...)`
- Listens for successful transactions

### Routes
- **Home:** `/` - No restriction
- **Tool:** `/tool` - Protected by `beforeLoad`
- **Admin:** `/admin` - Currently unprotected

### Environment Variables
- `VITE_PADDLE_CLIENT_TOKEN` - Paddle public API token
- `VITE_PADDLE_PRO_PRICE_ID` - Price ID for Pro tier
- `VITE_PADDLE_WORKSHOP_PRICE_ID` - Price ID for Workshop tier

## Testing

### Test Subscription Flow
1. Clear localStorage: `localStorage.removeItem('dxfix_subscription')`
2. Try to access `/tool` → should redirect to `/?redirect=pricing`
3. Manually set subscription: 
   ```javascript
   localStorage.setItem('dxfix_subscription', JSON.stringify({
     status: 'pro',
     email: 'test@example.com'
   }))
   ```
4. Refresh page → should access `/tool` normally

### Test Paid Checkout
1. Use Paddle's test cards (if available)
2. Complete checkout flow
3. Check localStorage for updated subscription
4. Verify redirect to `/tool`

## Future Enhancements

1. **Server-Side Verification**
   - Add API endpoint to verify subscription with Paddle
   - Called on `/tool` beforeLoad for authority

2. **Webhook Integration**
   - Implement Paddle webhooks for subscription events
   - Update backend database on subscription/cancellation

3. **Auto-Refresh**
   - Implement periodic refresh of subscription status
   - Check validity when cache expires

4. **User Accounts**
   - Create user management system
   - Link subscriptions to user profiles
   - Track subscription history

5. **Trial Period**
   - Add configurable free trial
   - Auto-expire trial after X days
   - Show trial countdown

6. **Cancellation Handling**
   - Listen for cancellation webhooks
   - Clear subscription status
   - Show retention offers

## Troubleshooting

### Issue: Users can still access `/tool` without subscription
**Solution:** Ensure `beforeLoad` in `tool.tsx` is properly configured and redirect is being thrown

### Issue: Subscription not persisting after checkout
**Solution:** Check browser localStorage access, verify Paddle event listeners are registered

### Issue: Paddle overlay not showing
**Solution:** Verify `VITE_PADDLE_CLIENT_TOKEN` is set, check browser console for errors

### Issue: Users not redirected to `/tool` after checkout
**Solution:** Verify `markAsSubscribed()` is called, check browser history/navigation
