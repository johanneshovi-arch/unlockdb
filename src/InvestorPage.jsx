import { useEffect } from "react";
import "./InvestorPage.css";
import UnlockdbLogo from "./UnlockdbLogo.jsx";

const ROADMAP = [
  {
    id: "1",
    date: "May 2026",
    title: "Company founded",
    desc: "Detection engine build starts.",
    icon: "🏗️",
  },
  {
    id: "2",
    date: "Jul–Aug 2026",
    title: "V1 PoC complete",
    desc: "Detection engine validated.",
    icon: "🏗️",
  },
  {
    id: "3",
    date: "Sep–Oct 2026",
    title: "Connectors & partners",
    desc: "Snowflake + Databricks live. First design partners.",
    icon: "🔌",
  },
  {
    id: "4",
    date: "Nov 2026",
    title: "Business Finland",
    desc: "Grant application (€50k).",
    icon: "🏗️",
  },
  {
    id: "5",
    date: "Jan 2027",
    title: "First revenue",
    desc: "MRR: €2k",
    icon: "👥",
  },
  {
    id: "6",
    date: "May 2027",
    title: "PMF signals",
    desc: "MRR: €8k",
    icon: "📈",
  },
  {
    id: "7",
    date: "Nov 2027",
    title: "Scale GTM",
    desc: "MRR: €20k",
    icon: "📈",
  },
  {
    id: "8",
    date: "May 2028",
    title: "Seed + VC",
    desc: "MRR: €35k+ — target raise: €2–3M",
    icon: "🚀",
  },
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

const MARKET_SIZES = [
  { year: "2024", value: 1.7, label: "$1.7B" },
  { year: "2026", value: 3, label: "$3B", here: true },
  { year: "2030", value: 10, label: "$10B" },
];
const MARKET_MAX = 10;

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
        <div className="investor-hero-logo" aria-hidden="true">
          <UnlockdbLogo />
        </div>
        <h1>Unlockdb — The CO detector for your data warehouse</h1>
        <p className="investor-hero-sub">
          AI-native change intelligence for Snowflake and Databricks. Confidential —
          for investors only.
        </p>
        <p className="investor-hero-analogy">
          Like a carbon monoxide detector — silent, invisible data drift is the most
          dangerous kind. You can&apos;t see a column going from 4% null to 22% null.
          Unlockdb catches it before your CEO does.
        </p>
      </header>

      <section className="investor-block" aria-labelledby="sec-problem">
        <h2 id="sec-problem" className="investor-section-title">
          €500k of engineering payroll wasted per company, per year
        </h2>
        <div className="investor-compare" role="img" aria-label="Without vs with Unlockdb">
          <div className="investor-compare-side investor-compare-side--bad">
            <h3 className="investor-compare-label">Without Unlockdb</h3>
            <ul className="investor-compare-list">
              <li>
                <span className="investor-compare-ico" aria-hidden="true">🔥</span>
                <span>
                  Data engineer spends 40–57% of time firefighting
                </span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">😤</span>
                <span>Business finds the problem 74% of the time</span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">💸</span>
                <span>€500k payroll wasted/year</span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">❌</span>
                <span>Unity: $110M loss from one bad-data incident</span>
              </li>
            </ul>
          </div>
          <div className="investor-compare-mid" aria-hidden="true">
            <div className="investor-compare-arrow investor-compare-arrow--v">
              <svg
                className="investor-compare-arrow-svg"
                viewBox="0 0 48 120"
                width="48"
                height="120"
              >
                <defs>
                  <linearGradient
                    id="vc-arrow-grad-v"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#5b21b6" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <line
                  x1="24"
                  y1="8"
                  x2="24"
                  y2="100"
                  stroke="url(#vc-arrow-grad-v)"
                  strokeWidth="2"
                />
                <path
                  d="M 14 90 L 24 108 L 34 90"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="investor-compare-arrow investor-compare-arrow--h">
              <svg
                className="investor-compare-arrow-h-svg"
                viewBox="0 0 160 32"
                width="160"
                height="32"
              >
                <line
                  x1="8"
                  y1="16"
                  x2="140"
                  y2="16"
                  stroke="#7c3aed"
                  strokeWidth="2"
                />
                <path
                  d="M 130 8 L 148 16 L 130 24"
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="investor-compare-mid-txt">Unlock</p>
          </div>
          <div className="investor-compare-side investor-compare-side--good">
            <h3 className="investor-compare-label">With Unlockdb</h3>
            <ul className="investor-compare-list">
              <li>
                <span className="investor-compare-ico" aria-hidden="true">✅</span>
                <span>Drift detected automatically</span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">⚡</span>
                <span>Alert in Slack within minutes</span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">🎯</span>
                <span>AI explains what happened and why</span>
              </li>
              <li>
                <span className="investor-compare-ico" aria-hidden="true">💰</span>
                <span>20–60x ROI at €29/month</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-market">
        <h2 id="sec-market" className="investor-section-h">
          Data Quality &amp; Observability Market
        </h2>
        <p className="investor-market-source">Source: multiple analyst sources</p>
        <div className="investor-market" role="img" aria-label="Market size 2024 to 2030">
          {MARKET_SIZES.map((m) => {
            const h = MARKET_MAX <= 0 ? 0 : (m.value / MARKET_MAX) * 100;
            return (
              <div
                className={
                  "investor-market-item" + (m.here ? " investor-market-item--here" : "")
                }
                key={m.year}
              >
                <div className="investor-market-bubble-wrap">
                  <div
                    className="investor-market-bubble"
                    style={{ height: `${Math.max(8, h)}%` }}
                  />
                </div>
                <div className="investor-market-year">{m.year}</div>
                <div className="investor-market-val">{m.label}</div>
                {m.here ? <div className="investor-market-pill">We are here</div> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-solution">
        <h2 id="sec-solution" className="investor-section-title">
          Drift detection that works. Alerts you&apos;ll actually act on.
        </h2>

        <div
          className="investor-arch"
          role="img"
          aria-label="Snowflake and Databricks connect to the Unlockdb engine, which routes to Slack, Jira, PagerDuty, and webhooks"
        >
          <div className="investor-arch-grid">
            <div className="investor-arch-g11 investor-arch-box">Snowflake</div>
            <div className="investor-arch-ah g12" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-eng">
              <span className="investor-arch-eng-in">Unlockdb Engine</span>
              <span className="investor-arch-eng-sub">AI-native detection engine</span>
            </div>
            <div className="investor-arch-ah g14" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-g15 investor-arch-box">Slack</div>
            <div className="investor-arch-g21 investor-arch-box">Databricks</div>
            <div className="investor-arch-ah g22" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-ah g24" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-g25 investor-arch-box">Jira</div>
            <div className="investor-arch-sp g31" aria-hidden="true" />
            <div className="investor-arch-sp g32" aria-hidden="true" />
            <div className="investor-arch-ah g34" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-g35 investor-arch-box">PagerDuty</div>
            <div className="investor-arch-sp g41" aria-hidden="true" />
            <div className="investor-arch-sp g42" aria-hidden="true" />
            <div className="investor-arch-ah g44" aria-hidden="true">
              →
            </div>
            <div className="investor-arch-g45 investor-arch-box">Webhook</div>
          </div>
        </div>

        <div className="investor-card-grid investor-solution-grid">
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
          <div className="investor-milestone-row">
            {ROADMAP.map((item) => (
              <article className="investor-milestone-card" key={item.id}>
                <div className="investor-milestone-top">
                  <div className="investor-milestone-dot" aria-hidden="true" />
                  <div className="investor-milestone-date">{item.date}</div>
                </div>
                <div className="investor-milestone-ico" aria-hidden="true">
                  {item.icon}
                </div>
                <h3 className="investor-milestone-title">{item.title}</h3>
                <p className="investor-milestone-desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="investor-block" aria-labelledby="sec-mrr">
        <h2 id="sec-mrr" className="investor-section-title">
          Path to €35k MRR
        </h2>
        <div className="investor-mrr">
          <div
            className="investor-mrr-bars"
            role="img"
            aria-label="MRR bar chart 2026 to 2028"
          >
            {MRR_DATA.map((d) => {
              const pct = MRR_MAX <= 0 ? 0 : (d.value / MRR_MAX) * 100;
              const barH =
                d.value === 0 ? "2px" : `${Math.max(1, pct)}%`;
              return (
                <div className="investor-mrr-col" key={d.label}>
                  <div className="investor-mrr-bar-h">
                    <div className="investor-mrr-bar" style={{ height: barH }} />
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
