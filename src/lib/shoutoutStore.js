const SHOUTOUT_KEY = "sales-simulator-orion-shoutouts-v1";
const MAX_SHOUTOUTS = 50;

const DEMO_SHOUTOUTS = [
  {
    id: "shout-demo-1",
    authorEmail: "TimH@orionwholesaleonline.com",
    authorName: "Tim Hardin",
    message: "Charlie K back-to-back 94s this week 🔥 someone's been putting in the reps",
    postedAt: "2026-04-28T07:45:00Z",
    reactions: { fire: 5, clap: 3, flex: 2 },
  },
  {
    id: "shout-demo-2",
    authorEmail: "AlannaH@orionwholesaleonline.com",
    authorName: "Alanna Holland",
    message: "Congrats to Neil on his first podium finish 👏 well deserved",
    postedAt: "2026-04-27T16:20:00Z",
    reactions: { fire: 2, clap: 7, flex: 1 },
  },
  {
    id: "shout-demo-3",
    authorEmail: "CharlieK@Orionwholesaleonine.com",
    authorName: "Charlie Kronauer",
    message: "James Ferguson watch your back — I'm coming for that #1 spot 😤",
    postedAt: "2026-04-27T09:10:00Z",
    reactions: { fire: 8, clap: 1, flex: 4 },
  },
  {
    id: "shout-demo-4",
    authorEmail: "JamesF@Orionwholesaleonline.com",
    authorName: "James Ferguson",
    message: "Good luck Charlie 💪 see you at the top. Simulator doesn't lie — put in the work",
    postedAt: "2026-04-26T14:55:00Z",
    reactions: { fire: 6, clap: 4, flex: 9 },
  },
  {
    id: "shout-demo-5",
    authorEmail: "NeilD@Oronwholesaleonline.com",
    authorName: "Neil Dickinson",
    message: "Team pizza party pool is almost funded — who's adding their pledge? 🍕",
    postedAt: "2026-04-25T11:30:00Z",
    reactions: { fire: 3, clap: 5, flex: 0 },
  },
];

export function loadShoutouts() {
  try {
    const raw = localStorage.getItem(SHOUTOUT_KEY);
    if (!raw) return { shoutouts: [...DEMO_SHOUTOUTS] };
    return JSON.parse(raw);
  } catch {
    return { shoutouts: [...DEMO_SHOUTOUTS] };
  }
}

export function saveShoutouts(data) {
  try {
    localStorage.setItem(SHOUTOUT_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save shoutouts:", err);
  }
}

export function postShoutout({ authorEmail, authorName, message }) {
  const data = loadShoutouts();
  const shoutout = {
    id: "shout-" + Date.now().toString(36),
    authorEmail,
    authorName,
    message: message.slice(0, 160),
    postedAt: new Date().toISOString(),
    reactions: { fire: 0, clap: 0, flex: 0 },
  };
  data.shoutouts.unshift(shoutout);
  if (data.shoutouts.length > MAX_SHOUTOUTS) data.shoutouts = data.shoutouts.slice(0, MAX_SHOUTOUTS);
  saveShoutouts(data);
  return shoutout;
}

export function addReaction(shoutoutId, reaction) {
  const data = loadShoutouts();
  const item = data.shoutouts.find((s) => s.id === shoutoutId);
  if (!item) return;
  if (item.reactions[reaction] !== undefined) item.reactions[reaction] += 1;
  saveShoutouts(data);
}

export function formatTimeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
