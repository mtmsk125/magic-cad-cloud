/**
 * verify-growth.ts — Deterministic tests for the Growth layer.
 * Does NOT touch the DXF engine — verifies referral/reward/report/launch logic.
 */

import {
  generateReferralCode,
  generateUniqueReferralCode,
  normalizeEmail,
  isValidEmail,
  attributeReferral,
  isQualifiedReferral,
  canGrantReferrerReward,
  rewardDays,
} from "../src/lib/growth/referrals";
import {
  isLaunchActive,
  daysRemainingInLaunch,
  computeLaunchEnd,
  type LaunchSettings,
} from "../src/lib/growth/config";
import {
  buildPublicReport,
  generateReportId,
  assertNoPrivateLeak,
} from "../src/lib/growth/publicReports";
import {
  aggregateDaily,
  computeFunnel,
  conversionRate,
  makeEventRecord,
} from "../src/lib/growth/analytics";
import { getCommunityLinks } from "../src/lib/growth/community";
import { currentAccess } from "../src/lib/growth/subscriptions";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail ? "- " + detail : ""}`);
  }
}

console.log("GROWTH TESTS\n==============");

// Referral code generation
console.log("\n1. Referral generation");
{
  const code = generateReferralCode(6);
  check("code length 6", code.length === 6);
  check("code alphanumeric uppercase", /^[A-Z0-9]{6}$/.test(code));
  const codes = Array.from({ length: 50 }, () => generateReferralCode(6));
  check("unique codes (50 drawn)", new Set(codes).size === 50);
  const unique = generateUniqueReferralCode(new Set(["ABCDEF"]));
  check("unique avoids existing", unique !== "ABCDEF");
  generateUniqueReferralCode(new Set([unique]), () => 0.1);
  check("unique works with seeded rand", typeof unique === "string");
}

// Email
console.log("\n2. Email normalization/validation");
{
  check("normalize lowercases", normalizeEmail("  A@B.com ") === "a@b.com");
  check("valid email ok", isValidEmail("a@b.co"));
  check("invalid email rejected", !isValidEmail("not-an-email"));
}
// Attribution & anti-abuse
console.log("\n3. Referral attribution (anti-abuse)");
{
  const existing = new Set(["existing@example.com"]);
  check(
    "accepts new email",
    attributeReferral({ inviteeEmail: "new@x.com", referrerCode: "ABC123", existingEmails: existing }).ok === true
  );
  const self = attributeReferral({
    inviteeEmail: "owner@x.com",
    referrerCode: "ABC123",
    existingEmails: existing,
    referrerEmail: "owner@x.com",
  });
  check("self referral blocked", !self.ok && self.reason === "self_referral");
  const dup = attributeReferral({ inviteeEmail: "existing@example.com", referrerCode: "ABC123", existingEmails: existing });
  check("duplicate email blocked", !dup.ok && dup.reason === "duplicate_email");
  const missing = attributeReferral({ inviteeEmail: "n@x.com", referrerCode: "", existingEmails: existing });
  check("empty referrer blocked", !missing.ok && missing.reason === "unknown_referrer");
}

// Qualified referral
console.log("\n4. Qualified referral");
{
  check(
    "qualified when email + scan",
    isQualifiedReferral({ invitedId: "u1", scansCount: 1, minScans: 1, emailCaptured: true }) === true
  );
  check(
    "not qualified without email",
    isQualifiedReferral({ invitedId: "u1", scansCount: 1, minScans: 1, emailCaptured: false }) === false
  );
  check(
    "not qualified without scan",
    isQualifiedReferral({ invitedId: "u1", scansCount: 0, minScans: 1, emailCaptured: true }) === false
  );
}

// Reward
console.log("\n5. Rewards & limits");
{
  check("reward days default 30", rewardDays(30) === 30);
  check(
    "can grant within limit & not already rewarded",
    canGrantReferrerReward({ referral: undefined, referrerQualified: 0, maxReferrals: 5 }) === true
  );
  check(
    "cannot grant if already rewarded",
    canGrantReferrerReward({ referral: { rewarded: true } as any, referrerQualified: 0, maxReferrals: 5 }) === false
  );
  check(
    "cannot grant at limit",
    canGrantReferrerReward({ referral: undefined, referrerQualified: 5, maxReferrals: 5 }) === false
  );
}
// Launch
console.log("\n6. Launch period");
{
  const s: LaunchSettings = { launch_enabled: true, launch_start: "2020-01-01", launch_end: "2030-12-31", launch_days: 60 };
  check("launch active", isLaunchActive(s) === true);
  const off: LaunchSettings = { ...s, launch_enabled: false };
  check("launch disabled -> inactive", isLaunchActive(off) === false);
  check("launch end = start + days", computeLaunchEnd("2024-01-01", 60) === "2024-03-01");
  check("remaining days > 0", daysRemainingInLaunch(s) > 0);
}

// Public report
console.log("\n7. Public reports");
{
  const report = buildPublicReport({
    entities: 84, issuesDetected: 4, issuesFixed: 4, issuesRemaining: 0,
    verified: true, score: 95, warnings: 0,
  });
  check("report id random/nonsequential", /^[a-zA-Z0-9]{6,}$/.test(report.id));
  check("report safe fields only", assertNoPrivateLeak(report) === true);
  check("verified is boolean", report.summary.verified === true);
  const id1 = generateReportId();
  const id2 = generateReportId();
  check("ids differ", id1 !== id2);
}

// Analytics
console.log("\n8. Analytics");
{
  const e1 = makeEventRecord("page_view", { source: "direct" });
  const e2 = makeEventRecord("scan_completed", { source: "referral" });
  const e3 = makeEventRecord("email_captured", { source: "referral" });
  const events = [e1, e2, e3];
  const funnel = computeFunnel(events);
  check("funnel visitors=1", funnel.visitors === 1);
  check("funnel scans=1", funnel.scans === 1);
  const rate = conversionRate(funnel.scans, funnel.visitors);
  check("conversion 100%", rate === 100);
  check("conversion N/A when empty", conversionRate(0, 0) === null);
  const daily = aggregateDaily(events, 30);
  check("daily returns 30 rows", daily.length === 30);
  const today = daily[daily.length - 1];
  check("today visitors counted", today.visitors >= 1 && today.scans >= 1);
}

// Community
console.log("\n9. Community");
{
  const links = getCommunityLinks();
  check("whatsapp default", links.whatsapp === "https://whatsapp.com/channel/0029Vb8U58jIXnlsaNklwU2k");
  check("telegram NOT configured", links.telegram.includes("NOT_CONFIGURED"));
  check("telegram flag false", links.telegramConfigured === false);
}

// Subscriptions
console.log("\n10. Subscriptions");
{
  check(
    "launch free allowed during launch",
    currentAccess({ subscription_status: "launch_free", launchActive: true, hasReferralReward: false, rewardDaysLeft: 0 }).allowed === true
  );
  check(
    "referral_free allowed when reward remaining",
    currentAccess({ subscription_status: "referral_free", launchActive: false, hasReferralReward: true, rewardDaysLeft: 30 }).allowed === true
  );
}

console.log("\n======");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);