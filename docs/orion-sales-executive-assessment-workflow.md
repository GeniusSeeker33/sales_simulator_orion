# Orion Sales Executive Assessment — Candidate Profile Workflow

Status: product specification; not implemented.

## Trigger and eligibility
- Do NOT automatically assign the assessment to every applicant.
- Recruiter conducts initial phone/video screen and decides whether to advance.
- In the existing candidate profile, show an Assessment section with **Send Assessment**.
- Only an authorized recruiter or hiring manager can issue an invitation.
- Send action generates a single-candidate, time-limited, unguessable invitation token, stored hashed server-side; token must not expose assessment scoring keys.
- Send the invitation to the email address already associated with the candidate; verify identity/linkage server-side.
- Track invited, opened, in_progress, completed, expired, and revoked statuses, timestamps, and who initiated the invitation.
- Support resend and revoke; prevent accidental duplicate assessment records.

## Candidate experience
- 6 employment readiness questions followed by 40 job-specific situational judgment questions.
- Present realistic alternatives, one selection per sales question.
- Do not show answer rankings or grading rubric to candidate.
- On submit, save answers and score once on the server, using a versioned rubric; return confirmation only.
- Accessibility, autosave, and privacy notice should be addressed before rollout.

## Recruiter profile results
- Assessment status, sent/completed dates, assessment version.
- Overall advisory score and 10 competency scores; per-question responses.
- Separate unscored employment readiness answers: transportation arrangements, dress code acknowledgement, planned time off and dates, onsite schedule, start date, compensation understanding.
- Suggested structured follow-up interview questions generated from weaker/ambiguous competency areas; maintain standardized core questions for all applicants.
- Record reviewer notes, interview ratings, and eventual hired employee performance follow-up without overwriting assessment data.

## Notification
- Completion sends recruiting a notification with candidate identity and secure candidate-profile link, not full sensitive answers.
- Do not send completion notices until recipient permissions and email destination are configured.

## Guardrails / acceptance
- No assessment is sent automatically at application intake.
- Scores never automatically reject, rank, or move candidate stages.
- Never penalize transportation method or planned leave in scoring.
- Candidate record ID is the immutable join key, not candidate name or email alone.
- Enforce server-side authorization and RLS; candidate access restricted to their own invitation; rubric kept server-only.
- Confirm scoring with sales leadership, pilot with incumbent performance, assess adverse impact and job-relatedness before operational hiring use.
- Test invite, resend, expiry, submission, double submission, cross-candidate isolation, profile display, and notification.
