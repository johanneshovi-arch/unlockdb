import { useEffect } from "react";
import "./InvestorPage.css";

const ROADMAP = [
  { id: "1", date: "May 2026", text: "Company founded. Detection engine build starts." },
  { id: "2", date: "Jul–Aug 2026", text: "V1 PoC complete. Detection engine validated." },
  { id: "3", date: "Sep–Oct 2026", text: "Snowflake + Databricks connectors live. First design partners." },
  { id: "4", date: "Nov 2026", text: "Business Finland grant application (€50k)." },
  { id: "5", date: "Jan 2027", text: "First paying customers. MRR: €2k" },
  { id: "6", date: "May 2027", text: "Product-market fit signals. MRR: €8k" },
  { id: "7", date: "Nov 2027", text: "Scaling GTM. MRR: €20k" },
  { id: "8", date: "May 2028", text: "Seed VC round. MRR: €35k+ — Target raise: €2–3M" },
];

const MRR_DATA = [
  { label: "Nov 2026", value: 0 },
  { label: "Jan 2027", value: 2000 },
  { label: "Apr 2027", value: 5000 },
  { label: "Jul 2027", value: 10000 },
  { label: "Oct 2027", value: 18000 },
  { label: "Jan 2028", value: 27000 },
  { label: "May 2028", value: 35000 },
];

const MRR_MAX = 35000;

function formatEur(n) {
  if (n === 0) return "€0";
  return "€" + n.toLocaleString("en-IE", { maximumFractionDigits: 0 });
}

export default function InvestorPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Unlockdb — Investors";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="investor-page" lang="en">
      <header className="investor-hero" role="banner">
        <h1>Unlockdb — The CO detector for your data warehouse</h1>
        <p className="investor-hero-sub">
          AI-native change intelligence for Snowflake and Databricks. Confidential —
          for investors only.
        </p>
      </header>

      <section className="investor-block" aria-labelledby="sec-problem">
        <h2 id="sec-problem" className="investor-section-title">
          €500k of engineering payroll wasted per company, per year
        </h2>
        <div className="investor-card-grid investor-stat">
          <div className="investor-card">
            <p>40–57% of data engineer time spent on data quality firefighting</p>
          </div>
          <div className="investor-card">
            <p>
              74% of data issues found by business stakeholders, not the data
              team
            </p>
          </div>
          <div className="investor-card">
            <p>Unity lost $110M from a single bad-data incident (Q1 2022)</p>
          </div>
          <div className="investor-card">
            <p>Market: $3B today → $10B by 2030 (15–21% CAGR)</p>
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-solution">
        <h2 id="sec-solution" className="investor-section-title">
          Drift detection that works. Alerts you&apos;ll actually act on.
        </h2>
        <div className="investor-card-grid">
          <div className="investor-card">
            <p>
              Detects schema changes, null-rate shifts, distribution changes
              automatically
            </p>
          </div>
          <div className="investor-card">
            <p>
              AI explains every alert with full context: what changed, why it
              matters, what to do
            </p>
          </div>
          <div className="investor-card">
            <p>
              Integrates into Slack, Jira, PagerDuty — no new tools to learn
            </p>
          </div>
          <div className="investor-card">
            <p>
              Statistics-only: raw customer data never leaves the warehouse
            </p>
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-whynow">
        <h2 id="sec-whynow" className="investor-section-title">
          Built AI-native. Not AI-added.
        </h2>
        <ul className="investor-why-list">
          <li>
            Monte Carlo, Soda built pre-LLM — retrofitting AI on legacy
            architecture
          </li>
          <li>
            Unlockdb built from ground up with AI at the core of every alert
          </li>
          <li>
            20–60x ROI for mid-market customer at €29/month entry price
          </li>
        </ul>
        <p className="investor-tagline">
          We surface only what is contextual, timely, and specific. If we
          cannot be all three — we do not surface it.
        </p>
      </section>

      <section className="investor-block" aria-labelledby="sec-roadmap">
        <h2 id="sec-roadmap" className="investor-section-title">
          From PoC to VC-ready in 24 months
        </h2>
        <div className="investor-tl-scroll">
          <div className="investor-tl-row">
            {ROADMAP.map((item, i) => (
              <div className="investor-tl-seg" key={item.id}>
                <div className="investor-tl-head">
                  <div className="investor-tl-dot" aria-hidden="true" />
                  {i < ROADMAP.length - 1 ? <div className="investor-tl-conn" /> : null}
                </div>
                <div className="investor-tl-body">
                  <div className="investor-tl-date">{item.date}</div>
                  <p className="investor-tl-text">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-mrr">
        <h2 id="sec-mrr" className="investor-section-title">
          Path to €35k MRR
        </h2>
        <div className="investor-mrr">
          <div className="investor-mrr-bars" role="img" aria-label="MRR bar chart 2026 to 2028">
            {MRR_DATA.map((d) => {
              const pct =
                MRR_MAX <= 0 ? 0 : (d.value / MRR_MAX) * 100;
              const barH =
                d.value === 0
                  ? "2px"
                  : `${Math.max(1, pct)}%`;
              return (
                <div className="investor-mrr-col" key={d.label}>
                  <div className="investor-mrr-bar-h">
                    <div
                      className="investor-mrr-bar"
                      style={{ height: barH }}
                    />
                  </div>
                  <div className="investor-mrr-meta">
                    <div className="investor-mrr-label">{d.label}</div>
                    <div className="investor-mrr-value">{formatEur(d.value)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-gtm">
        <h2 id="sec-gtm" className="investor-section-title">
          PLG first. Then sales-assist.
        </h2>
        <div className="investor-gtm-row">
          <strong>Phase 1</strong>
          Product-led growth. Data engineers self-serve. Free tier, instant value.
        </div>
        <div className="investor-gtm-row">
          <strong>Phase 2</strong>
          Community-led. dbt Slack (25,000+ members), LinkedIn data engineering
          groups, design partner case studies.
        </div>
        <div className="investor-gtm-row">
          <strong>Phase 3</strong>
          Sales-assist. Outbound to mid-market data teams. ACV target: €500–2,000/year
          entry, €5,000–15,000 enterprise.
        </div>
        <div className="investor-card" style={{ marginTop: "0.75rem" }}>
          <p style={{ fontSize: "0.9rem" }}>
            <strong style={{ color: "#e5e5e5" }}>Target customer:</strong> Data
            engineering team of 3–10 people on Snowflake or Databricks
          </p>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-unit">
        <h2 id="sec-unit" className="investor-section-title">
          Healthy margins from day one
        </h2>
        <div className="investor-card-grid">
          <div className="investor-card">
            <p>~98% gross margin</p>
          </div>
          <div className="investor-card">
            <p>€0.50–24/month cost to serve</p>
          </div>
          <div className="investor-card">
            <p>€29/mo Starter · €99/mo Pro</p>
          </div>
          <div className="investor-card">
            <p>€80–150/mo average customer MRR</p>
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-team">
        <h2 id="sec-team" className="investor-section-title">
          Operators who&apos;ve done this before
        </h2>
        <div className="investor-team-grid">
          <div className="investor-card investor-team-card">
            <h3>Johannes Hovi</h3>
            <p className="role">Co-founder &amp; CEO</p>
            <ul>
              <li>Founded Ellie.ai, raised €2.5M international VC</li>
              <li>Domain: data, AI, enterprise software</li>
              <li>Previously: Hovi Competence Development (founder, 60% owner)</li>
            </ul>
          </div>
          <div className="investor-card investor-team-card">
            <h3>Markus Sandelin</h3>
            <p className="role">Co-founder &amp; CTO</p>
            <ul>
              <li>
                Founded King Muffin (2013) — built and sold to global financial
                institute
              </li>
              <li>Fractional CTO/CPO at Toptal (top 3% of candidates globally)</li>
              <li>AI Lead &amp; Domain Architect, NATO NCI Agency</li>
              <li>Identified $40M+ annual savings via data architecture redesign</li>
              <li>Built engineering teams across 10+ countries</li>
            </ul>
          </div>
          <div className="investor-card investor-team-card">
            <h3>Mikko Välimäki</h3>
            <p className="role">Advisor &amp; Angel Investor</p>
            <ul>
              <li>Co-CEO IQM, raised $300M+</li>
              <li>Exit: Tuxera</li>
              <li>Board: QT Group (NASDAQ Helsinki)</li>
              <li>Ellie.ai investor</li>
              <li>Committed to this round</li>
            </ul>
          </div>
          <div className="investor-card investor-team-card">
            <h3>Harri Siepp</h3>
            <p className="role">Advisor &amp; Angel Investor (pending)</p>
            <ul>
              <li>Founded and took Witted public</li>
              <li>Deep network in Finnish data/tech ecosystem</li>
              <li>In conversation</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-ask">
        <h2 id="sec-ask" className="investor-section-title">
          We&apos;re raising €200k angel round
        </h2>
        <div className="investor-ask-blocks">
          <div className="investor-ask-line">€200,000 pre-seed via SAFE instrument</div>
          <div className="investor-ask-line">
            Use of funds: 18 months runway, Snowflake/Databricks connectors,
            first design partners
          </div>
          <div className="investor-ask-line">Target close: Q3 2026</div>
        </div>
        <div className="investor-investors" role="status">
          Mikko Välimäki — committed
        </div>
        <a
          className="investor-cta"
          href="mailto:johannes@unlockdb.com?subject=Request%20full%20Unlockdb%20deck"
        >
          Request full deck → johannes@unlockdb.com
        </a>
      </section>

      <footer className="investor-foot">
        <p>Confidential. For accredited investors only. Not for distribution.</p>
        <p>© 2026 Unlockdb</p>
      </footer>
    </div>
  );
}
