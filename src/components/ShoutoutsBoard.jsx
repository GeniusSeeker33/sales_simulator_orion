import { useState, useEffect } from "react";
import { loadShoutouts, postShoutout, addReaction, formatTimeAgo } from "../lib/shoutoutStore";

const REACTIONS = [
  { key: "fire", emoji: "🔥" },
  { key: "clap", emoji: "👏" },
  { key: "flex", emoji: "💪" },
];
const MAX_CHARS = 160;

export default function ShoutoutsBoard({ email, name }) {
  const [shoutouts, setShoutouts] = useState([]);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setShoutouts(loadShoutouts().shoutouts);
  }, []);

  function refresh() {
    setShoutouts(loadShoutouts().shoutouts);
  }

  function handlePost() {
    if (!message.trim() || !email) return;
    setPosting(true);
    postShoutout({ authorEmail: email, authorName: name || email, message: message.trim() });
    setMessage("");
    refresh();
    setPosting(false);
  }

  function handleReaction(shoutoutId, reactionKey) {
    addReaction(shoutoutId, reactionKey);
    refresh();
  }

  const charsLeft = MAX_CHARS - message.length;

  return (
    <div className="shoutouts-section">
      <div className="shoutouts-header">
        <h2>Team Shoutouts</h2>
        <p className="section-subtext">Congratulate, motivate, or talk a little trash.</p>
      </div>

      {email && (
        <div className="shoutout-compose">
          <textarea
            className="shoutout-textarea"
            placeholder="Say something to the team..."
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            rows={2}
          />
          <div className="shoutout-compose-footer">
            <span className={`shoutout-char-count ${charsLeft < 20 ? "warning" : ""}`}>
              {charsLeft} chars left
            </span>
            <button
              className="btn-primary shoutout-post-btn"
              onClick={handlePost}
              disabled={posting || !message.trim()}
            >
              Post
            </button>
          </div>
        </div>
      )}

      <div className="shoutout-list">
        {shoutouts.map((s) => (
          <div key={s.id} className="shoutout-item">
            <div className="shoutout-item-header">
              <span className="shoutout-author">{s.authorName}</span>
              <span className="shoutout-time">{formatTimeAgo(s.postedAt)}</span>
            </div>
            <p className="shoutout-message">{s.message}</p>
            <div className="shoutout-reactions">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  className="shoutout-reaction-btn"
                  onClick={() => handleReaction(s.id, r.key)}
                >
                  {r.emoji}
                  {s.reactions[r.key] > 0 && (
                    <span className="shoutout-reaction-count">{s.reactions[r.key]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {shoutouts.length === 0 && (
          <p className="gd-loading">No shoutouts yet — be the first to say something.</p>
        )}
      </div>
    </div>
  );
}
