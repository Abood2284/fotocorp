# Fotocorp AI + Analytics Staff Dashboard Feature Plan

## 1. Short Brief

Fotocorp needs a stronger internal dashboard for staff users, especially super admins and catalog/operations teams. The current dashboard gives weak KPI visibility and does not clearly tell staff what is happening across the platform, what needs fixing, or which actions can improve revenue, catalog quality, search quality, and operational reliability.

This feature introduces a **decision-focused analytics and AI insight layer** inside the Fotocorp staff dashboard.

The goal is not to add AI as decoration. The goal is to turn Fotocorp's existing data into clear, useful, actionable staff intelligence.

The feature should be added mainly under:

```txt
/staff/dashboard
```

Additional supporting routes can later be added for drill-down views:

```txt
/staff/insights
/staff/analytics/search
/staff/analytics/catalog
/staff/analytics/revenue
/staff/analytics/operations
/staff/catalog/cleanup
/staff/reports/ai
```

The dashboard should answer questions like:

- What is happening on Fotocorp today?
- Which catalog areas need cleanup?
- Which searches are failing?
- Which users show buying intent?
- Which events/assets are generating demand?
- Which derivative or publish jobs are broken?
- Which contributor submissions are waiting too long?
- What should staff do next?

The AI layer should summarize and prioritize already-computed analytics. It should not directly inspect the entire database on every request.

The recommended structure is:

```txt
Raw platform activity
        ↓
Analytics events + operational tables
        ↓
SQL rollups and rule-based insight engine
        ↓
AI-generated summary and recommendations
        ↓
Staff action queue
```

The highest-value idea is not simply “AI dashboard.” The real feature is an **actionable staff command center**.

---

## 2. ROI Summary

Yes, this feature has ROI potential if it is built around business and operational actions, not vanity metrics.

The ROI comes from five areas:

1. **Revenue conversion**
   - Identify users with high preview activity but low downloads.
   - Identify users who hit download limits.
   - Identify popular searches that indicate buyer demand.
   - Help staff follow up with the right users or companies.

2. **Search improvement**
   - Detect zero-result searches.
   - Detect high-demand queries with poor results.
   - Detect metadata gaps causing weak discovery.
   - Use search trends to improve tags, titles, captions, and event collections.

3. **Catalog quality improvement**
   - Prioritize assets/events with missing captions, weak titles, missing tags, or poor metadata.
   - Focus cleanup work on assets/events that actually get searched or viewed.
   - Avoid wasting time cleaning low-demand records first.

4. **Operations reliability**
   - Surface failed derivative jobs, missing previews, broken publish jobs, stuck contributor batches, and slow API routes.
   - Reduce manual debugging time.
   - Improve homepage/search reliability and client-facing experience.

5. **Staff productivity**
   - Replace generic dashboard numbers with clear action queues.
   - Give staff direct links to fix issues.
   - Reduce the time needed to understand what needs attention.

The feature should be considered successful only if it creates measurable staff actions, such as:

- Metadata fixed
- Derivatives regenerated
- Contributor batches reviewed
- Users contacted
- Entitlements upgraded
- Search failures reduced
- Downloads increased
- Dashboard/debugging time reduced

---

## 3. What This Feature Is Not

This feature should not be built as a generic chatbot over the Fotocorp database.

Avoid these early mistakes:

- Do not send large raw database dumps to an LLM.
- Do not run AI on every dashboard page load.
- Do not let AI directly edit production metadata.
- Do not make AI the source of truth for metrics.
- Do not build semantic/vector search as a dependency for this feature.
- Do not replace staff approval with AI-generated decisions.

AI should assist staff. It should not operate the business blindly.

The first version should be mostly analytics, rules, and workflow. AI should sit on top as a summarizer and recommendation generator.

Recommended split:

```txt
80% analytics and SQL rollups
15% staff workflow and action queue
5% AI-generated summaries and recommendations
```

---

## 4. Where It Should Be Added

### 4.1 Primary Route: `/staff/dashboard`

The existing staff dashboard should become the main command center.

Recommended dashboard sections:

1. **Executive Snapshot**
2. **AI Daily Briefing**
3. **Action Queue**
4. **Catalog Health**
5. **Search Intelligence**
6. **Revenue Signals**
7. **Operations Health**
8. **Contributor Review Status**
9. **System Performance Summary**

The dashboard should not show every possible chart at once. It should show the most important metrics, then allow staff to drill down.

### 4.2 Supporting Route: `/staff/insights`

This route should show all generated insights.

Example filters:

- Severity: Critical, High, Medium, Low
- Type: Catalog, Search, Revenue, Operations, Contributor, Performance
- Status: Open, In Progress, Resolved, Dismissed
- Date range
- Assigned staff member, later phase

Each insight should have:

- Clear title
- Explanation
- Evidence/data points
- Recommended action
- Action button
- Status
- Created date
- Resolved date

### 4.3 Supporting Route: `/staff/analytics/search`

This route should focus on search demand and search failures.

Useful panels:

- Top searches
- Zero-result searches
- Searches with high views but low downloads
- Searches that led to downloads
- Trending queries
- Slow search queries
- Search filters used most often

### 4.4 Supporting Route: `/staff/analytics/catalog`

This route should focus on catalog quality.

Useful panels:

- Assets missing title
- Assets missing caption
- Assets missing tags
- Events with weak metadata
- Events with no public assets
- Public assets missing card derivative
- High-view assets with weak metadata
- Recently approved assets needing cleanup

### 4.5 Supporting Route: `/staff/analytics/revenue`

This route should focus on commercial signals.

Useful panels:

- Downloads today/week/month
- Users near quota
- Users out of quota
- Download denied because of entitlement
- Most downloaded assets/events
- Most viewed but not downloaded assets
- Users with high activity but low conversion
- Buyer/company activity summary

### 4.6 Supporting Route: `/staff/analytics/operations`

This route should focus on platform health.

Useful panels:

- Failed publish jobs
- Pending publish jobs
- Failed derivative jobs
- Missing derivative variants
- R2 original verification issues
- API route latency
- Slow homepage/search endpoints
- Contributor upload backlog

### 4.7 Supporting Route: `/staff/reports/ai`

This route can store generated AI reports.

Report types:

- Daily Staff Briefing
- Weekly Business Review
- Search Demand Report
- Catalog Cleanup Report
- Operations Health Report
- Revenue Opportunity Report

Reports should be generated on schedule or manually by staff, then saved and displayed later. The dashboard should read saved reports, not call AI live on every dashboard request.

---

## 5. Core Data Sources

The dashboard should pull from existing Fotocorp data and new lightweight analytics events.

### 5.1 Existing Business Tables

Relevant platform areas:

| Area | Data Needed |
|---|---|
| Assets | asset status, visibility, title, caption, tags, source, created date |
| Events | event title, status, event date, created date, asset count |
| Derivatives | variant, status, storage key, generated date, failure status |
| Users | signup date, activity, entitlement state |
| Entitlements | quota, used downloads, remaining downloads, plan/access type |
| Downloads | asset downloaded, user, date, result |
| Contributor uploads | batch status, file count, submitted date, reviewed date |
| Publish jobs | job status, attempts, errors, duration |
| Staff audit logs | staff actions, metadata edits, approvals, entitlement changes |

### 5.2 New Analytics Events

Fotocorp should capture user and system activity as events.

Recommended event types:

```txt
search_performed
search_zero_results
asset_preview_viewed
asset_detail_viewed
event_page_viewed
download_requested
download_allowed
download_denied
entitlement_limit_reached
user_signed_up
contributor_batch_submitted
contributor_batch_reviewed
publish_job_failed
derivative_generation_failed
staff_metadata_updated
```

Each event should include only necessary fields.

Example event shape:

```json
{
  "eventType": "search_performed",
  "actorType": "user",
  "actorId": "user_uuid_or_null",
  "query": "salman khan airport",
  "filters": {
    "eventType": "celebrity",
    "dateRange": "last_12_months"
  },
  "resultCount": 12,
  "durationMs": 241,
  "createdAt": "2026-05-27T10:30:00.000Z"
}
```

For very high-volume tracking, Cloudflare Workers Analytics Engine can be considered. For lower-volume and business-critical events, Postgres tables are simpler and easier to query from the staff dashboard.

A mixed approach is best:

- Use Postgres for business-critical events and rollups.
- Use edge analytics for high-volume performance/activity tracking.
- Store daily rollups for dashboard speed.

---

## 6. Proposed Data Model

### 6.1 `analytics_events`

General-purpose activity table for important product events.

```txt
analytics_events
- id
- event_type
- actor_type
- actor_id
- user_id
- staff_id
- asset_id
- event_id
- query
- result_count
- duration_ms
- metadata_json
- created_at
```

Use this only for events that are useful for product, revenue, and operations analysis.

### 6.2 `search_analytics_daily`

Daily search rollup table.

```txt
search_analytics_daily
- date
- query
- normalized_query
- search_count
- zero_result_count
- total_result_count
- avg_result_count
- avg_duration_ms
- preview_view_count
- download_count
- created_at
- updated_at
```

Purpose:

- Avoid scanning raw search events on every dashboard request.
- Power search intelligence and AI summaries cheaply.

### 6.3 `asset_health_daily`

Daily asset/catalog health rollup.

```txt
asset_health_daily
- date
- total_assets
- active_assets
- public_assets
- private_assets
- missing_title_count
- missing_caption_count
- missing_tags_count
- missing_thumb_derivative_count
- missing_card_derivative_count
- missing_detail_derivative_count
- failed_derivative_count
- created_at
- updated_at
```

Purpose:

- Track catalog health trends over time.
- Show whether cleanup work is improving the platform.

### 6.4 `event_health_daily`

Daily event-level quality rollup.

```txt
event_health_daily
- date
- event_id
- public_asset_count
- active_asset_count
- missing_metadata_count
- missing_card_derivative_count
- preview_view_count
- download_count
- search_match_count
- health_score
- created_at
- updated_at
```

Purpose:

- Find events that are visible but weak.
- Prioritize event cleanup by impact.

### 6.5 `staff_insights`

Stores rule-based and AI-enhanced insights.

```txt
staff_insights
- id
- type
- severity
- title
- description
- evidence_json
- recommended_action
- entity_type
- entity_id
- action_url
- source
- status
- created_at
- resolved_at
- resolved_by
```

Example `type` values:

```txt
SEARCH_DEMAND
ZERO_RESULT_QUERY
CATALOG_METADATA_GAP
MISSING_DERIVATIVE
REVENUE_OPPORTUNITY
CONTRIBUTOR_BACKLOG
PUBLISH_FAILURE
PERFORMANCE_ISSUE
```

Example `source` values:

```txt
RULE_ENGINE
AI_SUMMARY
MANUAL
```

### 6.6 `staff_ai_reports`

Stores AI-generated dashboard reports.

```txt
staff_ai_reports
- id
- report_type
- period_start
- period_end
- input_snapshot_json
- summary
- recommendations_json
- model
- created_at
- created_by
```

Purpose:

- Avoid live AI calls on every dashboard load.
- Keep reports auditable.
- Allow staff to compare reports over time.

---

## 7. Feature Use Cases

## 7.1 Executive Staff Dashboard Use Case

### Problem

Staff logs into the dashboard but does not immediately know what is happening across Fotocorp.

A generic KPI dashboard may show numbers like total users or total assets, but those numbers do not tell staff what to do.

### Feature

The `/staff/dashboard` route should show a clear executive snapshot.

Example cards:

```txt
Catalog Health
- 741,220 active assets
- 522,100 public assets
- 18,420 assets missing captions
- 3,812 public assets missing card derivative

Search Health
- 8,240 searches this week
- 912 zero-result searches
- 37 high-demand weak-result queries

Revenue Signals
- 183 downloads this week
- 12 users reached quota
- 7 users had denied downloads

Operations
- 41 failed derivative jobs
- 8 stuck publish jobs
- 14 contributor batches pending review
```

### AI Summary Example

```txt
Search demand is increasing for Bollywood airport and cricket press events, but zero-result rates are high for several celebrity-related queries. Catalog cleanup should prioritize these events because they already show buyer intent.

Operations are mostly stable, but missing card derivatives are affecting public event browsing. Retry derivative generation for the affected public events before adding more homepage inventory.
```

### Recommended Actions

- Fix metadata for top zero-result searches.
- Retry derivative generation for public assets missing card previews.
- Review contributor batches older than 48 hours.
- Contact users who reached download limits.

### ROI

This improves staff decision-making and reduces time wasted manually checking different sections of the system.

---

## 7.2 Search Intelligence Use Case

### Problem

Fotocorp search quality depends heavily on metadata. If users search for content and get poor results, they may assume Fotocorp does not have that content even when it exists.

This is dangerous because the catalog may contain valuable images that are simply not discoverable.

### Feature

Track all important search behavior:

- Query text
- Filters used
- Result count
- Zero-result state
- Search duration
- Follow-up preview views
- Follow-up downloads

The `/staff/analytics/search` route should show:

- Top queries
- Trending queries
- Zero-result queries
- Queries with high views but no downloads
- Queries that lead to downloads
- Queries with poor latency

### Example

Search analytics detects:

```txt
Query: "salman khan airport"
Search count: 281
Zero-result rate: 44%
Preview views: 18
Downloads: 0
```

This means users are looking for a topic, but the platform is failing to satisfy demand.

### AI Recommendation Example

```txt
Users are repeatedly searching for Salman Khan airport images, but the zero-result rate is high. This likely indicates weak metadata rather than missing inventory. Review celebrity airport-related events, improve captions/tags, and consider creating a curated collection for airport appearances.
```

### Action Buttons

```txt
View matching assets
View weak events
Open metadata cleanup
Create curated collection
```

### ROI

This can directly improve search conversion and downloads. It also helps Fotocorp understand market demand without guessing.

---

## 7.3 Catalog Cleanup Use Case

### Problem

Fotocorp has a large legacy-style image archive. Not all assets will have perfect metadata. Some images may have weak titles, missing captions, incomplete tags, or old imported text.

Manually cleaning everything is unrealistic.

### Feature

The dashboard should generate a prioritized catalog cleanup queue.

Priority should be based on:

- Search demand
- Preview views
- Download potential
- Missing metadata
- Event visibility
- Public status
- Derivative readiness

The `/staff/catalog/cleanup` route should show records like:

```txt
Priority 1: High-demand event with weak captions
Priority 2: Public asset missing card derivative
Priority 3: Frequently viewed asset with no tags
Priority 4: Active event with low metadata coverage
```

### Example

Event analytics detects:

```txt
Event: Bollywood Airport Sightings
Public assets: 136
Assets missing captions: 82
Preview views this week: 940
Downloads this week: 3
Search matches: high
```

### AI Recommendation Example

```txt
This event has strong browsing demand but weak conversion. More than half of its public assets have missing captions. Improve metadata for the top-viewed assets first, especially names, location, event context, and searchable tags.
```

### Action Buttons

```txt
Open event
Edit metadata
Generate AI caption suggestions
Mark cleanup complete
```

### ROI

This helps staff spend cleanup time where it affects revenue and search quality most. It prevents the team from wasting hours polishing low-demand assets while valuable events remain weak.

---

## 7.4 Revenue Opportunity Use Case

### Problem

Fotocorp may have users who browse many images, search repeatedly, or hit entitlement limits, but staff may not know who is showing purchase intent.

Without this visibility, potential sales opportunities are lost.

### Feature

The `/staff/analytics/revenue` route should identify users and companies with commercial intent.

Signals:

- High preview views
- Repeated searches
- Asset detail views
- Download attempts
- Download denied due to missing entitlement
- Download denied due to quota exhaustion
- Users near quota limit
- Users who search but do not download

### Example

User activity detects:

```txt
User: agency@example.com
Preview views: 240
Downloads: 2
Quota used: 100%
Denied downloads: 8
Top searches: celebrity event, cricket, political rally
```

### AI Recommendation Example

```txt
This user has strong buying intent and has exhausted their download quota. Staff should contact them with an upgraded package or custom entitlement. Their search behavior suggests interest in celebrity and sports coverage.
```

### Action Buttons

```txt
Open user profile
View activity
Create staff note
Grant entitlement
Mark for follow-up
```

### ROI

This can directly create upsell and renewal opportunities. For a sales-led stock media platform, this is one of the strongest ROI areas.

---

## 7.5 Operations Health Use Case

### Problem

Fotocorp depends on multiple backend operations:

- Original image availability
- Derivative generation
- Preview availability
- Publish jobs
- Contributor upload review
- Search indexing
- API performance

If these fail, the public product suffers. Staff needs to know quickly.

### Feature

The `/staff/analytics/operations` route should surface operational issues clearly.

Metrics:

- Failed derivative jobs
- Missing thumb/card/detail derivatives
- Public assets without ready card derivative
- Failed publish jobs
- Stuck publish jobs
- R2 original missing/verification failures
- Contributor batches pending too long
- Slow API endpoints
- Search indexing lag

### Example

Operations data detects:

```txt
Public assets: 5,000
Missing card derivative: 480
Homepage event cards affected: 38
Failed derivative jobs: 41
```

### AI Recommendation Example

```txt
Public browsing quality is affected because several active events do not have ready card previews. Retry derivative generation for the affected assets before promoting more events to the homepage.
```

### Action Buttons

```txt
View affected assets
Retry derivative jobs
Open publish queue
View error logs
```

### ROI

This improves product reliability and reduces staff debugging time. It also protects the user experience on public routes like homepage, search, event pages, and asset pages.

---

## 7.6 Contributor Review Use Case

### Problem

Contributor uploads can create operational backlog. If submitted batches sit too long, content does not become available for sale, and contributor trust may drop.

### Feature

The staff dashboard should track contributor upload status.

Metrics:

- Submitted batches
- Batches pending review
- Oldest pending batch
- Average review time
- Approved assets
- Rejected assets
- Batches blocked by errors

### Example

Dashboard detects:

```txt
Pending contributor batches: 14
Oldest pending batch: 4 days old
Total submitted assets waiting review: 1,280
```

### AI Recommendation Example

```txt
Contributor review backlog is increasing. Prioritize batches older than 48 hours and review events with the largest asset counts first, because they can add the most catalog inventory once approved.
```

### Action Buttons

```txt
Open review queue
View oldest batches
Assign to reviewer
Mark reviewed
```

### ROI

This improves content throughput and keeps fresh uploaded content moving into the sellable catalog.

---

## 7.7 Public Route Quality Use Case

### Problem

Public routes depend on the health of catalog, derivative, search, and event data.

Important routes include:

```txt
/
/search
/events/[eventSlug]
/assets/[assetId]
/api/v1/public/events/latest
/api/v1/public/homepage
/api/media/assets/:assetId/preview/:variant
```

If the data feeding these routes is incomplete or slow, visitors see weak pages, missing images, slow loading, or irrelevant search results.

### Feature

Dashboard should map internal issues to public route impact.

Examples:

| Public Route | Dashboard Should Detect |
|---|---|
| `/` | Latest events slow, missing cards, weak homepage inventory |
| `/search` | Zero-result queries, slow search, poor metadata |
| `/events/[eventSlug]` | Event has public assets but weak captions/tags |
| `/assets/[assetId]` | Asset missing detail derivative or metadata |
| `/api/v1/public/events/latest` | Slow response, low eligible event count |
| `/api/media/assets/:assetId/preview/card` | Missing card derivative |

### Example

If homepage depends on latest public events and those events are missing card previews, the dashboard should say:

```txt
Homepage quality issue: 18 latest events have missing card derivatives. This may cause broken or weak event cards.
```

### AI Recommendation Example

```txt
The homepage may underperform because several latest events are not display-ready. Prioritize derivative completion for public assets in latest events before changing homepage layout.
```

### ROI

This connects backend health with visible business impact. Staff can fix the issues that affect users first.

---

## 8. Rule-Based Insight Engine

Before AI, Fotocorp should build deterministic rules.

Examples:

### Search Rules

```txt
IF query_count >= 20 AND zero_result_rate >= 30%
THEN create insight: High-demand query with poor results
```

```txt
IF query_count >= 10 AND downloads = 0 AND preview_views > 50
THEN create insight: High interest but weak conversion
```

### Catalog Rules

```txt
IF public_asset = true AND card_derivative_status != READY
THEN create insight: Public asset missing card derivative
```

```txt
IF event_public_asset_count > 20 AND missing_caption_rate > 40%
THEN create insight: Event needs metadata cleanup
```

### Revenue Rules

```txt
IF user_quota_used >= 90%
THEN create insight: User near download limit
```

```txt
IF download_denied_count >= 3 AND reason = ENTITLEMENT_REQUIRED
THEN create insight: Potential sales opportunity
```

### Operations Rules

```txt
IF publish_job_status = FAILED
THEN create insight: Publish job failed
```

```txt
IF contributor_batch_pending_age > 48 hours
THEN create insight: Contributor review backlog
```

These rules are cheap, auditable, and reliable.

AI can then summarize, prioritize, and make the insight easier for staff to understand.

---

## 9. AI Layer Design

### 9.1 AI Responsibilities

The AI layer should:

- Summarize dashboard changes.
- Explain why metrics matter.
- Rank recommended actions.
- Convert technical issues into staff-friendly language.
- Suggest next steps based on evidence.
- Help draft metadata/caption/tag suggestions where staff approval is required.

### 9.2 AI Should Receive Summarized Data Only

Bad input:

```txt
Analyze the whole database and tell us what is happening.
```

Good input:

```json
{
  "period": "last_7_days",
  "top_searches": [
    {
      "query": "salman khan airport",
      "count": 281,
      "zeroResultRate": 0.44,
      "previewViews": 18,
      "downloads": 0
    }
  ],
  "failedDerivativeJobs": 41,
  "pendingContributorBatches": 14,
  "usersAtQuota": 12,
  "slowRoutes": [
    {
      "route": "/api/v1/public/events/latest",
      "p95Ms": 4200
    }
  ]
}
```

### 9.3 AI Output Shape

AI should return structured JSON, not only prose.

Example:

```json
{
  "summary": "Search demand increased for celebrity airport content, but zero-result rates are high.",
  "priorityActions": [
    {
      "priority": 1,
      "type": "SEARCH_CLEANUP",
      "title": "Improve metadata for celebrity airport searches",
      "reason": "High query volume with poor result quality",
      "actionUrl": "/staff/analytics/search?query=salman%20khan%20airport"
    },
    {
      "priority": 2,
      "type": "OPERATIONS",
      "title": "Retry failed card derivatives",
      "reason": "Public event cards are affected",
      "actionUrl": "/staff/analytics/operations?issue=missing-card"
    }
  ],
  "riskLevel": "medium"
}
```

### 9.4 AI Report Frequency

Recommended schedule:

| Report | Frequency |
|---|---|
| Daily Staff Briefing | Once daily |
| Weekly Business Review | Once weekly |
| Search Demand Report | Daily or weekly |
| Catalog Cleanup Report | Daily |
| Operations Health Report | Daily or on demand |
| Revenue Opportunity Report | Daily |

Avoid realtime AI calls on page load.

---

## 10. Dashboard UX Plan

### 10.1 Dashboard Layout

Recommended layout for `/staff/dashboard`:

```txt
Top: Today’s AI Briefing
Below: KPI cards grouped by business area
Middle: Priority Action Queue
Lower: Drill-down summaries
```

### 10.2 Priority Action Queue

Each action should include:

- Severity badge
- Type
- Short title
- Why it matters
- Evidence
- Action button
- Dismiss/resolve option

Example:

```txt
High Priority
Search demand issue
"Salman Khan airport" has 44% zero-result rate
Action: Open metadata cleanup
```

### 10.3 Staff-Friendly Language

Avoid raw technical messages like:

```txt
image_derivatives READY CARD missing for 480 rows
```

Use:

```txt
480 public images are missing card previews, so event grids may show broken or incomplete cards.
```

Keep the raw technical detail available in the drill-down panel.

---

## 11. Implementation Plan

## Phase 1: Non-AI Dashboard Metrics

Goal: Make `/staff/dashboard` useful without AI first.

Build:

- Catalog health cards
- Derivative health cards
- Search health cards
- Revenue signal cards
- Contributor review cards
- Operations status cards

Deliverables:

- Dashboard API endpoint for summary metrics
- UI cards on `/staff/dashboard`
- Basic drill-down links
- No AI dependency yet

Example endpoint:

```txt
GET /api/v1/staff/dashboard/summary
```

Possible response:

```json
{
  "catalog": {
    "activeAssets": 741220,
    "publicAssets": 522100,
    "missingCaptions": 18420,
    "missingCardDerivatives": 3812
  },
  "search": {
    "searches7d": 8240,
    "zeroResultSearches7d": 912,
    "highDemandWeakQueries": 37
  },
  "revenue": {
    "downloads7d": 183,
    "usersNearQuota": 12,
    "downloadDenied7d": 7
  },
  "operations": {
    "failedDerivativeJobs": 41,
    "stuckPublishJobs": 8,
    "pendingContributorBatches": 14
  }
}
```

---

## Phase 2: Analytics Event Logging

Goal: Capture the user/system activity needed for real insights.

Add event logging for:

- Searches
- Preview views
- Downloads
- Download denials
- Event views
- Asset views
- Contributor submissions
- Publish/derivative failures

Deliverables:

- `analytics_events` table or equivalent event pipeline
- API helper for logging events
- Daily rollup job
- Search analytics rollup

Example endpoint or internal helper:

```txt
recordAnalyticsEvent({ eventType, actorId, assetId, eventId, metadata })
```

---

## Phase 3: Rule-Based Insight Engine

Goal: Generate actionable insights without AI.

Build:

- Insight generation job
- `staff_insights` table
- `/staff/insights` route
- Insight status management

Deliverables:

- Rules for search, catalog, revenue, operations, contributor backlog
- Insight creation/update logic
- Dashboard action queue

Example endpoint:

```txt
GET /api/v1/staff/insights?status=open&severity=high
```

---

## Phase 4: AI Daily Briefing

Goal: Use AI to summarize and prioritize already-computed metrics.

Build:

- AI report generation service
- `staff_ai_reports` table
- Daily report job
- Dashboard AI briefing card

Deliverables:

- Structured AI prompt/input format
- Stored AI report output
- Manual regenerate button for staff, optional
- AI Gateway usage tracking, if using Cloudflare AI Gateway

Example endpoint:

```txt
POST /api/v1/staff/ai-reports/generate
GET /api/v1/staff/ai-reports/latest?type=daily_staff_briefing
```

---

## Phase 5: AI-Assisted Metadata Suggestions

Goal: Help staff improve catalog quality faster.

Build:

- AI caption/title/tag suggestion action
- Staff approval UI
- Audit logging
- No auto-publish without review

Use cases:

- Suggest better title
- Suggest improved caption
- Suggest tags based on current metadata and event context
- Suggest search synonyms

Example flow:

```txt
Staff opens weak asset
Clicks "Suggest metadata"
AI generates title/caption/tags
Staff edits/approves
System saves change with audit log
```

---

## 12. API Route Plan

### Staff Dashboard

```txt
GET /api/v1/staff/dashboard/summary
```

Returns high-level dashboard metrics.

### Staff Insights

```txt
GET /api/v1/staff/insights
PATCH /api/v1/staff/insights/:id/status
```

Allows staff to view, resolve, dismiss, or mark insights in progress.

### Search Analytics

```txt
GET /api/v1/staff/analytics/search/summary
GET /api/v1/staff/analytics/search/top-queries
GET /api/v1/staff/analytics/search/zero-results
GET /api/v1/staff/analytics/search/trends
```

### Catalog Analytics

```txt
GET /api/v1/staff/analytics/catalog/summary
GET /api/v1/staff/analytics/catalog/missing-metadata
GET /api/v1/staff/analytics/catalog/missing-derivatives
GET /api/v1/staff/analytics/catalog/event-health
```

### Revenue Analytics

```txt
GET /api/v1/staff/analytics/revenue/summary
GET /api/v1/staff/analytics/revenue/quota-opportunities
GET /api/v1/staff/analytics/revenue/download-denials
GET /api/v1/staff/analytics/revenue/high-intent-users
```

### Operations Analytics

```txt
GET /api/v1/staff/analytics/operations/summary
GET /api/v1/staff/analytics/operations/failed-jobs
GET /api/v1/staff/analytics/operations/missing-derivatives
GET /api/v1/staff/analytics/operations/slow-routes
```

### AI Reports

```txt
GET /api/v1/staff/ai-reports/latest
GET /api/v1/staff/ai-reports/:id
POST /api/v1/staff/ai-reports/generate
```

### AI Metadata Suggestions

```txt
POST /api/v1/staff/assets/:assetId/ai-metadata-suggestions
```

This should only generate suggestions. It should not directly update production metadata.

---

## 13. Cost Control Plan

To keep the feature cheap:

1. Use SQL and rollups for metrics.
2. Generate insights through deterministic rules first.
3. Use AI only after data is summarized.
4. Cache/save AI reports.
5. Run AI on schedule, not every page load.
6. Send small JSON snapshots to the model.
7. Use smaller/cheaper models for daily summaries.
8. Use stronger models only for complex reports or metadata suggestions.
9. Add rate limits for manual AI generation.
10. Track AI usage and errors.

Recommended AI usage pattern:

```txt
Dashboard load → reads saved metrics and latest saved AI report
Daily cron → generates summary once
Manual staff click → generates on-demand report only when needed
```

Do not use this pattern:

```txt
Every staff dashboard page load → call LLM live
```

That wastes money and makes the dashboard slower.

---

## 14. Security and Governance

### 14.1 Staff-Only Access

All analytics, insights, and AI reports must be protected by staff authentication.

Suggested access:

| Role | Access |
|---|---|
| SUPER_ADMIN | Full dashboard, reports, AI generation, insight management |
| CATALOG_MANAGER | Catalog/search insights and metadata suggestions |
| REVIEWER | Contributor backlog and catalog cleanup views |
| SUPPORT/SALES | Revenue opportunity and user activity views |

### 14.2 AI Safety

AI should not receive unnecessary sensitive data.

Avoid sending:

- Full user personal data
- Raw database dumps
- Secrets
- API keys
- Direct storage credentials
- Full private asset URLs

Use IDs, aggregate numbers, and limited business context.

### 14.3 Auditability

Track:

- Who generated AI suggestions
- Who approved metadata changes
- Who resolved insights
- What data snapshot was sent to AI
- Which AI model generated the report

---

## 15. Success Metrics

This feature should be evaluated by practical results.

### Dashboard Usage

- Staff dashboard visits per week
- Insights opened
- Insights resolved
- Actions clicked

### Catalog Improvement

- Reduction in missing captions
- Reduction in missing card derivatives
- Increase in metadata completeness
- Improvement in event health scores

### Search Improvement

- Reduction in zero-result search rate
- Increase in searches leading to previews
- Increase in searches leading to downloads
- Better performance for top queries

### Revenue Improvement

- Users contacted after quota exhaustion
- Entitlement upgrades after staff follow-up
- Downloads from high-intent users
- Higher preview-to-download conversion

### Operations Improvement

- Reduced failed derivative jobs
- Reduced stuck publish jobs
- Faster contributor review time
- Faster issue detection

---

## 16. MVP Scope Recommendation

The MVP should not attempt to solve everything.

### MVP Must Include

- `/staff/dashboard` summary metrics
- Catalog health
- Search health
- Revenue signals
- Operations health
- Contributor backlog
- Rule-based insights
- Action queue

### MVP Should Not Include Yet

- Full AI chatbot
- Semantic search
- Vector database
- Auto metadata publishing
- Complex forecasting
- AI over all historical data
- Live AI calls on every request

### Best MVP Definition

The MVP is successful if staff can log in and immediately see:

```txt
What is broken?
What is selling?
What are people searching for?
What needs cleanup?
Who should be contacted?
What should be fixed first?
```

---

## 17. Suggested PR Breakdown

### PR 1: Staff Dashboard Metrics Foundation

- Add dashboard summary service.
- Add dashboard summary API.
- Add UI cards on `/staff/dashboard`.
- Include catalog, derivative, search, revenue, contributor, and operations placeholders where data is available.

### PR 2: Analytics Event Logging

- Add analytics event table/helper.
- Track search performed.
- Track preview viewed.
- Track download requested/allowed/denied.
- Track event page viewed.

### PR 3: Daily Rollups

- Add daily search rollup.
- Add asset/catalog health rollup.
- Add event health rollup.
- Add scheduled job or command to generate rollups.

### PR 4: Staff Insights Engine

- Add `staff_insights` table.
- Add rule-based insight generation.
- Add `/staff/insights` UI.
- Add insight status updates.

### PR 5: Dashboard Action Queue

- Show priority insights on `/staff/dashboard`.
- Add action buttons to relevant routes.
- Add dismiss/resolve flow.

### PR 6: AI Report Storage

- Add `staff_ai_reports` table.
- Add AI report service interface.
- Add saved daily briefing display.
- No live AI calls on dashboard load.

### PR 7: AI Daily Briefing Generation

- Use summarized metrics as AI input.
- Generate structured summary/recommendations.
- Save report.
- Show latest report on dashboard.

### PR 8: AI Metadata Suggestions

- Add staff-only metadata suggestion action.
- Generate title/caption/tag suggestions.
- Require staff approval.
- Audit every approved change.

---

## 18. Final Recommendation

This feature is worth building for Fotocorp, but it should be treated as a business operations system, not an AI gimmick.

The correct build path is:

```txt
Better metrics first
Then analytics events
Then rollups
Then rule-based insights
Then AI summaries
Then staff action workflows
```

The strongest ROI areas are:

1. Search demand and zero-result tracking
2. Catalog cleanup prioritization
3. User quota/download sales opportunities
4. Derivative and publish job reliability
5. Contributor review throughput

AI should help staff understand and act on the data. It should not replace the data layer, the rule engine, or staff judgment.

The final product should make `/staff/dashboard` answer one simple question every day:

```txt
What should Fotocorp staff fix, improve, or monetize next?
```

That is the feature. Everything else is decoration.
