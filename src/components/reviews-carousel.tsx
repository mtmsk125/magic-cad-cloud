/**
 * Reviews Carousel Component
 * Displays seed testimonials with star ratings and machine types
 */

import { useState, useEffect, useCallback } from "react";
import { getSeedReviews, getApprovedReviews } from "@/lib/feedback";
import type { ReviewEntry } from "@/lib/feedback";

interface ReviewsCarouselProps {
  lang?: "ar" | "en";
}

const T = {
  ar: {
    title: "ماذا يقول أصحاب الورش والمصانع عن الأداة؟",
    subtitle: "تجارب حقيقية من مشغّلين ومهندسين يستخدمون DXFix يومياً",
    machineLabel: "الماكينة",
    verified: "تقييم موثّق",
  },
  en: {
    title: "What do workshop and factory owners say about the tool?",
    subtitle: "Real experiences from operators and engineers using DXFix daily",
    machineLabel: "Machine",
    verified: "Verified Review",
  },
};

const MACHINE_BADGES: Record<string, { icon: string; color: string }> = {
  "CNC Router": { icon: "🪚", color: "text-blue-400" },
  "Laser": { icon: "🔦", color: "text-red-400" },
  "Plasma": { icon: "⚡", color: "text-yellow-400" },
  "Waterjet": { icon: "🌊", color: "text-cyan-400" },
  "CNC Mill": { icon: "⚙", color: "text-purple-400" },
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-sm ${s <= rating ? "text-yellow-400" : "text-muted-foreground/20"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

export function ReviewsCarousel({ lang = "ar" }: ReviewsCarouselProps) {
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const t = T[lang];

  useEffect(() => {
    // Get seed reviews 
    const seedReviews = getSeedReviews();
    setReviews(seedReviews);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % reviews.length);
  }, [reviews.length]);

  const prev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + reviews.length) % reviews.length);
  }, [reviews.length]);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying || reviews.length <= 1) return;
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, next, reviews.length]);

  if (reviews.length === 0) {
    return null;
  }

  // Get visible reviews (3 at a time on desktop)
  const visibleReviews = reviews.slice(currentIndex, currentIndex + 3);
  // If we don't have enough, wrap around
  while (visibleReviews.length < 3 && reviews.length > 0) {
    visibleReviews.push(reviews[(currentIndex + visibleReviews.length) % reviews.length]);
  }

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
      <div className="text-center mb-14">
        <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">
          {lang === "ar" ? "آراء العملاء" : "Testimonials"}
        </p>
        <h2 className="font-display mt-3 text-4xl lg:text-5xl font-bold">{t.title}</h2>
        <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t.subtitle}</p>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {visibleReviews.map((review, idx) => {
          const badge = MACHINE_BADGES[review.machineType] || { icon: "🔧", color: "text-gray-400" };
          return (
            <div
              key={`${review.id}-${idx}`}
              className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-5 relative hover:border-accent/40 transition-all hover:shadow-[var(--shadow-elegant)] group"
            >
              {/* Machine Type Badge */}
              <div className="absolute -top-3 end-4">
                <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded-full border border-border/60 bg-background ${badge.color}`}>
                  {badge.icon} {review.machineType}
                </span>
              </div>

              {/* Verified Badge */}
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center font-display font-bold text-accent text-lg flex-shrink-0">
                  {review.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm">{review.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{review.workshop}</div>
                </div>
              </div>

              {/* Stars */}
              <Stars rating={review.rating} />

              {/* Review Text */}
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                "{review.message}"
              </p>

              {/* Verified Tag */}
              <div className="flex items-center gap-1.5 text-xs text-green-400 border-t border-border/40 pt-4">
                <span className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-[10px]">✓</span>
                {t.verified}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Single Card with Navigation */}
      <div className="md:hidden">
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-5">
          {/* Machine Type Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-display font-bold text-accent text-sm flex-shrink-0">
                {reviews[currentIndex].name[0]}
              </div>
              <div>
                <div className="font-semibold text-sm">{reviews[currentIndex].name}</div>
                <div className="font-mono text-xs text-muted-foreground">{reviews[currentIndex].workshop}</div>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-full border border-border/60 ${(MACHINE_BADGES[reviews[currentIndex].machineType]?.color) || "text-gray-400"}`}>
              {MACHINE_BADGES[reviews[currentIndex].machineType]?.icon || "🔧"} {reviews[currentIndex].machineType}
            </span>
          </div>

          <Stars rating={reviews[currentIndex].rating} />

          <p className="text-sm text-muted-foreground leading-relaxed">
            "{reviews[currentIndex].message}"
          </p>

          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-[10px]">✓</span>
              {t.verified}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { prev(); setIsAutoPlaying(false); }}
                className="w-8 h-8 rounded-full bg-border flex items-center justify-center hover:bg-muted transition"
              >
                <span className="text-sm">{lang === "ar" ? "→" : "←"}</span>
              </button>
              <button
                onClick={() => { next(); setIsAutoPlaying(false); }}
                className="w-8 h-8 rounded-full bg-border flex items-center justify-center hover:bg-muted transition"
              >
                <span className="text-sm">{lang === "ar" ? "←" : "→"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); setIsAutoPlaying(false); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? "bg-accent w-4" : "bg-border hover:bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}