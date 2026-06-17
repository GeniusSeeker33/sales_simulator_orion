import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import NewsletterContent from "../components/NewsletterContent";

export default function Newsletter() {
  const { session } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [shoutouts, setShoutouts] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [issue, setIssue] = useState(null);

  useEffect(() => {
    async function loadNewsletterData() {
    // Load the latest published issue first — it defines which reviews,
    // shout-outs and updates belong to this cycle.
    const { data: issueData } = await supabase
      .from("newsletter_issues")
      .select("*")
      .order("issue_date", { ascending: false })
      .limit(1);

    const latestIssue = issueData?.[0] || null;
    setIssue(latestIssue);

    let snap = {};
    try {
      snap = latestIssue?.generated_content
        ? JSON.parse(latestIssue.generated_content)
        : {};
    } catch {
      snap = {};
    }

    const reviewIds = Array.isArray(snap.reviewIds) ? snap.reviewIds : [];
    const shoutoutIds = Array.isArray(snap.shoutoutIds) ? snap.shoutoutIds : [];
    const updateIds = Array.isArray(snap.updateIds) ? snap.updateIds : [];

    // Only fetch the items captured in this issue's snapshot.
    const [{ data: reviewsData }, { data: shoutoutData }, { data: updateData }] =
      await Promise.all([
        reviewIds.length
          ? supabase
              .from("newsletter_reviews")
              .select("*")
              .in("id", reviewIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        shoutoutIds.length
          ? supabase
              .from("newsletter_shoutouts")
              .select("*")
              .in("id", shoutoutIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        updateIds.length
          ? supabase
              .from("newsletter_updates")
              .select("*")
              .in("id", updateIds)
              .order("update_date", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

    setReviews(reviewsData || []);
    setShoutouts(shoutoutData || []);
    setUpdates(updateData || []);
    }

    loadNewsletterData();
  }, []);

  // generated_content holds the per-issue snapshot (selected new hires, etc.)
  let snapshot = {};
  try {
    snapshot = issue?.generated_content ? JSON.parse(issue.generated_content) : {};
  } catch {
    snapshot = {};
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <NewsletterContent
        issueName={issue?.issue_name || "Bi-Weekly Employee Newsletter"}
        joke={issue?.joke}
        updates={updates}
        reviews={reviews}
        newHires={snapshot.newHires || []}
        shoutouts={shoutouts}
        session={session}
      />
    </main>
  );
}
