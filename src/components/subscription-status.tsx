/**
 * Subscription Status Indicator
 * Shows subscription tier and user email in UI
 */

import { useSubscription } from "@/hooks/use-subscription";

interface SubscriptionStatusProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SubscriptionStatus({ className = "", size = "sm" }: SubscriptionStatusProps) {
  const { status, data, isLoading } = useSubscription();

  if (isLoading) {
    return null;
  }

  if (!status || status === "free" || status === null) {
    return null;
  }

  const tierLabel = status === "pro" ? "Pro" : "Workshop";
  const tierColor = status === "pro" 
    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
    : "bg-purple-500/20 text-purple-300 border-purple-500/30";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div className={`flex items-center gap-2 rounded-full border ${tierColor} ${sizeClasses[size]} ${className}`}>
      <span className="w-2 h-2 rounded-full bg-current" />
      <span className="font-semibold">{tierLabel}</span>
      {data.email && (
        <span className="font-mono text-xs opacity-75">{data.email}</span>
      )}
    </div>
  );
}

/**
 * Shows full subscription details
 */
export function SubscriptionDetails() {
  const { status, data, isLoading } = useSubscription();

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">جاري التحقق من الاشتراك...</div>;
  }

  if (!status || status === "free" || status === null) {
    return (
      <div className="text-xs text-muted-foreground">
        غير مشترك • <a href="/pricing" className="text-primary hover:underline">اشترك الآن</a>
      </div>
    );
  }

  const tierLabel = status === "pro" ? "Pro" : "Workshop";

  return (
    <div className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{tierLabel}</span>
      {data.email && <span> • {data.email}</span>}
    </div>
  );
}
