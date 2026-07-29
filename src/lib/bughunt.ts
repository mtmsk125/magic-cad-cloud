/**
 * BugHunt System — نظام صيد الأخطاء
 * 
 * المستخدمون يبلغون عن أخطاء ويحصلون على مكافآت:
 * - نقاط (Points) تتصدر لوحة الشرف
 * - شارات (Badges) للإنجازات
 * - ذكر اسمهم في التحديثات
 * 
 * بدون دفع. بدون إزعاج. فقط مشاركة وتفاعل.
 */

export interface BugReport {
  id: string;
  type: 'bug' | 'feature_request' | 'improvement' | 'translation';
  title: string;
  description: string;
  page: string;
  email?: string;
  reporter: string;
  status: 'open' | 'confirmed' | 'fixed' | 'wontfix';
  points: number;
  createdAt: number;
  fixedAt?: number;
}

export interface BugHunter {
  name: string;
  email: string;
  totalPoints: number;
  bugsReported: number;
  bugsFixed: number;
  badges: string[];
  joinedAt: number;
}

const BUGS_KEY = 'dxfix_bughunt_bugs';
const HUNTER_KEY = 'dxfix_bughunt_hunter';

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ─── Badges / الشارات ───

const BADGES = {
  first_bug: { name: { ar: 'الصياد المبتدئ', en: 'Novice Hunter' }, icon: '🎯', points: 10 },
  five_bugs: { name: { ar: 'صياد محترف', en: 'Pro Hunter' }, icon: '🏆', points: 50 },
  ten_bugs: { name: { ar: 'صياد أسطوري', en: 'Legendary Hunter' }, icon: '👑', points: 100 },
  first_fix: { name: { ar: 'المُصلح', en: 'The Fixer' }, icon: '🔧', points: 20 },
  translator: { name: { ar: 'المترجم', en: 'Translator' }, icon: '🌐', points: 30 },
  sharer: { name: { ar: 'السفير', en: 'Ambassador' }, icon: '🤝', points: 15 },
};

export function getBadgeInfo(badgeId: string) {
  return (BADGES as any)[badgeId];
}

export function getAllBadges() {
  return Object.entries(BADGES).map(([id, info]) => ({ id, ...info }));
}

// ─── Bug Reports ───

export function getBugReports(): BugReport[] {
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(BUGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function submitBugReport(
  report: Omit<BugReport, 'id' | 'status' | 'points' | 'createdAt'>
): BugReport {
  const newReport: BugReport = {
    ...report,
    id: `bug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'open',
    points: 10, // 10 points for any report
    createdAt: Date.now(),
  };

  if (!isClient()) return newReport;

  try {
    const existing = getBugReports();
    existing.push(newReport);
    localStorage.setItem(BUGS_KEY, JSON.stringify(existing));

    // Award points to hunter
    const hunter = getHunter(report.email || '');
    hunter.totalPoints += newReport.points;
    hunter.bugsReported += 1;

    // Check for new badges
    if (hunter.bugsReported >= 1 && !hunter.badges.includes('first_bug')) {
      hunter.badges.push('first_bug');
    }
    if (hunter.bugsReported >= 5 && !hunter.badges.includes('five_bugs')) {
      hunter.badges.push('five_bugs');
    }
    if (hunter.bugsReported >= 10 && !hunter.badges.includes('ten_bugs')) {
      hunter.badges.push('ten_bugs');
    }

    saveHunter(hunter);
  } catch (e) {
    console.error('Failed to save bug report:', e);
  }

  return newReport;
}

// ─── Hunter Profile ───

export function getHunter(email: string): BugHunter {
  if (!isClient()) {
    return { name: '', email, totalPoints: 0, bugsReported: 0, bugsFixed: 0, badges: [], joinedAt: Date.now() };
  }
  try {
    const stored = localStorage.getItem(HUNTER_KEY);
    if (stored) {
      const hunter = JSON.parse(stored) as BugHunter;
      if (hunter.email === email) return hunter;
    }
  } catch {}
  
  return { name: '', email, totalPoints: 0, bugsReported: 0, bugsFixed: 0, badges: [], joinedAt: Date.now() };
}

function saveHunter(hunter: BugHunter) {
  if (!isClient()) return;
  try {
    localStorage.setItem(HUNTER_KEY, JSON.stringify(hunter));
  } catch {}
}

export function updateHunterName(name: string, email: string) {
  const hunter = getHunter(email);
  hunter.name = name;
  saveHunter(hunter);
}

// ─── Leaderboard ───

export function getLeaderboard(): { name: string; points: number; badges: string[] }[] {
  // In production, this would fetch from a server
  // For now, return local hunter
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(HUNTER_KEY);
    if (stored) {
      const hunter = JSON.parse(stored) as BugHunter;
      if (hunter.name) {
        return [{
          name: hunter.name,
          points: hunter.totalPoints,
          badges: hunter.badges,
        }];
      }
    }
  } catch {}
  return [];
}

// ─── Stats ───

export function getBugHuntStats() {
  const bugs = getBugReports();
  return {
    totalBugs: bugs.length,
    openBugs: bugs.filter(b => b.status === 'open').length,
    fixedBugs: bugs.filter(b => b.status === 'fixed').length,
    totalPoints: bugs.reduce((s, b) => s + b.points, 0),
  };
}