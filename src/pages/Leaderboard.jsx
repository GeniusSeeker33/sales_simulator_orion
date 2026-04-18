import Layout from "../components/layout/Layout";

const reps = [
  { rank: 1, name: "John D", revenue: "$12,400", score: 91 },
  { rank: 2, name: "Sarah K", revenue: "$11,200", score: 88 },
  { rank: 3, name: "Desiree T", revenue: "$9,800", score: 84 },
];

export default function Leaderboard() {
  return (
    <Layout title="Leaderboard">
      <div className="card">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Revenue</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => (
              <tr key={rep.rank}>
                <td>{rep.rank}</td>
                <td>{rep.name}</td>
                <td>{rep.revenue}</td>
                <td>{rep.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}