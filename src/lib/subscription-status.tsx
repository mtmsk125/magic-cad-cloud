/**
 * usePremiumStatus Hook
 * The tool is now 100% free — no subscriptions exist.
 * This hook always returns isPremium: false so ads always show.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import type { SubscriptionData } from "@/lib/subscription";

export interface UsePremiumStatusReturn {
  isPremium: boolean;
  isLoading: boolean;
  data: SubscriptionData;
  refresh: () => void;
}

/**
 * usePremiumStatus
 *
 * The tool is 100% free for everyone. No subscriptions, no paywalls.
 * isPremium is always false so ads are always displayed.
 */
export function usePremiumStatus(): UsePremiumStatusReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(() => {
    // No-op — tool is always free
  }, []);

  return {
    isPremium: false,
    isLoading: isClient ? false : true,
    data: { status: null },
    refresh,
  };
}