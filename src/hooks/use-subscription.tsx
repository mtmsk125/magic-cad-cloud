/**
 * useSubscription Hook
 * React hook for checking and managing user subscription status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSubscriptionData,
  saveSubscriptionData,
  isSubscribed as checkIsSubscribed,
  type SubscriptionStatus,
  type SubscriptionData,
} from '@/lib/subscription';

export interface UseSubscriptionReturn {
  status: SubscriptionStatus;
  isSubscribed: boolean;
  isLoading: boolean;
  data: SubscriptionData;
  markAsSubscribed: (tier: 'pro' | 'workshop', email?: string) => void;
  markAsFree: () => void;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData>({ status: null });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side
    setIsClient(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!isClient) return;
    setIsLoading(true);
    try {
      const freshData = getSubscriptionData();
      setData(freshData);
      setStatus(freshData.status);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient) {
      refresh();
    }
  }, [isClient, refresh]);

  const markAsSubscribed = useCallback((tier: 'pro' | 'workshop', email?: string) => {
    const newData: SubscriptionData = {
      status: tier,
      email,
      lastChecked: Date.now(),
    };
    saveSubscriptionData(newData);
    setData(newData);
    setStatus(tier);
  }, []);

  const markAsFree = useCallback(() => {
    const newData: SubscriptionData = {
      status: 'free',
      lastChecked: Date.now(),
    };
    saveSubscriptionData(newData);
    setData(newData);
    setStatus('free');
  }, []);

  return {
    status,
    isSubscribed: isClient ? checkIsSubscribed(data) : false,
    isLoading: isClient ? isLoading : true,
    data,
    markAsSubscribed,
    markAsFree,
    refresh,
  };
}
