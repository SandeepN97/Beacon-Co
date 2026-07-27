---
title: ADR-0001 — Why Beacon exists and the business definition
date: 2026-07-26
status: accepted
decision-type: founding
---

# ADR-0001 — Why Beacon exists and the business definition

<div class="decision-lede">
  <span class="decision-card__number">FOUNDING DECISION · ACCEPTED</span>
  <p>Beacon & Co. began with a simple local observation: good small businesses nearby were difficult to find, had incomplete Google listings, depended on social profiles, or had no credible website at all. The first question was not “can this become an agency?” It was “can I build one useful presence for one local business?”</p>
</div>

## Decision

Build Beacon & Co. as a **solo-operated digital-presence business for locally owned small businesses within roughly 30 miles of Waynesboro, Virginia**.

Start with a useful public site and a free audit. Sell a small, transparent first engagement before a larger subscription. Automate repeatable production only after manual delivery proves what should be automated. Preserve two human decisions:

1. the founder-led sales conversation;
2. client approval before drafted content is published.

Everything below records the evidence, assumptions, offer, economics, roadmap, and risks behind that decision.

## Before there was a company

The project began by looking at the businesses people already use around Waynesboro, Staunton, Fishersville, Stuarts Draft, Verona, Grottoes, Weyers Cave, Crozet, and nearby communities.

The recurring pattern was not that these businesses were bad. Many had excellent reviews and strong local reputations. The pattern was that their online presence did not reflect that quality:

- no website or a broken website;
- a Google listing connected to a spam domain;
- missing phone numbers or hours;
- a Facebook page standing in for an owned site;
- no consistent social content;
- no review-request system;
- no simple reporting that showed the owner what improved.

That observation produced the first hypothesis:

> If a local owner has a good real-world business but an incomplete online presence, a small, direct, transparent service can create immediate value without requiring a traditional agency retainer.

The project then evolved from “build one useful website” into a product ladder, a repeatable delivery model, and a phase-gated architecture.

## Local evidence that triggered the business

<span class="truth-state truth-state--evidence">Proposal evidence · July 2026</span>

The proposal defines a 30-mile radius centered on Fishersville for research purposes, while the accepted business definition uses Waynesboro as the operating center. That geographic difference remains open and must be resolved before formal market claims are published.

| Evidence or claim | Proposal value | Truth boundary |
|---|---:|---|
| Staunton–Augusta–Waynesboro MSA population | 129,000 | Attributed to Augusta County Economic Development; reverify before external use |
| Workers within a 30-minute drive of Augusta County | 108,000 | Attributed source; reverify before external use |
| Estimated employer businesses in the MSA | ~2,800 | Census CBP ratio estimate, not a direct local count |
| Estimated no/broken website share | ~35% / ~980 businesses | Industry benchmark applied locally |
| Estimated incomplete Google profile share | ~40% / ~1,100 | Industry benchmark applied locally |
| Estimated no active social share | ~50% / ~1,400 | Industry benchmark applied locally |
| Three-year target | ~55 clients / 2% of estimated market | Target, not forecast |
| Ground-truth sweep | ~55 listings | Proposal says 7 had no website, 2 were hijacked, and 5 lacked a phone number |
| Solo-operator need | 12–20 clients | Operating hypothesis constrained by time and capacity |

The decision does not depend on every percentage being exact. A solo operator does not need the entire market; it needs a small number of qualified owners with visible problems and willingness to pay. The numbers must still be verified before lender, investor, or public use.

## Named prospect evidence

The proposal claims a named sweep of approximately 50 qualified businesses. Its interactive explorer exposes 33 tiered rows plus four highlighted anchors. This decision book records exactly what the supplied artifact exposes; it does not inflate the visible row count to match the headline.

### Four anchor examples

| Business | Town / distance in proposal | Opportunity score | Observed gap | Proposed fit |
|---|---|---:|---|---|
| Heard The Store | Staunton / ~12 mi | 90/100 | No website, missing Google hours, no social; 4.9★ / 28 reviews | Presence |
| Valley OPS Automotive | Waynesboro / ~4 mi | 88/100 | No website, thin Google profile | Spark → Website |
| Sparrow's Nest | Stuarts Draft / ~8 mi | 87/100 | No website, no social | Spark → Presence |
| Shredders Smokehouse | Waynesboro / ~4 mi | 82/100 | Facebook-only, no site, no review system | Social → Presence |

### Tier 1 — fix this week

| Business | Town | Listing signal | Gap |
|---|---|---|---|
| Main Street Grooming | Waynesboro | 5.0★ · 29 | Listing points to spam domain |
| Paws & Claws Pet Salon | Waynesboro | 4.7★ · 32 | Listing points to spam domain |
| River City Barbershop | Waynesboro | 5.0★ · 50 | No website; cash-only |
| Country Confections | Waynesboro | 5.0★ · 19 | No website; no phone |
| Design at nine | Staunton | 5.0★ · 12 | No website |
| The crafty baker | Waynesboro | 5.0★ · 1 | Facebook-only; one review |
| Who's Next? Barber | Waynesboro | 4.6★ · 119 | Facebook-only |
| Elena the Salon Experience | Staunton | 5.0★ · 291 | No phone on Google |
| Sage & Co. Hair Studio | Staunton | 5.0★ · 54 | No phone on Google |
| Made; By the People | Staunton | 4.8★ · 50 | No phone on Google |
| The Kings Lounge | Waynesboro | 4.9★ · 46 | No phone on Google |
| Kline's Espresso Bar | Waynesboro | 4.8★ · 135 | No phone on Google |

### Tier 2 — small footprint

| Business | Town | Listing signal | Opportunity |
|---|---|---|---|
| Valley OPS Automotive | Waynesboro | 5.0★ · 1 | One review; anchor #2 |
| The Barn On Main | Waynesboro | 3.9★ · 9 | Reputation repair |
| True Tech Automotive | Waynesboro | 5.0★ · 58 | One-person shop |
| Foxtails Gift Shop | Staunton | 5.0★ · 11 | Weekend-only hours |
| Billy Opal | Staunton | 5.0★ · 26 | Boutique; natural social fit |
| Juniper Lane Vintage | Staunton | 5.0★ · 26 | Destination bridal |
| The Babe Cave | Staunton | 4.9★ · 36 | Salon |
| BlueGrass Lawn Care | Waynesboro | 5.0★ · 35 | Service trade |
| Grant & Sons Lawn Care | Fishersville | 5.0★ · 34 | Immediate local radius |
| Mission Coffee | Waynesboro | 4.7★ · 55 | Newer shop |
| Shiflett's Barber Shop | Waynesboro | 4.4★ · 93 | Reputation issues |

### Tier 3 — social-content opportunity

| Business | Town | Listing signal | Opportunity |
|---|---|---|---|
| Shredders Smokehouse | Waynesboro | 4.7★ · 210 | Anchor #4 |
| Bonobos Bakery | Waynesboro | 4.6★ · 203 | Sells out daily |
| Sabores De Mexico Bakery | Fishersville | 4.9★ · 97 | Beloved; underexposed |
| Sooner BBQ & More | Stuarts Draft | 4.5★ · 326 | Monthly events create content |
| Latitudes Fair Trade | Staunton | 4.8★ · 61 | Gift shop |
| Crozet Artisan Depot | Crozet | 4.9★ · 56 | East side of radius |
| The Velvet Case | Staunton | 4.8★ · 143 | Jewelry |
| Virginia Made Shop | Staunton | 4.6★ · 125 | Tourism retail |
| Lil Gus's | Grottoes | 4.5★ · 546 | Cave-traffic anchor |
| Old School Burgers | Weyers Cave | 4.6★ · 355 | Cult following |

These are research leads, not client claims, endorsements, or permission to contact. Listing data ages quickly and must be checked again before outreach.

## Competitor evidence

<span class="truth-state truth-state--evidence">Public-page dossier · July 2026</span>

| Competitor | Public pricing recorded in proposal | Positioning | Beacon interpretation |
|---|---|---|---|
| Mosaic Ridge, Churchville | Foothold $1,800; Ridgeline $3,500; “$50/mo” entry; year-two care $105–$345/mo | Hand-coded Next.js, performance and SEO, ethical handover | Closest philosophical competitor; maintenance retainer does not include the proposed social-content system |
| Legacy Marketing, Staunton | No public pricing; free 30-minute consult | Local relationship, 200+ build claim, performance and anti-template messaging | Strong local proof, but sales-call friction and no visible productized entry |
| Augusta Web Co., Augusta County | No public pricing | One-person service businesses, reviews, blogs, content, e-commerce | Direct segment overlap; Beacon differentiates through transparent ladder and proposed speed |
| Studio JWAL, Waynesboro | No public pricing | Boutique, modern portfolio sites | Design-craft competitor; no visible recurring presence-management model |
| Creative Labs, Harrisonburg | $3,000–$15,000 sites; $15,000–$75,000+ e-commerce | Premium Shopify/e-commerce and UX | Serves a higher segment; potential referral relationship |
| DDA + EZMarketing | DDA $1,500–$15,000+; EZ quote-only | National firms with local landing pages | Search competitor rather than relationship competitor |
| Charlottesville agencies | Proposal cites $15,000–$40,000 typical custom build | University-town custom agency market | Price anchor and potential source of too-small referrals |

### Three proposed market gaps

1. **No clear $299 Google-profile entry product.** Spark is intended as the smallest paid proof.
2. **No local recurring offer combining social content with presence management.** Presence proposes 12–20 posts across Instagram, Facebook, and TikTok plus Google, reviews, and reporting.
3. **Competitor delivery is assumed to be labor-led.** Beacon’s proposed differentiation is software-assisted delivery, not discounting equivalent human hours.

### Comparison preserved from the proposal

| Capability | Beacon proposal | Mosaic Ridge | Legacy | Augusta Web | Nationals |
|---|---|---|---|---|---|
| Transparent public pricing | Yes | Yes | No | No | Partial |
| Entry product under $500 | $299 | “$50/mo” | No | No | No |
| Social content in retainer | 12–20/mo | No | No | No | No |
| TikTok included | Proposed | No | No | No | No |
| Plain-English monthly report | Proposed automated | Yes | Not stated | Not stated | No |
| Client owns all files | Yes | Handover offered | Not stated | Not stated | No |
| Founder in radius, direct line | Yes | Yes | Yes | Yes | No |
| Delivery cost | Proposal claims ~$31 software | Labor | Labor | Labor | Labor |

All pricing and capability comparisons must be rechecked before publication or sales use.

## Customer and positioning

Primary customer:

- a locally owned small business;
- roughly within 30 miles of Waynesboro;
- credible in the real world but incomplete or inconsistent online;
- unable to justify established-agency pricing;
- values direct founder access, plain language, ownership, and a useful first step.

Illustrative verticals are restaurants, retail, beauty/wellness, automotive and home services, and professional services. This is not an exclusive vertical strategy.

Positioning:

- local and founder-operated;
- warm, direct, and honest about trade-offs;
- practical visibility rather than abstract “marketing activity”;
- no account-manager handoff;
- transparent prices;
- client ownership of files;
- real local photography rather than generated people;
- automation as the cost structure, not as a substitute for judgment.

## The offer

The proposal uses four products in a deliberate sequence. The live marketing site also exposes individual service prices; both views are preserved here.

### Product ladder

| Product | Price | Role | Delivery and cost hypothesis |
|---|---:|---|---|
| Spark | $299 one-time | Google Business Profile claimed, verified, optimized; photos, hours, review system | ~2 hours; $0 tooling; proposed 48-hour delivery |
| Website | From $799 one-time | Custom static, mobile-first, SEO-ready site owned by client | 10–15 hours; $0 hosting assumption |
| Presence | $450/mo + $799 setup | Site, Google, 12–20 posts across IG/FB/TikTok, review system, plain-English report | 2–3 hours/mo; ~$31 hard cost; 3-month minimum on live site |
| Authority | $750/mo + $1,200 setup | Presence plus local SEO, rank tracking, quarterly strategy | 4–5 hours/mo; 3-month minimum on live site |

### Individual public services

| Service | Public starting price |
|---|---:|
| Google Business Profile | $299 one-time |
| Website design and build | $799 one-time |
| Social media management | $150/month |
| Local SEO | $200/month |
| Review strategy | Included with most plans |
| Brand identity | $350 one-time |

The source of current public inclusions is `src/components/PricingCards.astro`. Prices are working offers, not validated margins.

## Acquisition and delivery model

```text
Local observation
    → named prospect or referral
    → useful free audit
    → founder response
    → 15-minute honest sales call
    → smallest fitting paid product
    → visible result
    → optional recurring relationship
```

The proposal adds future automated acquisition:

```text
Weekly source sweep
    → normalize and deduplicate
    → audit gaps and score
    → compliance/suppression check
    → audit PDF and email sequence
    → call
    → won / lost / 90-day re-nurture
```

<span class="truth-state truth-state--current">Current</span> The site and contact route exist. Delivery is founder-led.

<span class="truth-state truth-state--proposed">Proposed</span> Lead crawling, scoring, outreach sequencing, billing automation, content workers, publishing, and reporting do not exist yet.

## Financial model

The proposal’s interactive model uses:

- monthly client additions;
- monthly churn;
- recurring price;
- $799 setup revenue for each new Presence client;
- two $299 Spark sales per month beginning in month two;
- capacity capped at 18 recurring clients;
- $31 monthly hard cost per recurring client;
- approximately $120 to acquire a client;
- estimated client lifetime of `1 / monthly churn`;
- estimated lifetime contribution of `lifetime × (monthly price - $31) + $799`.

| Scenario | New clients / month | Monthly churn | Monthly price |
|---|---:|---:|---:|
| Conservative | 0.6 | 6% | $450 |
| Base | 1.2 | 4% | $450 |
| Optimistic | 2.0 | 3% | $500 |
| Stress | 1.2 | 8% | $375 |

The proposal displays these base-case headline outputs:

- about 12 paying clients at month 12;
- $5,400 month-12 recurring revenue;
- approximately $55,000 collected during year one;
- a displayed claim of $94 returned for every $1 spent finding a client.

!!! warning "Model, not measurement"
    These outputs are model behavior, not proven business performance. The model excludes or simplifies taxes, founder opportunity cost, refunds, unpaid revisions, legal/accounting work, sales variance, support spikes, contractor costs, and vendor price changes.

## Cost structure

| Layer | Item | Proposal assumption |
|---|---|---:|
| Startup | Domain, business license, Google Voice; remaining tools on free tiers | <$200 once |
| Fixed monthly | Cloudflare, Supabase, Resend, Sentry, uptime, alerts | $0–45 |
| Per client | Claude captions and report | $4–8 |
| Per client | Twilio review-request SMS | $2–4 |
| Per client | DataForSEO rank tracking | $3–5 |
| Per client | Stripe at 2.9% + 30¢ on $450 | ~$13 |
| Per client | JSON2Video rendering | ~$3 |
| Total Presence delivery | Summed hard-cost estimate | ~$31/mo |

The proposal derives a 93% gross-margin claim from `$31 / $450`. That is a **target hard-cost ratio**, not an accounting gross margin. It must include founder time and real operating data before it is treated as authoritative.

### Scarce resource

Time, not infrastructure, is expected to constrain the business. The proposal budgets 2–3 hours per recurring client per month, estimates 15 clients at roughly 35–45 hours per month, and imposes an 18-client cap. These are design targets to be tested through manual delivery.

## Retention model

The proposed retention mechanism is a monthly proof loop:

```text
Metrics collected
    → plain-English summary
    → branded report
    → client sees a result
    → renewal
```

The proposal budgets 4% monthly churn and designs toward 3%, citing a 5–8% general SMB-marketing churn range and 2–4% for agencies with strong reporting. Those ranges require independent sourcing.

Structural retention principles:

- reviews and rankings should compound;
- the client owns files and can leave cleanly;
- the client does not own the operating rhythm and automation;
- direct founder access remains a differentiator;
- annual prepay may offer two months free;
- Spark gives poor-fit clients a useful, bounded exit instead of forced retention.

## Business roadmap

| Period | Business phase | Intended work | Success gate |
|---|---|---|---|
| Months 1–2 | Launch | Site live; first ten audits; Spark delivered manually; Heard demo as portfolio | First paying client |
| Months 3–5 | Systemize | Durable core, audit PDF, billing, sequences after manual learning | Four recurring clients; <4 hours each |
| Months 6–9 | Automate delivery | Social approval queue, review SMS, reporting | Eight clients; ≤3 hours each |
| Months 10–12 | Scale funnel | Weekly lead crawl, scoring, re-nurture | 12 clients; $5,400 MRR |

The first paying client is the primary milestone. Later infrastructure should not be built merely because it appears on a roadmap.

## Risks and truth boundaries

| Risk | Proposed mitigation | Current truth |
|---|---|---|
| Solo-operator dependency | Automation, runbooks, client ownership of files | Automation remains mostly proposed |
| Platform API changes | Multi-platform adapters and manual fallback | Native integrations are not implemented |
| Collision with full-time employment | Hard 18-client cap and phase gates | Capacity assumptions are untested |
| Market-estimate error | Reverify Census CBP and local listings | Several proposal figures are labeled estimates |
| Unvalidated pricing | Measure founder time and costs by offer | No production unit-economics dataset |
| Name/domain risk | Trademark and domain diligence | Beacon & Co. remains provisional |
| Email deliverability | Verified sending domain | Shared Resend sender remains |

## Consequences

Good:

- The business begins with a real local problem rather than a platform idea.
- A $299 paid proof reduces risk for both sides.
- Transparent pricing and client ownership are credible differentiators.
- The architecture can be judged against an explicit business and capacity model.

Costs and trade-offs:

- A solo operator remains the bottleneck until the work is actually systemized.
- The proposal contains time-sensitive research that must be refreshed.
- Low pricing can become self-exploitation if automation and delivery-time assumptions fail.
- The business cannot claim 93% margin, $94 LTV:CAC, or automated delivery as fact without operating evidence.

## Complete proposal evidence

The full interactive evidence snapshot remains part of this ADR:

[Open the proposal in a full page](../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html).

<iframe class="proposal-embed" src="../../assets/adr-intake/ai-company/beacon-and-co-full-business-proposal.html" title="Complete interactive Beacon & Co. business proposal" loading="lazy"></iframe>

The snapshot preserves every supplied prospect link, competitor card, interactive scenario, technology rationale, SVG, Mermaid definition, script, and source note. ADR-0001 governs the business interpretation; [ADR-0003](0003-record-architecture-evolution-and-source-atlas.md) governs its architecture status.
