/**
 * Customer Feedback & Reviews System
 * Handles user feedback submission, storage, and retrieval
 */

export interface FeedbackEntry {
  id: string;
  name: string;
  machineType: string;
  rating: number;
  message: string;
  timestamp: number;
  approved: boolean;
}

export interface ReviewEntry {
  id: string;
  name: string;
  machineType: string;
  rating: number;
  message: string;
  workshop: string;
}

const FEEDBACK_STORAGE_KEY = 'dxfix_feedback';
const SEED_REVIEWS_KEY = 'dxfix_seed_reviews';

/**
 * Seed reviews for the landing page carousel
 */
const SEED_REVIEWS: ReviewEntry[] = [
  {
    id: 'seed-1',
    name: 'أحمد الحربي',
    machineType: 'CNC Router',
    rating: 5,
    message: 'أداة رائعة! كنت أعاني من ملفات DXF ترفض الماكينة قراءتها. الآن أصلح الملف في ثوانٍ وأحمّله مباشرة. وفّر علي ساعات من إعادة العمل.',
    workshop: 'ورشة حائل للنجارة',
  },
  {
    id: 'seed-2',
    name: 'محمد القحطاني',
    machineType: 'Laser',
    rating: 5,
    message: 'من أفضل الأدوات اللي استخدمتها. محاكاة مسار القص ساعدتني أتأكد إن الملف راح يضبط قبل ما أبدأ القطع. أنصح فيها كل مشغّل ليزر.',
    workshop: 'مصنع جدة للقطع',
  },
  {
    id: 'seed-3',
    name: 'خالد المنصور',
    machineType: 'Plasma',
    rating: 4,
    message: 'الأداة ممتازة وسريعة. أحب خاصية تقييم الجاهزية اللي تعطيني نسبة مئوية. لو فيه إمكانية تصدير مباشر لـ Mach3 كان يكون رائع.',
    workshop: 'مصنع الكويت للمعادن',
  },
  {
    id: 'seed-4',
    name: 'سعد العتيبي',
    machineType: 'CNC Router',
    rating: 5,
    message: 'صراحة أداة خرافية! كنت أدفع لمهندسين يصلحون لي الملفات. الآن سويته بنفسي بضغطة زر. الواجهة العربية سهلة جداً.',
    workshop: 'ورشة الرياض للخشب',
  },
  {
    id: 'seed-5',
    name: 'ناصر الدوسري',
    machineType: 'Laser',
    rating: 5,
    message: 'محاكاة المسار ثلاثية الأبعاد شيء رهيب! أقدر أشوف بالضبط كيف راح تتحرك الماكينة قبل القطع. هذا وفّر علينا خسائر مواد كثيرة.',
    workshop: 'مؤسسة الدمام للقطع',
  },
];

/**
 * Check if window is available (client-side)
 */
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Get all feedback entries from localStorage
 */
export function getFeedbackEntries(): FeedbackEntry[] {
  if (!isClient()) return [];
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Submit a new feedback entry
 */
export function submitFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp' | 'approved'>): FeedbackEntry {
  const newEntry: FeedbackEntry = {
    ...entry,
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    approved: false,
  };

  if (!isClient()) return newEntry;

  try {
    const existing = getFeedbackEntries();
    existing.push(newEntry);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save feedback:', e);
  }

  return newEntry;
}

/**
 * Approve a feedback entry (admin function)
 */
export function approveFeedback(id: string): boolean {
  if (!isClient()) return false;
  try {
    const entries = getFeedbackEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx >= 0) {
      entries[idx].approved = true;
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(entries));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Delete a feedback entry (admin function)
 */
export function deleteFeedback(id: string): boolean {
  if (!isClient()) return false;
  try {
    const entries = getFeedbackEntries();
    const filtered = entries.filter(e => e.id !== id);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get approved reviews (seed + user-submitted approved)
 */
export function getApprovedReviews(): ReviewEntry[] {
  const seedReviews = getSeedReviews();
  const userFeedback = getFeedbackEntries().filter(f => f.approved);
  const userReviews: ReviewEntry[] = userFeedback.map(f => ({
    id: f.id,
    name: f.name,
    machineType: f.machineType,
    rating: f.rating,
    message: f.message,
    workshop: f.name,
  }));
  return [...seedReviews, ...userReviews];
}

/**
 * Get seed reviews
 */
export function getSeedReviews(): ReviewEntry[] {
  return SEED_REVIEWS;
}

/**
 * Get unapproved feedback count (for admin badge)
 */
export function getUnapprovedCount(): number {
  return getFeedbackEntries().filter(f => !f.approved).length;
}