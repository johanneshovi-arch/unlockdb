import { useEffect } from "react";
import { Link } from "react-router-dom";
import UnlockdbLogo from "./UnlockdbLogo.jsx";
import "./LandingPage.css";

export default function LandingPage() {
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div className="landing-page">
      <header className="landing-inner">
        <nav className="landing-nav" aria-label="Landing">
          <div className="landing-nav-brand">
            <UnlockdbLogo />
            <div className="landing-nav-brand-text">
              <span className="landing-nav-brand-name">Unlockdb</span>
              <span className="landing-nav-tagline">data change intelligence</span>
            </div>
          </div>
          <div className="landing-nav-actions">
            <Link to="/" className="landing-btn landing-btn-primary">
              Try demo →
            </Link>
            <a
              href="mailto:hello@unlockdb.com"
              className="landing-btn landing-btn-secondary"
            >
              Request access
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-inner landing-hero" aria-labelledby="landing-hero-title">
          <h1 id="landing-hero-title">
            See what changed in your data.
            <br />
            Before it breaks anything.
          </h1>
          <p className="landing-hero-sub">
            The AI-native intelligence layer for Snowflake and Databricks teams.
            <br />
            Talk to your data. Understand what changed. Fix it — before it
            breaks anything.
          </p>
          <div className="landing-hero-actions">
            <Link to="/" className="landing-btn landing-btn-primary">
              Try the demo →
            </Link>
            <a href="#how-it-works" className="landing-btn landing-btn-secondary">
              See how it works ↓
            </a>
          </div>
          <p className="landing-trust-line">
            🔒 Privacy-first by design — your raw data never leaves your warehouse
          </p>
        </section>

        <section className="landing-section" aria-labelledby="problem-title">
          <div className="landing-inner">
            <h2 id="problem-title" className="landing-section-title">
              The problem with passive data tools
            </h2>
            <div className="landing-cards-3">
              <div className="landing-card">
                <div className="landing-card-icon" aria-hidden>
                  ⚡
                </div>
                <h3>Pipeline succeeds</h3>
                <p>
                  Your Snowflake jobs run fine. No errors, no alerts.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon" aria-hidden>
                  📊
                </div>
                <h3>Dashboard loads</h3>
                <p>PowerBI opens normally. Everything looks okay.</p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon" aria-hidden>
                  💥
                </div>
                <h3>Silent data failures</h3>
                <p>
                  Email nulls jumped 20%. Revenue is off. Pipelines look fine.
                  Traditional tools never saw it coming.
                </p>
              </div>
            </div>
            <p className="landing-accent-line">
              Unlockdb&apos;s AI catches this automatically — before your CEO sees
              it.
            </p>
          </div>
        </section>

        <section
          id="how-it-works"
          className="landing-section"
          aria-labelledby="how-title"
        >
          <div className="landing-inner">
            <h2 id="how-title" className="landing-section-title">
              How the intelligence layer works
            </h2>
            <div className="landing-steps">
              <div className="landing-step">
                <div className="landing-step-num">01</div>
                <h3>Connect your warehouse</h3>
                <p>
                  Read-only connection to Snowflake or Databricks. No data
                  leaves your environment.
                </p>
              </div>
              <div className="landing-step">
                <div className="landing-step-num">02</div>
                <h3>AI monitors continuously</h3>
                <p>
                  Unlockdb&apos;s intelligence layer compares snapshots
                  automatically. No manual setup. No rules to write. AI flags
                  what changed and what&apos;s risky.
                </p>
              </div>
              <div className="landing-step">
                <div className="landing-step-num">03</div>
                <h3>Understand and act instantly</h3>
                <p>
                  Ask anything in plain language. The AI Assistant controls
                  the entire app — connect sources, load tables, filter risks,
                  generate SQL — all by just typing what you want.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="landing-section"
          aria-labelledby="ai-control-title"
        >
          <div className="landing-inner">
            <h2 id="ai-control-title" className="landing-section-title">
              Everything controlled by AI
            </h2>
            <p className="landing-ai-control-sub">No clicks required — just ask.</p>
            <div className="landing-feature-grid">
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  💬
                </div>
                <h3>Natural language control</h3>
                <p>
                  Connect sources, load tables, filter risks — all by typing.
                  No manual navigation needed.
                </p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  📊
                </div>
                <h3>Data Explorer</h3>
                <p>
                  See your actual table data visually. Current snapshot,
                  previous snapshot, and diff view with changes highlighted.
                </p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  ⚡
                </div>
                <h3>Schema change detection</h3>
                <p>
                  Instantly flags added, removed, or modified columns before
                  they break downstream queries.
                </p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  📋
                </div>
                <h3>Data Contracts</h3>
                <p>
                  Define rules like &ldquo;email must not be null&rdquo; and get
                  alerted automatically when violated.
                </p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  🔍
                </div>
                <h3>SQL Generator</h3>
                <p>
                  AI generates investigation queries automatically. Copy and run
                  directly in Snowflake or Databricks.
                </p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-card-icon" aria-hidden>
                  🗺️
                </div>
                <h3>Medallion architecture ready</h3>
                <p>
                  Monitor Bronze, Silver and Gold layers independently. Catch
                  issues before they reach your Gold reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="try-it-yourself"
          className="landing-section"
          aria-labelledby="try-title"
        >
          <div className="landing-inner">
            <h2 id="try-title" className="landing-section-title">
              Try it yourself — 2 minutes
            </h2>
            <p className="landing-try-intro">
              Pick one path. No account required for the demo.
            </p>

            <div className="landing-try-path">
              <h3 className="landing-try-path-title">
                Path A: No data? Use our demo
              </h3>
              <ol className="landing-try-steps">
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    🖥️
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Go to the demo</strong>
                    <div className="landing-try-step-actions">
                      <Link to="/" className="landing-btn landing-btn-primary">
                        Open demo →
                      </Link>
                    </div>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    📊
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Click Sources → Snowflake (Warehouse)</strong>
                    <aside className="landing-tip-box" role="note">
                      💡 This is a demo connection — no real Snowflake account
                      needed. It loads a realistic example dataset.
                    </aside>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    🔗
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Click &ldquo;Connect to Snowflake&rdquo;</strong>
                    <p>Wait 1 second for demo data to load.</p>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    📋
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Click &ldquo;customers&rdquo; from the table list</strong>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    🤖
                  </span>
                  <div className="landing-try-step-body">
                    <strong>See AI analysis appear automatically</strong>
                    <p>
                      Ask the AI Assistant anything: &ldquo;What should I fix
                      first?&rdquo; &ldquo;What changed?&rdquo; &ldquo;Show me the
                      risks.&rdquo;
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div
              className="landing-demo-callout"
              role="region"
              aria-label="What the demo shows"
            >
              <p className="landing-demo-callout-title">
                🎯 What you&apos;ll see in the demo:
              </p>
              <ul className="landing-demo-callout-list">
                <li>
                  AI automatically detects that the email column has 20% missing
                  values
                </li>
                <li>Explains why this matters (CRM sync may break)</li>
                <li>Generates a SQL query to investigate</li>
                <li>
                  The AI Assistant answers your questions about the data
                </li>
              </ul>
              <p className="landing-demo-callout-foot">
                This simulates a real Snowflake environment with realistic data
                changes.
              </p>
            </div>

            <div className="landing-try-path">
              <h3 className="landing-try-path-title">
                Path B: Have your own data? Use CSV
              </h3>
              <ol className="landing-try-steps">
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    📤
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Export any table from your database as CSV</strong>
                    <aside className="landing-tip-box" role="note">
                      💡 In Snowflake: Results → Download → CSV
                    </aside>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    📁
                  </span>
                  <div className="landing-try-step-body">
                    <strong>Go to Sources → CSV (demo)</strong>
                    <p>Upload your &ldquo;previous&rdquo; version.</p>
                    <p>Upload your &ldquo;current&rdquo; version.</p>
                  </div>
                </li>
                <li className="landing-try-step">
                  <span className="landing-try-step-icon" aria-hidden>
                    ⚡
                  </span>
                  <div className="landing-try-step-body">
                    <strong>
                      Unlockdb automatically compares them and shows what changed
                    </strong>
                    <aside className="landing-tip-box landing-tip-box--ok" role="note">
                      ✅ Your data never leaves your browser — nothing is sent to
                      our servers
                    </aside>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section
          className="landing-section landing-section-pricing"
          aria-labelledby="pricing-title"
        >
          <div className="landing-inner landing-pricing-inner">
            <h2 id="pricing-title" className="landing-section-title">
              Simple, transparent pricing
            </h2>
            <p className="landing-pricing-sub">
              Start free. Upgrade when ready.
            </p>
            <div className="landing-price-cards">
              <article className="landing-price-card">
                <div className="landing-price-card-top">
                  <span className="landing-price-label">Free</span>
                  <p className="landing-price-amount">$0</p>
                  <p className="landing-price-period">Forever</p>
                </div>
                <ul className="landing-price-features">
                  <li>CSV upload &amp; comparison</li>
                  <li>AI change analysis</li>
                  <li>Up to 3 tables</li>
                  <li>7-day history</li>
                </ul>
                <Link to="/" className="landing-btn landing-btn-secondary landing-price-btn">
                  Try free →
                </Link>
              </article>

              <article className="landing-price-card landing-price-card--pro">
                <div className="landing-price-card-head">
                  <div className="landing-price-card-top">
                    <span className="landing-price-label">Pro</span>
                    <p className="landing-price-amount">$49/mo</p>
                    <p className="landing-price-period">
                      Early access: $29/mo
                    </p>
                  </div>
                  <span className="landing-price-badge">Most popular</span>
                </div>
                <ul className="landing-price-features">
                  <li>✅ Everything in Free</li>
                  <li>✅ Snowflake &amp; Databricks connection</li>
                  <li>✅ Unlimited tables</li>
                  <li>✅ Natural language app control</li>
                  <li>✅ Data Explorer (visual diff)</li>
                  <li>✅ SQL query generator</li>
                  <li>✅ Data Contracts</li>
                  <li>✅ Schema change detection</li>
                  <li>✅ 30-day history</li>
                  <li>✅ Email support</li>
                </ul>
                <a
                  href="mailto:hello@unlockdb.com?subject=Unlockdb%20Pro%20early%20access"
                  className="landing-btn landing-btn-primary landing-price-btn"
                >
                  Get early access →
                </a>
              </article>

              <article className="landing-price-card">
                <div className="landing-price-card-top">
                  <span className="landing-price-label">Enterprise</span>
                  <p className="landing-price-amount">Custom</p>
                  <p className="landing-price-period">For larger teams</p>
                </div>
                <ul className="landing-price-features">
                  <li>Everything in Pro</li>
                  <li>SSO &amp; audit logs</li>
                  <li>Data Processing Agreement</li>
                  <li>SLA guarantee</li>
                  <li>Dedicated support</li>
                  <li>Custom integrations</li>
                </ul>
                <a
                  href="mailto:hello@unlockdb.com?subject=Unlockdb%20Enterprise"
                  className="landing-btn landing-btn-secondary landing-price-btn"
                >
                  Contact us →
                </a>
              </article>
            </div>
            <p className="landing-pricing-foot">
              🔒 All plans: your raw data never leaves your warehouse. Cancel
              anytime. No long-term contracts.
            </p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="compare-title">
          <div className="landing-inner">
            <h2 id="compare-title" className="landing-section-title">
              Intelligence layer vs. legacy tools
            </h2>
            <div className="landing-table-wrap">
              <table className="landing-table">
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Monte Carlo</th>
                    <th scope="col">Soda</th>
                    <th scope="col" className="col-unlockdb">
                      <span className="landing-table-col-eyebrow">AI-native</span>
                      <span className="landing-table-col-name">Unlockdb</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Built-in AI intelligence</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Setup time</td>
                    <td>Weeks</td>
                    <td>Days</td>
                    <td className="col-unlockdb">Minutes ✅</td>
                  </tr>
                  <tr>
                    <td>AI-native</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Explains why</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Raw data privacy</td>
                    <td>⚠️</td>
                    <td>⚠️</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Price</td>
                    <td>$30–100k/yr</td>
                    <td>Custom</td>
                    <td className="col-unlockdb">Affordable ✅</td>
                  </tr>
                  <tr>
                    <td>PLG / self-serve</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Natural language control</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Data Explorer (visual diff)</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>SQL auto-generation</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                  <tr>
                    <td>Medallion architecture support</td>
                    <td>⚠️</td>
                    <td>⚠️</td>
                    <td className="col-unlockdb">✅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="social-title">
          <div className="landing-inner">
            <h2 id="social-title" className="landing-section-title">
              What data teams say
            </h2>
            <div className="landing-quotes">
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;I just typed &lsquo;show me high risk tables&rsquo; and
                  it filtered everything automatically. No manual clicks
                  needed.&rdquo;
                </blockquote>
                <cite>— Data Engineer, Databricks team</cite>
              </div>
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;The SQL generator alone saves me 30 minutes every time
                  there&apos;s a data quality issue.&rdquo;
                </blockquote>
                <cite>— Analytics Engineer, Scale-up</cite>
              </div>
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;Finally a tool that explains WHY something changed —
                  not just that it did. And I can ask follow-up questions.&rdquo;
                </blockquote>
                <cite>— Head of Data, B2B SaaS</cite>
              </div>
            </div>
            <p className="landing-quote-note">Early access quotes</p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="security-title">
          <div className="landing-inner">
            <h2 id="security-title" className="landing-section-title">
              Privacy-first intelligence
            </h2>
            <p className="landing-security-sub">
              The only data intelligence layer that never touches your raw
              data.
            </p>
            <div className="landing-security-grid">
              <div className="landing-security-item">
                <h3>🔒 Raw data stays in your warehouse</h3>
                <p>
                  We never read actual values — only statistics and metadata.
                </p>
              </div>
              <div className="landing-security-item">
                <h3>🤖 AI sees statistics only</h3>
                <p>
                  Null rates, row counts, change summaries. Never emails, names,
                  or business data.
                </p>
              </div>
              <div className="landing-security-item">
                <h3>🛡️ Anthropic API privacy</h3>
                <p>
                  API calls are never used for model training per
                  Anthropic&apos;s policy.
                </p>
              </div>
              <div className="landing-security-item">
                <h3>✅ Read-only access</h3>
                <p>
                  Unlockdb cannot modify, delete, or export your data.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-inner landing-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">Talk to your data warehouse. Get answers in seconds.</h2>
          <div className="landing-cta-actions">
            <Link to="/" className="landing-btn landing-btn-primary">
              Try the demo free →
            </Link>
            <a
              href="mailto:hello@unlockdb.com"
              className="landing-btn landing-btn-secondary"
            >
              Talk to us
            </a>
          </div>
          <p className="landing-cta-note">
            No credit card. No rules to write. No agents to configure. Just
            connect and ask.
          </p>
        </section>
      </main>

      <footer className="landing-inner landing-footer">
        <div className="landing-footer-inner">
          <span>Unlockdb — data change intelligence</span>
          <span>© 2025 Unlockdb</span>
          <div className="landing-footer-links">
            <a href="mailto:hello@unlockdb.com">hello@unlockdb.com</a>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              aria-label="Privacy Policy (coming soon)"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
