# Microsoft Business Central Reporting Data Contract

> Migrated from `GeniusSeeker33/geniusseeker-talent-success-platform/integrations/microsoft-business-central/data-contract.md` during repository consolidation. Status remains proposed read-only reporting design. The active Business Central API implementation in this repository must be reconciled against this governance contract before production-readiness is claimed.

Purpose: define the minimum BC references/projections needed for future Orion executive reporting. **Business Central remains authoritative for accounting and financial facts.** No live BC API calls, credentials, schema changes, migrations or UI changes are authorized by this document.

Field names below are **logical contract names, not claims about available BC API properties or endpoints**. IT must confirm source entities, field mappings and supported extraction behavior; Finance must approve accounting meanings.

## 1. Permitted Read Scope and Authority

| Domain | Authoritative system / owner | Genius Seeker boundary |
|---|---|---|
| Posted invoices, credit memos and accounting adjustments | BC / Finance | Read approved minimal identifiers, state and reporting amounts; reference and reconcile |
| Quotes, sales orders, shipments and return documents | BC or explicitly approved operational source / sales operations | Read minimal stage/link references only when needed; never infer financial posting |
| Company, currency and salesperson identifiers | BC / Finance and IT | Preserve source namespace and approved meanings |
| Employee/person/rehire attribution | Approved HR source and governed platform crosswalk / HR and identity steward | Map source salesperson to verified person/episode with dated evidence; do not redefine BC ownership |
| Human communication verification and productivity milestone | Governed learning/work evidence / authorized human reviewer | Link source evidence, not infer success/productivity from an invoice |
| Executive financial measure | Finance-approved definition reconciled to BC | Publish only validated, scoped source-derived projection |

Genius Seeker may read approved company/environment metadata, posted document identifiers/status/dates, minimal Finance-defined net-sales inputs, correction references, salesperson identifiers and necessary source timestamps. Optional later reads cover order/shipment/quote references, minimal customer/opportunity keys and approved control totals.

It must **not own, edit, overwrite, post, cancel, settle or recalculate** BC documents, ledger balances, tax, exchange rates, credit application, inventory, customer master data or financial policies. No BC write-back, payment action, commission calculation or compensation formula is authorized. Reading is limited to the approved fields/company/period, not a general financial replica.

## 2. Concise Field Contract

| Logical field / type | Meaning and preservation rule | Phase |
|---|---|---|
| `source_tenant`, `source_environment`, `company_id` / opaque text | Full BC namespace; preserve original IDs, not just company display name | MVP required |
| `source_entity_or_table`, `source_record_id` / text | Original entity and stable record ID; qualified tuple identifies one source record | MVP required |
| `document_number`, `document_type` / text | Human traceability and quote/order/shipment/posted-invoice/credit/return/adjustment distinction; number alone is not unique | MVP required for document records |
| `posting_status_raw`, `lifecycle_status_raw`, `reporting_stage` | Preserve source state and Finance-approved stage mapping; unknown mapping stays unknown | MVP required |
| `posting_date`, `document_date`, `effective_date_basis` | Posting date controls financial period where Finance specifies; do not substitute creation/order date | MVP posting basis; other dates conditional |
| `currency_code_raw`, `resolved_currency`, `currency_basis` | Preserve source currency value, any approved local-currency interpretation and document/company reporting basis | MVP required |
| `reporting_amount`, `amount_basis_version`, `source_sign` / exact decimal + metadata | Minimal Finance-approved amount/projection, treatment of tax/freight/discounts/credits, source sign retained; not an invented “revenue” field | MVP for net value; not needed for count-only extract |
| `correction_type`, `related_source_refs`, `correction_posting_date` | Credit/return/reversal/adjustment linkage and effective posting; preserve separate source IDs | MVP when corrections exist; missing required linkage blocks dependent attribution |
| `source_created_at`, `source_modified_at`, `source_revision` | Preserve all available source timestamps/revision markers. If not exposed, record that limitation and use an approved complete snapshot/extract strategy | MVP provenance; availability verified by IT |
| `salesperson_id_or_code_raw`, `assignment_basis` | Original source salesperson, document attribution basis and any historical assignment reference | Conditional: required for pilot/employee attribution |
| `related_order/shipment/invoice_refs` | Source-native links across stages, including partial/many-to-many relationships | Future; conditional for cross-stage linkage |
| `customer_or_opportunity_ref` | Minimal scoped key only when necessary to verify linkage; no customer profile/contact payload | Future; conditional for communication linkage |
| `extract_id`, `retrieved_at`, `source_through_at`, `scope/filter_version` | When extracted, what period/company/entity scope it covers, and approved freshness basis | MVP required |
| `completeness_status`, `reconciliation_ref/status`, `quality_reason` | Complete/partial/unknown, Finance control evidence and publication state | MVP required |
| `mapping_ref/version`, `verification_status` | Reference to approved employee/salesperson crosswalk and verification at relevant effective time | Conditional: required for learner metrics |

Preserve exact numeric precision appropriate to approved source amounts; do not round individual records to force a reconciliation. No arbitrary missing value defaults. Detailed line replicas are not authorized by this contract unless separately approved as necessary for reconciliation.

## 3. Salesperson / Employee Crosswalk

Resolve the fully scoped BC salesperson identifier through the governed employment-alias/crosswalk design to `person_id + employment_episode_id + organization_scope`. Preserve source ID/code, effective assignment interval, mapping version, reviewer/evidence and verification time.

- Never match by name, email, current customer owner or a similar simulator rep code alone.
- HR/Finance must approve whether attribution follows document salesperson, originating order assignment or another supported source role. Do not assume today's salesperson owns historical revenue.
- Rehire creates a distinct episode. Reused salesperson codes require dated mappings; ambiguous boundaries remain unresolved.
- Shared/multiple salesperson responsibility requires approved participant roles. Count a source invoice once in company totals; do not repeat its entire value for every participant.
- Unknown salesperson, overlapping mappings or disputed identity means **unavailable for affected learner/pilot attribution**. A complete reconciled company total may still be valid, clearly labeled company scope; never relabel it pilot performance.
- Crosswalks hold identifiers and verification references only, not invoice amounts, customer details, private coaching or employment-decision narratives.

## 4. Document Stages Are Different Facts

| Stage | Reporting interpretation |
|---|---|
| Quote | Proposed terms; not an order, shipment or posted sale |
| Sales order | Operational commitment/state; not posted invoice revenue |
| Shipment | Fulfillment event; may be partial and separately invoiced; not proof of posted revenue |
| Posted invoice | Financial document included only under approved posting/status/period rules |
| Credit memo | Separate financial correction; preserve its ID, posting period, sign and original-document link where available |
| Return | Operational return/return order alone is not a posted credit; read actual financial consequence separately |
| Adjustment/reversal | Finance-defined posted correction or state change; preserve lineage and avoid counting both an adjusted snapshot and an extra delta for the same change |

No one-to-one quote→order→shipment→invoice chain is assumed. Partial shipments, consolidated billing and several credits can exist in the reporting relationship. Exact supported links require source confirmation; lack of a link is not permission to infer it from amount/date/customer similarity.

## 5. Revenue, Credits, Returns and Currency

Finance must define net sales scope before activation: posting period, included document types/states, tax, freight, discounts, credits/returns, cancellations and any approved adjustments. Genius Seeker applies that versioned reporting definition to authorized projections; BC determines the accounting facts.

Do not delete the original invoice when a credit appears or subtract a return before a posted financial consequence exists. Preserve invoice and correction separately. Group totals by company and currency/basis. Never sum unlike currencies. Do not invent exchange rates. Consolidated reporting requires an approved BC/Finance reporting-currency amount or conversion basis, rate/date and reconciliation.

## 6. Pagination, Completeness and Refresh

An extract must retain company/entity/date filters, run ID, source-through basis, page/continuation progress, record counts, unique source keys and completion result. Follow every supported continuation page under the same scope; a top-N/first-page response is **partial**, never a complete KPI.

Handle repeated pages/retries idempotently using source keys and revisions. Do not publish partially committed runs. Source changes during pagination require a supported consistency strategy or an approved snapshot/export plus reconciliation. Incremental reads need an approved watermark/overlap and periodic full-scope checks for corrections/deletions.

**Proposed cadence:** monthly financial publication after Finance reconciliation; optional weekly provisional publication only for a complete reconciled scope explicitly approved by Finance. Record both extraction time and actual source-through time; “fetched today” does not prove current data.

## 7. Reconciliation and Failure Behavior

Before executive publication, match an approved BC report/extract/control to the **same company, period, currency, status, amount basis and grain**. Verify distinct invoice counts, net value and adjustment treatment; retain control reference, comparison time, differences, reviewer and disposition.

| Condition | Required behavior |
|---|---|
| API/extract failure, permission error, missing page, incomplete scope | Affected KPI unavailable with reason and last valid source-through time; no demo fallback or zero |
| Unknown status/currency/amount basis or unreconciled totals | Block affected financial publication pending Finance resolution |
| Unmapped/disputed salesperson | Preserve source projection; withhold affected pilot/learner metrics; complete company scope may remain available |
| Missing correction link | Preserve credit/adjustment as a financial fact if reconciled; withhold affected attribution/linkage until resolved |
| Required source timestamp/revision not exposed | Document limitation; approved complete snapshot/control strategy required, not fabricated timestamps |
| Complete verified population has no qualifying records | Count may be zero; never infer completeness from an empty response alone |
| Source correction after publication | Reconcile a new version and label revision/as-of change; preserve necessary prior reporting lineage |

Failure must not imply low employee performance. Quality metadata identifies which metric/scope is blocked; do not silently exclude unknown records to produce an apparently complete denominator or total.

## 8. Minimum Inputs for Future Dashboard Metrics

| Metric | Minimum data and publication gate |
|---|---|
| Posted invoice count | Qualified posted invoice IDs, numbers, posting date/status, company/period and complete deduplicated population; Finance confirms cancelled/reversed-document treatment. |
| Net sales value | Count-scope provenance plus approved exact-decimal amount basis, currencies, included credits/adjustments and posting periods; Finance reconciliation required. No learner split without verified attribution. |
| Time-to-productivity support | Verified salesperson→person/episode mapping, dated permitted outcome evidence and completeness; HR supplies start date and human reviewer supplies approved milestone/date outside BC. An invoice alone is not productivity. |
| Communication-to-sale linkage | Qualified outcome ID/stage and any supported order/customer/opportunity keys; governed communication ID, human verifier, participant role and link rationale supplied outside BC. Many-to-many links do not prove causation or duplicate sale totals. |

BC does not establish whether a call connected or an interaction succeeded. RingCentral owns call events; governed human verification owns successful-communication classification.

## 9. Security, Access and Minimal Retention

Future integration must use an IT-approved read-only identity with least-privilege company/entity access. Keep secrets/tokens out of documents, logs, projection fields and evidence URLs. Company selection must follow authorized scope, not an untrusted caller header.

Financial projections are restricted to approved Finance/executive recipients; mapping detail is additionally identity-restricted. Avoid customer names, addresses, contact data, bank/payment details, tax identifiers, item-level regulated details and free-text document content unless separately approved and necessary.

Retain only the minimal field projection, source/control references, mapping and quality metadata needed for approved metrics—not whole financial documents, ledgers or unrestricted raw responses.

## 10. Open Finance / IT Decisions

| Decision | Required owner |
|---|---|
| Tenant/environment/company allowlist and exact source entities/fields/read permissions | IT / BC administrator |
| Posted-invoice inclusion and net-sales definition, tax/freight/discount/credit/reversal treatment | Finance |
| Raw/local/reporting currency interpretation and any future consolidated basis | Finance |
| Salesperson attribution basis, effective historical ownership, shared-sale rules and HR mapping evidence | Finance / HR / sales operations |
| Stable source grain/IDs, stage/correction links, timestamp availability and consistent extraction strategy | IT with Finance |
| Control reports, reconciliation tolerance/sign-off, source freshness and correction lookback | Finance / IT |
| Minimal customer/opportunity references for verified communication links and productivity evidence | Sales operations / privacy / Finance |
| Retention/access policy and whether an approved manual extract precedes any API implementation | IT / Finance / privacy |

**Stop point:** contract document only. No production code, credentials, schema, API or integration changes are authorized by this migration.
