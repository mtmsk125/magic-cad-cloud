/**
 * usePremiumStatus Hook
 * Examines current client session/storage to determine if the user
 * is a paying customer (premium) or free user.
 *
 * Returns `true` for:
 *   - $7/month (pro) subscribers
 *   - $10/month (workshop) subscribers
 *   - $2 one-time (per-file) payers
 *   - lifetime / enterprise subscribers
 *   - viral-launch unlocked users
 *
 * Returns `false` for free / unsubscribed users.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSubscriptionData,
  isSubscribed,
  hasPerFilePayment,
  type SubscriptionData,
} from "@/lib/subscription";

export interface UsePremiumStatusReturn {
  isPremium: boolean;
  isLoading: boolean;
  data: SubscriptionData;
  refresh: () => void;
}

/**
 * usePremiumStatus
 *
 * A drop-in hook that consolidates all "is this user premium?" logic.
 * - isPremium === true → hide ads, grant full access
 * - isPremium === false → show ads, gate features
 */
export function usePremiumStatus(): UsePremiumStatusReturn {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData>({ status: null });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const check = useCallback(() => {
    if (!isClient) return;
    try {
      const subData = getSubscriptionData();
      setData(subData);

      // Premium if:
      // 1. Subscription data says subscribed (pro, workshop, monthly, lifetime, enterprise, per-file)
      // 2. Per-file payment is active (24h window)
      // 3. Viral unlock bypass is active
      const subscriptionActive = isSubscribed(subData);
      const perFileActive = hasPerFilePayment();
      const viralBypass =
        typeof window !== "undefined" &&
        window.localStorage?.getItem("dxfix_user_is_subscribed") === "true";

      const premium = subscriptionActive || perFileActive || viralBypass;
      setIsPremium(premium);
    } catch (e) {
      console.warn("usePremiumStatus: check failed", e);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient) {
      check();
    }
  }, [isClient, check]);

  return {
    isPremium: isClient ? isPremium : false,
    isLoading: isClient ? isLoading : true,
    data,
    refresh: check,
  };
}