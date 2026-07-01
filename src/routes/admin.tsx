import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

const ADMIN_PASSWORD = "dxfix2026";

const getPaddleStats = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return { error: "PADDLE_API_KEY not configured" };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const base = "https://api.paddle.com";

  try {
    const [subsRes, txRes] = await Promise.all([
      fetch(`${base}/subscriptions?per_page=200&status=active`, { headers }),
      fetch(`${base}/transactions?per_page=200&status=completed`, { headers }),
    ]);

    const subsData = subsRes.ok ? await subsRes.json() : { data: [] };
    const txData = txRes.ok ? await txRes.json() : { data: [] };

    const subs: any[] = subsData.data ?? [];
    const txs: any[] = txData.data ?? [];

    const proPriceId = process.env.VITE_PADDLE_PRO_PRICE_ID ?? "";
    const workshopPriceId = process.env.VITE_PADDLE_WORKSHOP_PRICE_ID ?? "";

    const proSubs = subs.filter((s) =>
      s.items?.some((i: any) => i.price?.id === proPriceId)
    );
    const workshopSubs = subs.filter((s) =>
      s.items?.some((i: any) => i.price?.id === workshopPriceId)
    );

    const totalRevenue = txs.reduce((acc: number, tx: any) => {
      return acc + parseFloat(tx.details?.totals?.total ?? "0") / 100;
    }, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthlyRevenue = txs
      .filter((tx: any) => new Date(tx.created_at) >= thisMonth)
      .reduce((acc: number, tx: any) => {
        return acc + parseFloat(tx.details?.totals?.total ?? "0") / 100;
      }, 0);

    return {
      activeSubs: subs.length,
      proSubs: proSubs.length,
      workshopSubs: workshopSubs.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      recentTx: txs.slice(0, 5).map((tx: any) => ({
        id: tx.id,
        amount: parseFloat(tx.details?.totals?.total ?? "0") / 100,
        currency: tx.currency_code ?? "USD",
        date: tx.created_at,
        email: tx.customer?.email ?? "—",
      })),
    };
  } catch (e: any) {
    return { error: e.message };
  }
});

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    if (password !== ADMIN_PASSWORD) {
      setError("كلمة المرور خاطئة");
      return;
    }
    setAuthed(true);
    setLoading(true);
    try {
      const data = await getPaddleStats();
      setStats(data);
    } catch (e: any) {
      setStats({ error: e.message });
    }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-2 mb-8">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
            <span className="font-display font-bold text-lg">DX<span className="text-gradient-blueprint">fix</span> Admin</span>
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mb-6">أدخل كلمة المرور للوصول</p>
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            dir="ltr"
            className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition mb-3"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={login}
            className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition"
          >
            دخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
            DX<span className="text-gradient-blueprint">fix</span>
            <span className="text-muted-foreground font-normal text-sm mr-2">— لوحة التحكم</span>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">← العودة للموقع</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-accent animate-pulse">جاري تحميل البيانات من Paddle...</div>
          </div>
        )}

        {stats?.error && (
          <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-red-400 font-mono text-sm">
            خطأ: {stats.error}
            {stats.error.includes("not configured") && (
              <p className="mt-2 text-xs text-red-500">أضف PADDLE_API_KEY في Replit Secrets</p>
            )}
          </div>
        )}

        {stats && !stats.error && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "إجمالي المشتركين النشطين", value: stats.activeSubs, color: "text-primary", icon: "👥" },
                { label: "مشتركي Pro ($19)", value: stats.proSubs, color: "text-accent", icon: "⭐" },
                { label: "مشتركي ورشة ($49)", value: stats.workshopSubs, color: "text-accent", icon: "🏭" },
                { label: "إيرادات هذا الشهر", value: `$${stats.monthlyRevenue}`, color: "text-green-400", icon: "💰" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-6">
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className={`font-display text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Revenue Summary */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h2 className="font-display font-bold text-lg mb-4">ملخص الإيرادات</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-1">إجمالي الإيرادات (كل الوقت)</p>
                  <p className="font-display text-4xl font-bold text-gradient-spark">${stats.totalRevenue}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-1">MRR المتوقع (شهري)</p>
                  <p className="font-display text-4xl font-bold text-primary">
                    ${(stats.proSubs * 19 + stats.workshopSubs * 49).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display font-bold text-lg mb-4">آخر المعاملات</h2>
              {stats.recentTx.length === 0 ? (
                <p className="text-muted-foreground text-sm font-mono">لا توجد معاملات مكتملة بعد</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentTx.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm font-mono text-foreground">{tx.email}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("ar-SA")}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-display font-bold text-green-400">${tx.amount} {tx.currency}</p>
                        <p className="text-xs text-muted-foreground font-mono">{tx.id.slice(0, 12)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
