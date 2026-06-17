import React from "react";
import ReferralBonusCard from "./ReferralBonusCard";
import { NEW_HIRE_DEPARTMENTS } from "../lib/newsletter";

// Shared presentational newsletter body. Rendered by both the public
// /newsletter page and the admin preview so the two never drift apart.
// All data comes in via props — this component does no fetching.

const DEFAULT_JOKE =
  "My pipeline is like my gym membership: technically active, full of good intentions, and somehow it never converts.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Format an ISO date (YYYY-MM-DD) as "Month Day" without constructing a Date,
// which would shift the day across time zones. Falls back to the raw value.
function formatMonthDay(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

// Consistent editorial section header: a small uppercase kicker above a
// strong headline, separated by a thin amber rule.
function SectionHeading({ kicker, title }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-3 h-px w-12 bg-amber-500" />
    </div>
  );
}

export default function NewsletterContent({
  issueName = "Bi-Weekly Employee Newsletter",
  joke,
  updates = [],
  reviews = [],
  newHires = [],
  birthdays = [],
  anniversaries = [],
  shoutouts = [],
  session,
}) {
  const hiresByDept = NEW_HIRE_DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = newHires.filter((h) => h.department === dept);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      {/* Masthead */}
      <header className="border-t-4 border-amber-500 bg-slate-950 px-10 py-12 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400">
          Orion Wholesale
        </p>
        <h1 className="mt-4 text-5xl font-black tracking-tight">
          Orion Insider
        </h1>
        <p className="mt-4 border-t border-white/10 pt-4 text-sm uppercase tracking-[0.2em] text-slate-400">
          {issueName}
        </p>
      </header>

      {/* From the desk / opening note */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="A Lighter Note" title="From the Floor" />
        <p className="text-lg leading-relaxed text-slate-700">
          {joke || DEFAULT_JOKE}
        </p>
      </section>

      {/* Company updates */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="The Latest" title="Company Updates" />

        <div className="grid gap-4">
          {updates.length > 0 ? (
            updates.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  {item.category}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">No updates added yet.</p>
          )}
        </div>
      </section>

      {/* Reviews — celebratory and critical alike, for transparency */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="In Their Words" title="Reviews" />

        <div className="grid gap-4">
          {reviews.length > 0 ? (
            reviews.map((review) => {
              const rating = review.rating || 5;
              const isCritical = rating <= 3;
              return (
                <figure
                  key={review.id}
                  className={`rounded-lg border-l-4 bg-slate-50 py-5 pl-6 pr-5 ${
                    isCritical ? "border-slate-400" : "border-amber-500"
                  }`}
                >
                  <p
                    className={`text-sm tracking-wide ${
                      isCritical ? "text-slate-500" : "text-amber-500"
                    }`}
                  >
                    {"★".repeat(rating)}
                    <span className="text-slate-300">
                      {"★".repeat(Math.max(0, 5 - rating))}
                    </span>
                  </p>
                  <blockquote className="mt-3 text-lg italic leading-relaxed text-slate-700">
                    &ldquo;{review.review_text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 text-sm font-medium text-slate-500">
                    {review.reviewer_name || "Customer"}
                    <span className="text-slate-400"> · via {review.source}</span>
                  </figcaption>
                  {review.response ? (
                    <div className="mt-4 rounded-md border-l-2 border-amber-500 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                        Our response
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-600">
                        {review.response}
                      </p>
                    </div>
                  ) : null}
                </figure>
              );
            })
          ) : (
            <p className="text-slate-400">No reviews added yet.</p>
          )}
        </div>
      </section>

      {/* New team members */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="Welcome Aboard" title="New Team Members" />

        <div className="grid gap-4 md:grid-cols-2">
          {NEW_HIRE_DEPARTMENTS.map((dept) => (
            <div
              key={dept}
              className="rounded-lg border border-slate-200 bg-slate-50 p-6"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {dept}
              </h3>
              {hiresByDept[dept].length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {hiresByDept[dept].map((hire, i) => (
                    <li key={hire.id || i} className="text-slate-700">
                      <span className="font-bold text-slate-900">
                        {hire.name}
                      </span>
                      {hire.title ? (
                        <span className="text-slate-600"> — {hire.title}</span>
                      ) : null}
                      {hire.start_date ? (
                        <span className="block text-sm text-slate-400">
                          Started {hire.start_date}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  No new {dept} hires this issue.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Celebrations — birthdays and work anniversaries this cycle */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="Celebrations" title="Birthdays & Anniversaries" />

        <div className="grid gap-4 md:grid-cols-2">
          {/* Birthdays */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              🎂 Birthdays
            </h3>
            {birthdays.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {birthdays.map((person, i) => (
                  <li key={person.id || i} className="text-slate-700">
                    <span className="font-bold text-slate-900">
                      {person.name}
                    </span>
                    {person.department ? (
                      <span className="text-slate-500"> · {person.department}</span>
                    ) : null}
                    {person.date ? (
                      <span className="block text-sm text-slate-400">
                        {formatMonthDay(person.date)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No birthdays this issue.
              </p>
            )}
          </div>

          {/* Work anniversaries */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              🎉 Work Anniversaries
            </h3>
            {anniversaries.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {anniversaries.map((person, i) => (
                  <li key={person.id || i} className="text-slate-700">
                    <span className="font-bold text-slate-900">
                      {person.name}
                    </span>
                    {person.department ? (
                      <span className="text-slate-500"> · {person.department}</span>
                    ) : null}
                    {person.years ? (
                      <span className="block text-sm text-amber-600">
                        {person.years}{" "}
                        {Number(person.years) === 1 ? "year" : "years"}
                        {person.start_date ? (
                          <span className="text-slate-400">
                            {" "}
                            · since {person.start_date}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No work anniversaries this issue.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Recognition */}
      <section className="border-b border-slate-200 px-10 py-10">
        <SectionHeading kicker="Recognition" title="Team Shout-Outs" />

        <div className="grid gap-4">
          {shoutouts.length > 0 ? (
            shoutouts.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-amber-200 bg-amber-50 p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {item.employee_name}
                </h3>
                <p className="mt-2 leading-relaxed text-slate-700">
                  {item.shoutout_text}
                </p>
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Submitted by {item.submitted_by || "Leadership"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">No shout-outs added yet.</p>
          )}
        </div>
      </section>

      {/* Referral program */}
      <section className="bg-slate-950 px-10 py-12 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
          Grow The Team
        </p>
        <h2 className="mt-1 text-3xl font-black tracking-tight">
          Employee Referral Program
        </h2>
        <div className="mt-3 h-px w-12 bg-amber-500" />

        <p className="mt-5 max-w-2xl leading-relaxed text-slate-300">
          Great people know great people. Help us continue building the best
          team in the industry by referring qualified candidates to Orion
          Wholesale, Taylor Customs, and our warehouse operations.
        </p>

        <div className="mt-6">
          <ReferralBonusCard session={session} variant="newsletter" />
        </div>
      </section>
    </div>
  );
}
