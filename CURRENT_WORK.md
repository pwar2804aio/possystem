# CURRENT_WORK.md — Session Tracking

## Last Session Summary

**Date:** 18 April 2026
**Version shipped:** v4.0.9

### What was done:
- **Spacer persistence fixed** (v4.0.8) — BackOfficeApp.jsx category mapping stripped spacerSlots on every back office load. Third mapping location. Fixed.
- **Course bug fully fixed** (v4.0.6–v4.0.8) — defaultCourse never mapped in SyncBridge OR BackOfficeApp. sbUpsertCategory also wasn't writing default_course. All three fixed.
- **Android native printer bridge** (v4.0.9) — NetworkPrinter.java + PrinterBridge.java. Direct TCP port 9100. window.RposPrinter exposed to React via JavascriptInterface. No print agent needed on device.
- **iOS app built** — WKWebView wrapper with NetworkPrinter.swift + PrinterBridge.swift. Injects window.RposPrinter shim at document start. Same React code works on both platforms.
- **Knowledge base committed** — CLAUDE.md, DECISIONS.md, INVARIANTS.md, CURRENT_WORK.md all in repo.
- **Investor deck built** — 13-slide PPTX. Needs rebuild with full founder story (intelligentPOS/Kounta/POSUP).
- **Business strategy** — Delivery aggregator decision: Otter and Checkmate both reviewed. Otter API is Enterprise-only beta. Checkmate has open API but site feels low trust. Still undecided.
- **Domain structure decided** — test.pos-up.com / stage.pos-up.com / app.pos-up.com. Not yet configured.
- **Three-branch workflow decided** — develop → staging → main mirrors test → stage → app.

## In Progress

- **Domain setup** — pos-up.com DNS records not yet added. Vercel branch deployments not configured.
- **Delivery aggregator** — no final decision. Otter, Checkmate, or build direct per-platform.
- **Stripe Connect** — application not yet submitted. M2 reader ready, no credentials yet.

## Next Up (in order)

1. Sort domain + DNS → Vercel → update Android/iOS app URLs
2. Apply for Stripe Connect platform account (takes 3-7 days to approve)
3. Decide delivery aggregator — or go direct to Uber Eats / Just Eat APIs
4. Hubrise/aggregator webhook receiver + inbound_orders Supabase table
5. OrdersHub: platform logo badge, auto-print on inbound, accept/reject
6. Rebuild investor deck with full founder story

## Known Landmines

- **Three category mapping locations** — SyncBridge, BackOfficeApp, sbUpsertCategory. Add new category field → update all three.
- **Android app URL** — still points to possystem-liard.vercel.app. Update to app.pos-up.com once DNS live.
- **Stripe Connect not approved** — build Terminal in test mode only until approved.
- **iOS app needs Xcode build** — code is written, not yet built into an IPA. Needs Mac + Xcode session.
- **print-agent.js** — still needed for browser testing. Must run locally on dev machine.

## Open Questions

- Which delivery aggregator? Otter (enterprise gate), Checkmate (open but low trust), or direct per-platform?
- pos-up.com — which registrar holds the DNS?
- Separate Supabase project for staging or same project with separate location?
- Doboy deployment May — are they OK with phased rollout (receipts + stock now, payments when Stripe approved)?
