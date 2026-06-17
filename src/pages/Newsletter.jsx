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
    const { data: reviewsData } = await supabase
      .from("newsletter_reviews")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    const { data: shoutoutData } = await supabase
      .from("newsletter_shoutouts")
      .select("*")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    const { data: updateData } = await supabase
      .from("newsletter_updates")
      .select("*")
      .eq("approved", true)
      .order("update_date", { ascending: false });

    const { data: issueData } = await supabase
      .from("newsletter_issues")
      .select("*")
      .order("issue_date", { ascending: false })
      .limit(1);

    setReviews(reviewsData || []);
    setShoutouts(shoutoutData || []);
    setUpdates(updateData || []);
    setIssue(issueData?.[0] || null);
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
