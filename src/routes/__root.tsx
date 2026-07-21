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
import { SubscriptionPrompt } from "../components/subscription-prompt";
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
      { title: "DXFix — أداة إصلاح ملفات DXF لورش CNC | مجاني" },
      { name: "description", content: "أصلح، افحص، وقيّم ملفات DXF فوراً قبل القص. مجاني خلال فترة الإطلاق لورش الليزر والبلازما والـ CNC." },
      { name: "keywords", content: "إصلاح ملفات DXF, أداة CNC عربية, برنامج تصليح DXF, DXF repair, CNC workshop, laser cutting, DXF validator, قص ليزر, ورشة CNC" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "DXFix" },
      { property: "og:title", content: "DXFix — أداة إصلاح وفحص ملفات DXF لورش CNC" },
      { property: "og:description", content: "أصلح أخطاء ملفات DXF، احصل على تقييم جاهزية القص، وصدّر ملفاً نظيفاً خلال ثوانٍ. مجاني خلال فترة الإطلاق." },
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
      // Google AdSense script — only activates for free users (gated by AdSlot component)
      { script: { src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX", crossOrigin: "anonymous", async: true } },
    ],
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

  useEffect(() => {
    initPaddle();
    inject();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SpeedInsights />
      <SubscriptionPrompt />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}