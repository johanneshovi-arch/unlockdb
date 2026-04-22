import { Link } from "react-router-dom";
import "./DesignA.css";

export default function DesignA() {
  return (
    <div className="design-a">
      <div className="design-a__inner">
        <p className="design-a__version">
          UNLOCKDB v0.1.0 — DATA CHANGE INTELLIGENCE
        </p>

        <h1>
          SEE WHAT CHANGED IN YOUR DATA
          <br />
          BEFORE IT BREAKS ANYTHING.
        </h1>
        <p style={{ margin: "8px 0 0", color: "#00ff88" }}>
          <span className="design-a__cursor" aria-hidden>
            ▌
          </span>
        </p>

        <p className="design-a__sub">
          <span className="design-a__prompt">&gt; </span>
          AI-native intelligence layer
          <br />
          for Snowflake and Databricks
        </p>

        <div className="design-a__stats" aria-label="Status summary">
          <div className="design-a__stat-line">[TABLES_MONITORED: 20]</div>
          <div className="design-a__stat-line">
            [CHANGES_DETECTED: 4 <span className="design-a__danger">⚠</span>]
          </div>
          <div className="design-a__stat-line">
            [HIGH_RISK: 1 <span className="design-a__danger">✗</span>]
          </div>
          <div className="design-a__stat-line">[SCHEMA_CHANGES: 0 ✓]</div>
        </div>

        <div className="design-a__actions">
          <Link to="/" className="design-a__btn" style={{ color: "#00ff88" }}>
            [RUN DEMO →]
          </Link>
          <a href="/landing" className="design-a__btn">
            [VIEW DOCS]
          </a>
        </div>

        <section className="design-a__section" aria-labelledby="design-a-features">
          <h2 id="design-a-features">// feature_stack</h2>
          <ul className="design-a__features">
            <li>
              <span className="design-a__feature-tag">[01]</span>
              Read-only warehouse connection — raw values never leave your
              environment. Statistical metadata only.
            </li>
            <li>
              <span className="design-a__feature-tag">[02]</span>
              Continuous snapshot diff: null drift, new values, schema signals,
              risk triage in one pass.
            </li>
            <li>
              <span className="design-a__feature-tag">[03]</span>
              AI explanations + SQL to investigate. Plain language first, then
              drill to rows.
            </li>
            <li>
              <span className="design-a__feature-tag">[04]</span>
              Sticky command interface on every view — one session, same
              context.
            </li>
          </ul>
        </section>

        <div className="design-a__cta-block">
          <p>ready_to_proceed?</p>
          <Link
            to="/"
            className="design-a__btn"
            style={{ color: "#00ff88" }}
          >
            [INIT DEMO SESSION]
          </Link>
        </div>

        <p className="design-a__footer">
          UNLOCKDB · PREVIEW A · NOT PRODUCTION
        </p>
      </div>
    </div>
  );
}
