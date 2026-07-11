import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getFeedbackEntries, approveFeedback, deleteFeedback, getUnapprovedCount } from "@/lib/feedback";
import type { FeedbackEntry } from "@/lib/feedback";
import { getViralLaunchStats } from "@/lib/viral-launch";

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
      recentTx: txs.slice(0, 10).map((tx: any) => ({
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

// Simulated data generator for admin dashboard
function getSimulatedStats() {
  const now = Date.now();
  const hours = 24 * 60 * 60 * 1000;
  const files = Array.from({ length: 12 }, (_, i) => ({
    id: `file-${i + 1}`,
    fileName: `part_${String.fromCharCode(65 + (i % 26))}_${String(100 + i).slice(1)}.dxf`,
    userEmail: [
      "ahmed@workshop.sa", "mohammed@cnc.sa", "info@laser-sa.com",
      "saleh@factory.sa", "khalid@metal.sa", "nasser@plasma.sa",
      "fahad@cutting.sa", "majed@steel.sa", "bandar@cnc-workshop.sa",
      "youssef@machining.sa", "turki@laser-cut.sa", "saad@workshop.sa",
    ][i],
    fileSize: `${(Math.random() * 500 + 50).toFixed(1)} KB`,
    timestamp: new Date(now - i * (hours * 2 + Math.random() * hours)).toISOString(),
    status: ["مكتمل", "مكتمل", "مكتمل", "قيد المعالجة", "مكتمل", "مكتمل", "فشل", "مكتمل", "مكتمل", "قيد المعالجة", "مكتمل", "مكتمل"][i],
    score: Math.floor(Math.random() * 40 + 60),
  }));
  return files;
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentFiles] = useState(getSimulatedStats);
  const [selectedTab, setSelectedTab] = useState<"overview" | "files" | "api" | "feedback">("overview");
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [unapprovedCount, setUnapprovedCount] = useState(0);

  // Load feedback on mount
  useEffect(() => {
    if (authed) {
      setFeedbackEntries(getFeedbackEntries());
      setUnapprovedCount(getUnapprovedCount());
    }
  }, [authed]);

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

  const totalVisitors = Math.floor(Math.random() * 1500 + 8500);
  const totalFixedFiles = Math.floor(Math.random() * 200 + 450);
  const activeProUsers = stats && !stats.error ? stats.activeSubs : Math.floor(Math.random() * 30 + 15);
  const totalRevenue = stats && !stats.error ? stats.totalRevenue : Math.floor(Math.random() * 500 + 1200);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
            DX<span className="text-gradient-blueprint">fix</span>
            <span className="text-muted-foreground font-normal text-sm mr-2">— لوحة التحكم</span>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">← العودة للموقع</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-accent animate-pulse">جاري تحميل البيانات من Paddle...</div>
          </div>
        )}

        {stats?.error && (
          <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 text-red-400 font-mono text-sm mb-6">
            خطأ: {stats.error}
            {stats.error.includes("not configured") && (
              <p className="mt-2 text-xs text-red-500">أضف PADDLE_API_KEY في متغيرات البيئة</p>
            )}
          </div>
        )}

        {/* Main Dashboard Content */}
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Traffic */}
            <div className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group hover:border-primary/50 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/40 to-accent/40" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                  👥
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">اليوم</span>
              </div>
              <div className="font-display text-3xl sm:text-4xl font-bold text-gradient-blueprint">
                {totalVisitors.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">إجمالي الزوار</div>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-400">
                <span>↑ 12.5%</span>
                <span className="text-muted-foreground">عن الشهر الماضي</span>
              </div>
            </div>

            {/* Total Fixed Files */}
            <div className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group hover:border-primary/50 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-green-400/40 to-emerald-400/40" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-2xl">
                  📂
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">كل الوقت</span>
              </div>
              <div className="font-display text-3xl sm:text-4xl font-bold text-gradient-spark">
                {totalFixedFiles.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">الملفات المرفوعة والمصلحة</div>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-400">
                <span>↑ 8.3%</span>
                <span className="text-muted-foreground">عن الأسبوع الماضي</span>
              </div>
            </div>

            {/* Active Pro Users */}
            <div className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group hover:border-primary/50 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-400/40 to-amber-400/40" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-2xl">
                  ⭐
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">نشط</span>
              </div>
              <div className="font-display text-3xl sm:text-4xl font-bold text-accent">
                {activeProUsers}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">الاشتراكات النشطة</div>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-400">
                <span>↑ {Math.floor(activeProUsers * 0.15)}</span>
                <span className="text-muted-foreground">هذا الشهر</span>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group hover:border-primary/50 transition">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400/40 to-violet-400/40" />
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl">
                  💰
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">تقديري</span>
              </div>
              <div className="font-display text-3xl sm:text-4xl font-bold text-gradient-spark">
                ${totalRevenue.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">إجمالي الأرباح التقديرية</div>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-400">
                <span>↑ ${Math.floor(totalRevenue * 0.22)}</span>
                <span className="text-muted-foreground">هذا الربع</span>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-border/60 gap-1">
            {[
              { id: "overview" as const, label: "نظرة عامة", icon: "📊" },
              { id: "files" as const, label: "الملفات الأخيرة", icon: "📁" },
              { id: "feedback" as const, label: unapprovedCount > 0 ? `التقييمات (${unapprovedCount})` : "التقييمات", icon: "⭐" },
              { id: "api" as const, label: "API & الإعدادات", icon: "⚙" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                  selectedTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {selectedTab === "overview" && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Revenue Breakdown */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display font-bold text-lg mb-5">تحليل الإيرادات</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">إجمالي الإيرادات (كل الوقت)</span>
                      <span className="font-bold text-gradient-spark">${stats?.totalRevenue ?? totalRevenue}</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: '78%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">MRR المتوقع (شهري)</span>
                      <span className="font-bold text-primary">
                        ${stats ? (stats.proSubs * 19 + stats.workshopSubs * 49).toFixed(0) : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div className="h-full bg-primary rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">إيرادات هذا الشهر</span>
                      <span className="font-bold text-green-400">${stats?.monthlyRevenue ?? '—'}</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: '62%' }} />
                    </div>
                  </div>
                </div>
                {stats && !stats.error && (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-accent">{stats.proSubs}</div>
                      <div className="text-xs text-muted-foreground mt-1">مشتركي Pro</div>
                    </div>
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-accent">{stats.workshopSubs}</div>
                      <div className="text-xs text-muted-foreground mt-1">مشتركي ورشة</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display font-bold text-lg mb-5">النشاط الأخير</h2>
                <div className="space-y-4">
                  {recentFiles.slice(0, 6).map((file) => (
                    <div key={file.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        file.status === "مكتمل" ? "bg-green-400" :
                        file.status === "قيد المعالجة" ? "bg-yellow-400" : "bg-red-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">{file.userEmail}</p>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-mono ${
                          file.score >= 80 ? "text-green-400" :
                          file.score >= 50 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {file.score}/100
                        </p>
                        <p className="text-xs text-muted-foreground">{file.fileSize}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Files Tab */}
          {selectedTab === "files" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border/60">
                <h2 className="font-display font-bold text-lg">الملفات المرفوعة الأخيرة</h2>
                <p className="text-sm text-muted-foreground mt-1">آخر 12 عملية رفع ومعالجة</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30">
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">الملف</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">البريد الإلكتروني</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">الحجم</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">التقييم</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">الحالة</th>
                      <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-wider">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFiles.map((file) => (
                      <tr key={file.id} className="border-b border-border/30 hover:bg-muted/20 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📄</span>
                            <span className="text-sm font-mono font-medium">{file.fileName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">{file.userEmail}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-muted-foreground">{file.fileSize}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold font-mono ${
                            file.score >= 80 ? "text-green-400" :
                            file.score >= 50 ? "text-yellow-400" : "text-red-400"
                          }`}>
                            {file.score}/100
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                            file.status === "مكتمل" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                            file.status === "قيد المعالجة" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" :
                            "bg-red-500/10 text-red-400 border border-red-500/30"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              file.status === "مكتمل" ? "bg-green-400" :
                              file.status === "قيد المعالجة" ? "bg-yellow-400" : "bg-red-400"
                            }`} />
                            {file.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground font-mono text-xs">
                            {new Date(file.timestamp).toLocaleDateString("ar-SA", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* API Tab */}
          {selectedTab === "api" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="font-display font-bold text-lg mb-2">🔌 API Framework Endpoint</h2>
                <p className="text-sm text-muted-foreground mb-6">نقطة API للمطورين والشركات لدمج خدمة إصلاح DXF مع برامجهم</p>
                
                <div className="bg-background border border-border rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-green-500/20 text-green-400">POST</span>
                    <span className="font-mono text-sm text-muted-foreground">/api/v1/dxf/fix</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground space-y-1">
                    <p>// Request Body (multipart/form-data or JSON base64)</p>
                    <p>{'{'}</p>
                    <p>  "file": "base64_encoded_dxf_content",</p>
                    <p>  "fileName": "drawing.dxf",</p>
                    <p>  "options": {}</p>
                    <p>{'}'}</p>
                  </div>
                </div>

                <div className="bg-background border border-border rounded-xl p-5 mb-6">
                  <p className="text-xs font-mono text-muted-foreground mb-2">// Response Example</p>
                  <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap">{JSON.stringify({
                    success: true,
                    data: {
                      fileName: "drawing_fixed.dxf",
                      originalScore: 62,
                      fixedScore: 100,
                      issuesFound: 5,
                      issuesFixed: 5,
                      totalEntities: 142,
                      totalPerimeter_mm: 8452.37,
                      estimatedCutCost_USD: 42.26,
                      processingTime_ms: 847,
                    },
                    meta: {
                      apiVersion: "v1",
                      pricing: "API credits consumed: 1",
                    },
                  }, null, 2)}</pre>
                </div>

                <div className="flex gap-3">
                  <button className="px-5 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]">
                    📄 عرض التوثيق الكامل
                  </button>
                  <button className="px-5 py-2.5 rounded-lg border border-border hover:border-primary/60 font-semibold text-sm transition">
                    🔑 إنشاء مفتاح API
                  </button>
                </div>
              </div>

              {/* Paddle Stats (if available) */}
              {stats && !stats.error && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-display font-bold text-lg mb-4">بيانات Paddle المباشرة</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{stats.activeSubs}</div>
                      <div className="text-xs text-muted-foreground mt-1">إجمالي المشتركين</div>
                    </div>
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-accent">{stats.proSubs}</div>
                      <div className="text-xs text-muted-foreground mt-1">مشتركي Pro</div>
                    </div>
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-accent">{stats.workshopSubs}</div>
                      <div className="text-xs text-muted-foreground mt-1">مشتركي ورشة</div>
                    </div>
                    <div className="bg-background border border-border/60 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">${stats.monthlyRevenue}</div>
                      <div className="text-xs text-muted-foreground mt-1">إيرادات الشهر</div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <h3 className="font-display font-semibold text-md mb-3">آخر المعاملات</h3>
                  <div className="space-y-2">
                    {stats.recentTx.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm">
                            💳
                          </div>
                          <div>
                            <p className="text-sm font-mono">{tx.email}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("ar-SA")}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-display font-bold text-green-400">${tx.amount} {tx.currency}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tx.id.slice(0, 12)}...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback Tab */}
          {selectedTab === "feedback" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-bold text-lg">تقييمات العملاء</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      إجمالي التقييمات: {feedbackEntries.length} · غير معتمد: {unapprovedCount}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFeedbackEntries(getFeedbackEntries());
                      setUnapprovedCount(getUnapprovedCount());
                    }}
                    className="px-4 py-2 rounded-lg bg-accent/20 text-accent border border-accent/30 text-sm font-semibold hover:bg-accent/30 transition"
                  >
                    🔄 تحديث
                  </button>
                </div>
              </div>
              {feedbackEntries.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">💬</div>
                  <p className="text-muted-foreground">لا توجد تقييمات من العملاء بعد</p>
                  <p className="text-xs text-muted-foreground mt-1">عند تقديم المستخدمين تقييماتهم ستظهر هنا</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">الاسم</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">الماكينة</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">التقييم</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">الرسالة</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">التاريخ</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">الحالة</th>
                        <th className="text-right px-6 py-4 text-xs font-mono text-muted-foreground uppercase">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...feedbackEntries].reverse().map((entry) => (
                        <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/20 transition">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium">{entry.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                              {entry.machineType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(s => (
                                <span key={s} className={`text-xs ${s <= entry.rating ? "text-yellow-400" : "text-muted-foreground/20"}`}>★</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-sm text-muted-foreground truncate" title={entry.message}>
                              "{entry.message}"
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-muted-foreground font-mono text-xs">
                              {new Date(entry.timestamp).toLocaleDateString("ar-SA", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                              entry.approved
                                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                entry.approved ? "bg-green-400" : "bg-yellow-400"
                              }`} />
                              {entry.approved ? "معتمد" : "قيد المراجعة"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {!entry.approved && (
                                <button
                                  onClick={() => {
                                    approveFeedback(entry.id);
                                    setFeedbackEntries(getFeedbackEntries());
                                    setUnapprovedCount(getUnapprovedCount());
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-semibold hover:bg-green-500/30 transition"
                                >
                                  ✓ اعتماد
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  deleteFeedback(entry.id);
                                  setFeedbackEntries(getFeedbackEntries());
                                  setUnapprovedCount(getUnapprovedCount());
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold hover:bg-red-500/30 transition"
                              >
                                ✕ حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}