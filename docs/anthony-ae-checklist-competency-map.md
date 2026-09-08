# Anthony AE checklist to Orion competency map

**Purpose:** detailed supporting analysis for the architecture audit in `orion-sales-academy-production-level-transition.md`. This is documentation only. It does not approve a competency framework, reinterpret existing evidence/bands, or change an L-level.

## Source and mapping method

The checklist text below is the current “Account Executive Level Advancement Checklists” supplied for `GeniusSeeker33/geniusseeker-talent-success-platform#27`. Similar demo content exists in `src/data/levels.js`, but it is not identical: the supplied current checklist is the source for this mapping.

The repository’s actual stable competency catalog is `orion-sales/0.1-draft` in `src/data/coachingTargets.js`:

| Internal code | Human-readable skill name |
|---|---|
| C01 | Confidence & Authoritative Communication |
| C02 | Product Knowledge |
| C03 | Discovery / Questioning |
| C04 | Relationship Building |
| C05 | Active Listening |
| C06 | Objection Handling |
| C07 | Call Control / Conversation Leadership |
| C08 | Successful Communication |
| C09 | Closing / Next-Step Behavior |
| C10 | CRM / Process Discipline |
| C11 | Activity Consistency |
| C12 | Sales Outcomes |
| C13 | Coachability / Learning Agility |
| C14 | Professional Judgment |
| C15 | Customer Experience |

The classifications mean:

* **Behavior** — observable conduct that can support a human competency finding.
* **Operational/process requirement** — required work product, system use, cadence, or control; it can be evidence of a skill but should also be verified against its authoritative operational source.
* **Business outcome** — a result rather than behavior. It may be context for development but cannot determine Behavioral Level as well as the production L-level.
* **Mixed** — contains separable behavior/process and result claims; reviewers must assess the behavioral portion rather than granting proficiency from the result.
* **No precise competency** means the current catalog has no sufficiently specific skill name. A broad C-code may provide partial coverage, but the checklist expectation needs an approved anchor or future model decision.

“Strong” means the checklist item directly expresses the named competency. “Partial” means the competency is relevant but does not fully encode the item. This is analysis, not a scoring or weighting model.

## Item-by-item mapping

### Anthony Foundation AE → Account-Aware AE (candidate B1 → B2)

| # | Checklist item | Type | Existing competency coverage | Fit and treatment |
|---:|---|---|---|---|
| 1 | I consistently execute clean, accurate orders with minimal errors | Operational/process + behavior | C10 CRM / Process Discipline; C14 Professional Judgment; C15 Customer Experience | **Strong/partial.** Verify order accuracy operationally; assess repeatable process/judgment separately. Error count alone is not a behavioral band. |
| 2 | I understand core SKUs, fast movers, and allocation vs standard inventory | Behavior/knowledge | C02 Product Knowledge | **Strong.** Add approved anchors for inventory/allocation distinctions if absent. |
| 3 | I confidently navigate pricing, availability, and internal systems (BC, ERP, etc.) | Operational/process + behavior | C02 Product Knowledge; C10 CRM / Process Discipline; C01 Confidence & Authoritative Communication | **Strong across multiple skills.** System competence and confident customer communication are distinct observations. |
| 4 | I consistently get multiple orders closed per day—morning, afternoon, and after 4:30 p.m. | Business outcome + activity requirement | C09 Closing / Next-Step Behavior; C11 Activity Consistency; C12 Sales Outcomes | **Mixed.** Order count/timing is an operational outcome and must not assign B. Observe closing behavior and sustained activity separately. |
| 5 | I ask clarifying questions beyond just taking the order | Behavior | C03 Discovery / Questioning; C05 Active Listening | **Strong.** Listening is supported only when the response shows the answer affected follow-up questions/action. |
| 6 | I can explain why a dealer buys certain products repeatedly | Behavior/knowledge | C03 Discovery / Questioning; C02 Product Knowledge; C14 Professional Judgment | **Strong/partial.** Tests account insight, but the current catalog has no explicit account-analysis skill. |
| 7 | I reference prior orders at least occasionally during conversations | Behavior/process | C10 CRM / Process Discipline; C04 Relationship Building; C03 Discovery / Questioning | **Partial.** Frequency alone is weak; assess relevant, accurate use of history. |
| 8 | I consistently sell items not listed in the morning meeting (Top 60, Core Inventory) | Business outcome + behavior | C02 Product Knowledge; C09 Closing / Next-Step Behavior; C12 Sales Outcomes; C14 Professional Judgment | **Mixed.** Items sold are an outcome. Product selection/value framing are assessable behaviors. This also introduces intentional breadth beyond promoted items. |
| 9 | I no longer rely solely on scripts to run calls | Behavior | C07 Call Control / Conversation Leadership; C01 Confidence & Authoritative Communication; C14 Professional Judgment | **Strong.** “Not solely” should not penalize appropriate use of approved guidance. |

### Anthony Account-Aware AE → Growth-Driven AE (candidate B2 → B3)

| # | Checklist item | Type | Existing competency coverage | Fit and treatment |
|---:|---|---|---|---|
| 1 | My accounts are segmented (A/B/C) and kept current | Operational/process | C10 CRM / Process Discipline; C14 Professional Judgment | **Partial; meaningful added expectation.** Account segmentation is not named explicitly and needs governed definitions/currentness evidence. |
| 2 | I can explain buying patterns for my top 20 accounts | Behavior/knowledge | C03 Discovery / Questioning; C10 CRM / Process Discipline; C14 Professional Judgment | **Partial; meaningful added expectation.** Adds account analytics and prioritization beyond generic discovery. |
| 3 | I have a plan for my bottom 20 accounts and will grow them | Operational/process + intended outcome | C10 CRM / Process Discipline; C09 Closing / Next-Step Behavior; C14 Professional Judgment; C12 Sales Outcomes | **Partial.** Existence/quality of the plan is assessable; future growth is not evidence that behavior is already proficient. |
| 4 | I consistently ask “why” behind dealer buying decisions | Behavior | C03 Discovery / Questioning; C05 Active Listening | **Strong.** Require responsive follow-up, not merely repetition of the word “why.” |
| 5 | I know who the true buyer is for each top account | Behavior/knowledge | C03 Discovery / Questioning; C04 Relationship Building; C14 Professional Judgment | **Strong/partial.** Introduces stakeholder mapping not explicitly named in the catalog. |
| 6 | I identify at least one category gap per top account | Behavior/analysis | C02 Product Knowledge; C03 Discovery / Questioning; C14 Professional Judgment | **Partial; meaningful added expectation.** Category-gap/account-opportunity analysis needs specific anchors. |
| 7 | I document next actions for priority accounts | Operational/process | C10 CRM / Process Discipline; C09 Closing / Next-Step Behavior | **Strong.** Validate useful, attributable, current next actions rather than checkbox presence. |
| 8 | Dealers acknowledge insights I bring to their buying behavior | Customer response/outcome + behavior | C04 Relationship Building; C08 Successful Communication; C15 Customer Experience; C14 Professional Judgment | **Mixed.** Dealer acknowledgment is corroborating context; quality/relevance of communicated insight is the assessable behavior. |

### Anthony Growth AE → Strategic Account AE (candidate B3 → B4)

| # | Checklist item | Type | Existing competency coverage | Fit and treatment |
|---:|---|---|---|---|
| 1 | I maintain monthly account plans for my top 10 accounts | Operational/process | C10 CRM / Process Discipline; C14 Professional Judgment | **Partial; meaningful added expectation.** Account planning is not an explicit competency. Assess quality/use as well as existence. |
| 2 | Each top account has a revenue target and growth strategy | Operational/process | C10 CRM / Process Discipline; C14 Professional Judgment; C09 Closing / Next-Step Behavior | **Partial.** Target presence is not behavioral proficiency; strategy quality and executable next steps can be reviewed. |
| 3 | I drive specific dealer commitments (not vague interest) | Behavior | C09 Closing / Next-Step Behavior; C07 Call Control / Conversation Leadership; C08 Successful Communication | **Strong.** Directly expresses commitment/next-step behavior. |
| 4 | I trade allocation access for consistent buying behavior | Behavior/commercial policy | C06 Objection Handling; C09 Closing / Next-Step Behavior; C14 Professional Judgment; C02 Product Knowledge | **Partial; meaningful added expectation and governance risk.** Commercial negotiation/allocation judgment requires approved policy; do not reward unauthorized tying or unfair treatment. |
| 5 | I expand product mix intentionally, not opportunistically | Behavior/strategy + outcome context | C02 Product Knowledge; C03 Discovery / Questioning; C14 Professional Judgment; C09 Closing / Next-Step Behavior | **Partial; meaningful added expectation.** Cross-selling/account expansion is not named explicitly. Assess customer-fit reasoning, not product-mix result alone. |
| 6 | I can forecast my month with improving accuracy | Operational/process + outcome | C10 CRM / Process Discipline; C14 Professional Judgment; C12 Sales Outcomes | **Mixed; meaningful added expectation.** Forecast method/discipline is behavior; forecast accuracy is an outcome/control measure and needs a governed comparison. |
| 7 | I document wins, losses, and causes—not excuses | Operational/process + behavior | C10 CRM / Process Discipline; C13 Coachability / Learning Agility; C14 Professional Judgment | **Strong/partial.** Adds reflective learning/root-cause behavior. Avoid subjective “excuse” labeling without anchors. |
| 8 | Dealers ask for my input on what to buy | Customer response/outcome | C04 Relationship Building; C15 Customer Experience; C02 Product Knowledge; C08 Successful Communication | **Mixed.** Inbound requests corroborate trust; reviewers still need observed advisory behavior. |
| 9 | My top accounts show sustained month-over-month growth | Business outcome | C12 Sales Outcomes | **Outcome only.** Exclude from overall B derivation. Use governed sales data for performance/context and investigate causation separately. |

### Anthony Strategic AE → Key Account / Partner AE (candidate B4 → B5)

| # | Checklist item | Type | Existing competency coverage | Fit and treatment |
|---:|---|---|---|---|
| 1 | I conduct regular QBR-style conversations with top accounts | Behavior/process | C07 Call Control / Conversation Leadership; C08 Successful Communication; C04 Relationship Building; C10 CRM / Process Discipline | **Partial; meaningful added expectation.** Strategic/QBR account leadership needs format, quality, and cadence anchors. |
| 2 | I align dealer growth plans with manufacturer initiatives | Behavior/strategy | C02 Product Knowledge; C14 Professional Judgment; C08 Successful Communication | **Partial; meaningful added expectation.** Ecosystem/manufacturer alignment is not named explicitly. Customer interest and approved-program constraints remain necessary. |
| 3 | I protect and defend key accounts from competitors | Behavior/strategy + outcome context | C04 Relationship Building; C06 Objection Handling; C14 Professional Judgment; C15 Customer Experience | **Partial.** Define ethical retention behaviors; account retention itself is an outcome. |
| 4 | I have documented retention and expansion strategies | Operational/process | C10 CRM / Process Discipline; C14 Professional Judgment; C09 Closing / Next-Step Behavior | **Partial; meaningful added expectation.** Adds explicit key-account strategy beyond generic CRM discipline. |
| 5 | I influence dealer buying behavior long-term | Behavior + outcome | C04 Relationship Building; C08 Successful Communication; C14 Professional Judgment; C15 Customer Experience | **Mixed.** Assess ethical advisory behavior and durable value; purchasing change alone is an outcome and may have other causes. |
| 6 | I mentor other AEs and share repeatable best practices | Behavior | C13 Coachability / Learning Agility; C08 Successful Communication; C14 Professional Judgment | **Partial; meaningful added expectation.** The catalog names learning agility, not coaching/mentoring others. This may be a partner specialty rather than a universal competency. |
| 7 | I create playbooks or tools that help the broader team | Behavior/work product | C13 Coachability / Learning Agility; C08 Successful Communication; C10 CRM / Process Discipline | **Partial; meaningful added expectation.** Knowledge creation/scaling is not explicitly represented and may be partner specialty evidence. |
| 8 | Leadership trusts me with the most valuable relationships | Stakeholder judgment/outcome | C14 Professional Judgment; C04 Relationship Building; C15 Customer Experience | **Mixed.** Leadership trust is an approval/context signal, not standalone behavioral evidence; define observable reasons and guard against popularity bias. |
| 9 | My top accounts view me as a planning partner, not a vendor | Customer response/outcome + behavior | C04 Relationship Building; C15 Customer Experience; C08 Successful Communication; C14 Professional Judgment | **Mixed.** Customer perception can corroborate sustained strategic behavior but cannot replace evidence of it. |

## Coverage findings

### Strong matches

Anthony’s checklist strongly operationalizes Product Knowledge, Discovery / Questioning, Closing / Next-Step Behavior, CRM / Process Discipline, Professional Judgment, and—at higher maturity—Relationship Building and Successful Communication. It supplies concrete evidence prompts that are more usable than showing internal codes alone.

### Partial matches and meaningful additions

The broad C-catalog can receive evidence about most checklist behaviors, but it does not precisely name several recurring expectations:

* account segmentation, stakeholder mapping, buying-pattern analysis, and prioritization;
* account plans, revenue targets, growth/retention strategies, and forecasting;
* category-gap identification, intentional cross-selling/product-mix expansion, and share of wallet;
* allocation-based commercial negotiation under approved policy;
* QBR leadership and manufacturer-initiative alignment; and
* mentoring, reusable playbooks, and scaled team contribution.

These are meaningful behavioral anchors/capabilities, not a reason to invent new stable codes in this task. Framework owners should decide whether to add anchors beneath existing competencies, define named skill groupings for UI, or create a versioned future competency revision.

### Duplicates and overlaps

Buying-pattern explanation, asking why, identifying the real buyer, and category-gap discovery overlap as account insight/discovery. Documenting next actions, account plans, targets, strategies, forecasts, and wins/losses overlap as account-planning/process discipline. Dealer acknowledgment/input/partner perception overlap as relationship trust and advisory value. Product-mix and retention/expansion statements overlap with strategic account growth. The overall reviewer should seek coherent evidence across these themes, not count overlapping checklist rows as independent votes.

### Existing competencies weakly represented or missing

* **Objection Handling (C06)** has no direct checklist item; allocation trading and competitor defense are only partial proxies.
* **Active Listening (C05)** is implied by clarifying/“why” questions but never directly requires accurate reflection, response adaptation, or confirmed understanding.
* **Confidence & Authoritative Communication (C01)** appears mainly in early system navigation and script independence, not as a full maturity progression.
* **Call Control / Conversation Leadership (C07)** appears in script independence, commitments, and QBRs but lacks explicit intermediate anchors.
* **Coachability / Learning Agility (C13)** appears in wins/loss reflection and advanced mentoring, but receiving/applying feedback is absent.
* **Customer Experience (C15)** is inferred from dealer trust/perception; service recovery, expectation setting, and customer-impact safeguards are not explicit.
* **Sales Outcomes (C12)** is represented by orders and account growth, but those are deliberately outcome/context measures and must not drive overall B.

## Suitability as the overall Behavioral Level foundation

Anthony’s five stages are a **strong operational foundation but not a complete standalone framework**. The progression from order/product execution, through account awareness and growth planning, to strategic partnership is coherent and supports the candidate translation:

| Anthony maturity concept | Candidate overall Behavioral Level | Human-facing name |
|---|---|---|
| Foundation AE | B1 | Foundation |
| Account-Aware AE | B2 | Account Aware |
| Growth-Driven AE | B3 | Growth Driven |
| Strategic Account AE | B4 | Strategic |
| Key Account / Partner AE | B5 | Partner |

However, the source is written as transition checklists (“L1 → L2”), mixes entry and exit criteria, contains duplicated themes, and includes production/customer/leadership outcomes. Before approval as a Behavioral Level framework, owners must:

1. rewrite each B1–B5 as positive, observable maturity anchors rather than production-level transitions;
2. separate behavior/process evidence from outcomes and exclude outcomes from behavioral qualification;
3. cover the weak/missing competencies above or explicitly classify them as foundational, critical, developmental, advanced, or specialty;
4. define evidence sufficiency, recency, opportunity, defer, and human decision rules;
5. define whether B5 mentoring/playbook contributions are universal must-haves or partner specialties; and
6. version and approve the resulting framework without changing old `orion-sales/0.1-draft` evidence or band meanings.

Recommended classification for leadership review—not weighting—is:

* **Foundational:** Product Knowledge; CRM / Process Discipline; Activity Consistency; Professional Judgment; Customer Experience.
* **Critical/must-have safeguards at every level:** Professional Judgment, Customer Experience, accurate process execution, and compliance with commercial/allocation policy. “Critical” should mean a human must address material contrary evidence, not an automatic numeric gate until approved.
* **Developmental:** Confidence, Discovery, Active Listening, Objection Handling, Call Control, Successful Communication, Closing, Relationship Building, and Coachability, with maturity anchors across levels.
* **Advanced account capabilities:** segmentation, account planning, forecasting, category-gap/cross-sell analysis, retention/expansion strategy, QBRs, and ecosystem alignment.
* **Specialty/partner candidates:** mentoring, playbook/tool creation, and stewardship of the most valuable relationships.

No arithmetic weights, average, checklist-count threshold, or automatic result follows from these groupings.

## Human-facing terminology recommendation

### Employee experience

Default summary:

```text
Stage
Ramp Certified — Establishing Baseline

Performance
L3 — Growth

Behavior
B2 — Account Aware

Development priorities
Account Planning
Discovery
Cross-Selling
```

Use skill names and behavioral descriptions in plans and evidence summaries. Do not default to `L3B2 / C04B2 / C09B3 / C12B4`. A compact badge may show `L3B2`, but adjacent text must say **Growth Performance · Account-Aware Behavior**. “Skill details” can show `Relationship Building — [plain-language proficiency]`; technical details may additionally show `C04` and internal B-band.

### Manager, trainer, and reviewer experience

Managers and trainers should see the same plain-English summary plus named strengths, development priorities, checklist evidence themes, defer/missing-opportunity warnings, and links to underlying evidence. Reviewers need the exact framework version, employment episode, C-code, internal band, evidence ID/revision, and correction lineage in a collapsible **Technical details / Audit history** view. Executives should see plain-language cohort summaries and governed performance/behavior distinctions, not raw competency-code matrices by default.

### Resolving the double use of B1–B5

Using B1–B5 for both a single skill and overall behavior is inherently ambiguous. The preferred resolution is:

* reserve **Behavior Level B1–B5** for the overall human-facing summary;
* display individual competency proficiency primarily with skill name plus approved words, while retaining `Cxx` and `B1`–`B5` unchanged internally and in audit/reviewer detail; and
* never show an unqualified `B3`—label it either **Overall Behavior: B3 — Growth Driven** or **Discovery proficiency: [word] (internal C03/B3)**.

Candidate words for individual proficiency are **Developing, Capable, Proficient, Advanced, Expert**, but this is a terminology proposal, not an approved mapping. Framework owners must verify that each word faithfully matches the existing B1–B5 behavioral anchors before adoption. If it does not, use neutral phrases such as **Band 1–Band 5** only in technical views and descriptive anchor text in normal UI. Do not relabel stored history or imply that a display word changes its semantics.

## Architecture guardrails

* Anthony stage names are candidate overall-behavior anchors, not production L definitions.
* An outcome can trigger inquiry or corroborate context; it cannot qualify both L and B.
* Existing per-C band records remain exactly what they were when created. No backfill to overall B is valid without a new governed human assessment.
* Overall Behavioral Level remains episode-specific, human-controlled, version-aware, auditable, append-only, correction-aware, and allowed to defer.
* AI practice may support human-reviewed evidence but cannot directly assign an individual band or overall level.
* Plain-English UI does not remove technical identifiers; it places them in the technical/audit layer where they support provenance without burdening ordinary users.
