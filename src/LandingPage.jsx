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
            <span>Unlockdb</span>
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
            AI-native change intelligence for Snowflake and Databricks teams.
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
            🔒 Your raw data never leaves your warehouse — Claude sees statistics
            only
          </p>
        </section>

        <section className="landing-section" aria-labelledby="problem-title">
          <div className="landing-inner">
            <h2 id="problem-title" className="landing-section-title">
              The silent data problem
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
                <h3>Data is already wrong</h3>
                <p>
                  Email nulls jumped 20%. Revenue numbers are off. Nobody
                  noticed.
                </p>
              </div>
            </div>
            <p className="landing-accent-line">
              Unlockdb catches this before your CEO sees it.
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
              How it works
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
                <h3>AI detects changes</h3>
                <p>
                  Unlockdb compares snapshots and automatically flags what
                  changed, what&apos;s risky, and what might break.
                </p>
              </div>
              <div className="landing-step">
                <div className="landing-step-num">03</div>
                <h3>Understand instantly</h3>
                <p>
                  Plain-language explanations, affected downstream systems, and
                  SQL queries to investigate.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="compare-title">
          <div className="landing-inner">
            <h2 id="compare-title" className="landing-section-title">
              Built for the AI era
            </h2>
            <div className="landing-table-wrap">
              <table className="landing-table">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col">Monte Carlo</th>
                    <th scope="col">Soda</th>
                    <th scope="col" className="col-unlockdb">
                      Unlockdb
                    </th>
                  </tr>
                </thead>
                <tbody>
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
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="social-title">
          <div className="landing-inner">
            <h2 id="social-title" className="landing-section-title">
              Trusted by data teams
            </h2>
            <div className="landing-quotes">
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;Finally a tool that explains WHY the data changed, not
                  just that it did.&rdquo;
                </blockquote>
                <cite>— Data Engineer, SaaS company</cite>
              </div>
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;We caught a breaking schema change before it hit our
                  revenue dashboard.&rdquo;
                </blockquote>
                <cite>— Analytics Engineer</cite>
              </div>
              <div className="landing-quote-card">
                <blockquote>
                  &ldquo;Setup took 5 minutes. Monte Carlo took 3 months.&rdquo;
                </blockquote>
                <cite>— Head of Data</cite>
              </div>
            </div>
            <p className="landing-quote-note">Early access quotes</p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="security-title">
          <div className="landing-inner">
            <h2 id="security-title" className="landing-section-title">
              Privacy-first by design
            </h2>
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
          <h2 id="cta-title">Ready to see what&apos;s changing in your data?</h2>
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
            No credit card. No setup. Connect in minutes.
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
