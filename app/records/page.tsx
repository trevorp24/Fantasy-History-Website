import { loadLeagueData } from "@/lib/data/loadLeague";

export default function RecordsPage() {
  const data = loadLeagueData();
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Record book</div>
          <h1>Records</h1>
        </div>
      </header>
      <section className="grid cols-3">
        {data.recordBook.map((entry) => (
          <article className="card" key={`${entry.label}-${entry.season ?? "league"}`}>
            <h3>{entry.label}</h3>
            <div className="metric">{entry.value}</div>
            <p>{entry.detail}{entry.season ? ` - ${entry.season}` : ""}</p>
          </article>
        ))}
        {!data.recordBook.length && <div className="card">Records will appear after completed ESPN exports are added.</div>}
      </section>
    </>
  );
}
