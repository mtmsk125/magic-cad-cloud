import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initPaddle } from "../lib/paddle";
import { PwaInstallPrompt } from "../components/pwa-install-prompt";
import { getLangDir, type Lang } from "../lib/i18n";
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function getInitialLang(): Lang {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("dxfix_lang") as Lang | null;
    if (stored && ["ar", "en", "fr", "zh"].includes(stored)) return stored;
  }
  return "ar";
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DXFix — أداة إصلاح وفحص ملفات DXF لورش CNC" },
      { name: "description", content: "أصلح، افحص، وقيّم ملفات DXF فوراً قبل القص لورش الليزر والبلازما والـ CNC بكفاءة عالية." },
      { name: "keywords", content: "إصلاح ملفات DXF, أداة CNC عربية, برنامج تصليح DXF, DXF repair, CNC workshop, laser cutting, DXF validator, قص ليزر, ورشة CNC" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "DXFix" },
      { property: "og:title", content: "DXFix — أداة إصلاح وفحص ملفات DXF لورش CNC" },
      { property: "og:description", content: "أصلح أخطاء ملفات DXF، احصل على تقييم جاهزية القص، وصدّر ملفاً نظيفاً خلال ثوانٍ بكفاءة واحترافية." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:site_name", content: "DXFix" },
      { property: "og:image", content: "https://dxfix.com/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DXFix — أداة إصلاح ملفات DXF لورش CNC" },
      { name: "twitter:description", content: "أصلح أخطاء ملفات DXF وصدّر ملفاً نظيفاً خلال ثوانٍ. مجاني." },
      { name: "twitter:image", content: "https://dxfix.com/og-image.png" },
      // Google AdSense account verification
      { name: "google-adsense-account", content: "ca-pub-8107638298388341" },
      // ═══════════════════════════════════════════════════════════════
      // PAGE HUNT VERIFICATION — أضف كود التحقق من Page Hunt هنا
      // اذهب إلى https://page-hunt.com وانسخ الكود، ثم أضفه في السطر التالي
      // مثال: { name: "page-hunt-verification", content: "XXXXXXXXXX" },
      // ═══════════════════════════════════════════════════════════════
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" } as any,
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" },
      { rel: "canonical", href: "https://dxfix.com/" },
      { rel: "alternate", hrefLang: "ar", href: "https://dxfix.com/" },
      { rel: "alternate", hrefLang: "en", href: "https://dxfix.com/en" },
      { rel: "alternate", hrefLang: "x-default", href: "https://dxfix.com/" },
      // PWA manifest for mobile install
      { rel: "manifest", href: "/manifest.json" },
      // Apple touch icon for iOS home screen
      { rel: "apple-touch-icon", href: "/assets/hero-cnc.jpg" },
      { name: "apple-mobile-web-app-capable", content: "yes" } as any,
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" } as any,
      { name: "apple-mobile-web-app-title", content: "DXFix" } as any,
    ],
    // ⚠️ AdSense script removed from SSR head() — moved to client-side useEffect
    // in RootComponent to fix React #419 hydration errors
    scripts: [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const dir = getLangDir(lang);

  // Listen for language changes from child routes (via custom event)
  useEffect(() => {
    const handleLangChange = (e: CustomEvent) => {
      const newLang = e.detail as Lang;
      if (["ar", "en", "fr", "zh"].includes(newLang)) {
        setLang(newLang);
      }
    };
    window.addEventListener("dxfix-lang-change" as any, handleLangChange as any);
    return () => window.removeEventListener("dxfix-lang-change" as any, handleLangChange as any);
  }, []);

  return (
    <html lang={lang} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [isMounted, setIsMounted] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dxfix_lang") as Lang | null;
      if (stored && ["ar", "en", "fr", "zh"].includes(stored)) return stored;
    }
    return "ar";
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    initPaddle();

    // Load AdSense script client-side only (fixes React #419 hydration error)
    const adSenseId = import.meta.env.VITE_ADSENSE_CLIENT_ID || "ca-pub-8107638298388341";
    if (!document.querySelector(`script[src*="adsbygoogle.js"]`)) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseId}`;
      script.crossOrigin = "anonymous";
      script.async = true;
      document.head.appendChild(script);
    }

    // Load Monetag Popunder ad script (Zone ID 11396333)
    if (!document.querySelector(`script[data-zone="11396333"]`)) {
      const monetagScript = document.createElement("script");
      monetagScript.src = "https://alwingulla.com/88/tag.min.js";
      monetagScript.setAttribute("data-zone", "11396333");
      monetagScript.async = true;
      monetagScript.setAttribute("data-cfasync", "false");
      document.head.appendChild(monetagScript);
    }

    // Skip Vercel Analytics for personal visits and testing traffic
    // This prevents inflating analytics with developer/owner page views
    const shouldSkipAnalytics =
      typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.search.includes('admin=true') ||
        window.location.search.includes('skip_analytics=1') ||
        window.location.search.includes('debug=true') ||
        localStorage.getItem('dxfix_skip_analytics') === 'true'
      );

    if (!shouldSkipAnalytics) {
      inject();
    }
  }, [isMounted]);

  // Listen for language changes
  useEffect(() => {
    const handleLangChange = (e: CustomEvent) => {
      const newLang = e.detail as Lang;
      if (["ar", "en", "fr", "zh"].includes(newLang)) {
        setLang(newLang);
      }
    };
    window.addEventListener("dxfix-lang-change" as any, handleLangChange as any);
    return () => window.removeEventListener("dxfix-lang-change" as any, handleLangChange as any);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SpeedInsights />
      <PwaInstallPrompt lang={lang === "ar" ? "ar" : "en"} />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
