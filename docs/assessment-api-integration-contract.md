# Assessment API integration contract — implementation checklist

Status: DESIGN ONLY. Do not expose candidate endpoints until transaction and authorization tests pass.

## Recruiter actions
- POST /api/assessment-invitations with {workspace_id, person_id, application_id?}.
- Verify Supabase bearer token using the existing Talent authentication convention.
- Require an active CRM workspace membership with role manager or admin (confirm whether contributor recruiters need permission).
- Resolve the person and optional application inside the SAME workspace; reject mismatches without exposing another tenant's records.
- Create a random token, persist only its SHA-256 hash, version and expiry, then send an email containing the full token URL. Ensure email failure is surfaced, and make retry idempotent.
- GET /api/assessment-invitations?workspace_id=...&person_id=... returns metadata/status and completed scores only to authorized staff. Never return token hashes, invitation secrets, or other candidates' answers.
- Revocation/resend invalidates the prior outstanding invitation before issuing a new one.

## Candidate actions
- GET /api/assessment?token=... validates token hash, expiry, revocation and completion; returns only public questions and safe status.
- POST /api/assessment with {token, responses, readiness}; do not accept candidate_id, workspace_id, assessment_version or score from the browser.
- Rate-limit token probes and submissions; apply request body size limits; use no-store and no-referrer protections.
- In one database transaction: lock invitation FOR UPDATE, validate status/expiry/version, check candidate and application association, validate all 46 answers, compute score server-side, insert result, mark invitation completed.
- The results table has a unique invitation_id constraint; concurrent retries cannot create two results.
- Do not automatically advance hiring stages or make hiring decisions.
- Do not use readiness fields for numerical scoring. Recruiters should review reasonable accommodation and leave matters under applicable policy.

## UI integration
- Keep /assessment-preview admin-only and unconnected to persistence until the API is ready.
- Add a distinct public /assessment/:token route only after GET/POST token APIs are implemented and tested.
- Candidate profile Assessment tab should show sent/opened/in progress/completed/expired/revoked, dates, scores, competencies, answers and interview prompts.
- Confirm whether the recruiter's operational candidate profile is the Join-Orion dashboard or CRM Candidate 360 before wiring Send Assessment.

## Pre-merge verification
1. Execute npm run test:assessment; fix failures.
2. Run Vite build, lint and existing talent tests.
3. Verify database constraints, RLS and role privileges in a staging project.
4. Verify an authorized recruiter can send, revoke and resend.
5. Verify cross-workspace and cross-candidate access is denied.
6. Verify expired, revoked, reused and concurrent submission attempts are rejected.
7. Confirm outbound email, delivery errors and recruiter completion notification.
8. Complete a test candidate assessment end-to-end and compare scores with leadership-reviewed rubric.
