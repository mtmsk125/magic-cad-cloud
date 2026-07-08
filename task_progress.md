# DXF Fixer Unified Upgrade - Task Progress

## Phase 1: DXF Parsing & Algorithm Efficiency
- [ ] 1.1 Upgrade dxf.ts with Fuzzy Node Snapping (merge open endpoints with adjustable tolerance)
- [ ] 1.2 Add Structural Purge & Cleanup (strip unused blocks, empty layers, duplicate text, redundant lines)
- [ ] 1.3 Add processing time tracking metrics
- [ ] 1.4 Add file size reduction percentage calculation
- [ ] 1.5 Fix "لا يمكن رسم معاينة" error by ensuring coordinate extraction from all entity types

## Phase 2: Advanced CNC Tools
- [ ] 2.1 Add 3D CNC Toolpath Motion Simulator to SVG preview canvas with animation
- [ ] 2.2 Add "تشغيل المحاكاة" (Play Simulation) button
- [ ] 2.3 Add Machine Safety & G-Code Verification Badge with green checkmarks
- [ ] 2.4 Add safety checklist items: bounding box security, no sharp movements, industrial safety compliance

## Phase 3: Pricing Refactor & Access Gating
- [ ] 3.1 Refactor pricing.tsx to three columns: Free, Pro ($19/mo + Credits), Enterprise ($49/mo)
- [ ] 3.2 Add Pay-Per-File Credit Option under Pro tier
- [ ] 3.3 Update index.tsx pricing section to match new 3-column layout
- [ ] 3.4 Add download gating logic - check userIsSubscribed before allowing download
- [ ] 3.5 Add subscription prompt modal for free users trying to download
- [ ] 3.6 Add visual lock icons (🔒) on Pro/Enterprise features
- [ ] 3.7 Update subscription.ts to support enterprise tier
- [ ] 3.8 Update subscription-prompt.tsx component