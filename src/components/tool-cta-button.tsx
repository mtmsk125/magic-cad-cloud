/**
 * Smart Tool CTA Button
 * Routes to /tool if subscribed, otherwise shows pricing
 */

import { useSubscription } from "@/hooks/use-subscription";
import { useNavigate } from "@tanstack/react-router";

interface ToolCtaButtonProps {
  text: string;
  className?: string;
  arrowDirectionRTL?: boolean;
}

export function ToolCtaButton({
  text,
  className = "",
  arrowDirectionRTL = false,
}: ToolCtaButtonProps) {
  const { isSubscribed, isLoading } = useSubscription();
  const navigate = useNavigate();

  const handleClick = async () => {
    if (isLoading) {
      // Still checking, wait a moment
      setTimeout(handleClick, 200);
      return;
    }

    if (isSubscribed) {
      // User is subscribed, go to tool
      await navigate({ to: "/tool" });
    } else {
      // User is not subscribed, go to pricing page
      await navigate({ to: "/pricing", search: { redirect: "tool" } });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={className}
    >
      {text}
      <span aria-hidden>{arrowDirectionRTL ? "←" : "→"}</span>
    </button>
  );
}

/**
 * Link version of the CTA button
 */
export function ToolCtaLink({
  text,
  className = "",
  arrowDirectionRTL = false,
}: ToolCtaButtonProps) {
  const { isSubscribed } = useSubscription();

  return (
    <a
      href={isSubscribed ? "/tool" : "/pricing"}
      className={className}
    >
      {text}
      <span aria-hidden>{arrowDirectionRTL ? "←" : "→"}</span>
    </a>
  );
}
