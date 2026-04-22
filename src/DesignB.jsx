import { Link } from "react-router-dom";
import "./DesignB.css";

export default function DesignB() {
  return (
    <div className="design-b">
      <div className="design-b__inner">
        <p className="design-b__eyebrow">Data intelligence layer</p>

        <h1>
          See what changed
          <br />
          in your data.
          <span className="design-b__subline">Before it breaks anything.</span>
        </h1>

        <p className="design-b__lede">
          Unlockdb compares baselines, surfaces drift and null shocks, and
          explains impact in language your team can act on — without moving raw
          rows out of Snowflake or Databricks.
        </p>

        <div className="design-b__grid-break" aria-hidden="true" />

        <p className="design-b__stats" role="text">
          <span className="design-b__stat-sep" aria-hidden="true">
            ━━━
          </span>{" "}
          <span className="design-b__stat-em">20</span> tables{" "}
          <span className="design-b__stat-sep" aria-hidden="true">
            ━━━
          </span>{" "}
          <span className="design-b__stat-em">4</span> changes{" "}
          <span className="design-b__stat-sep" aria-hidden="true">
            ━━━
          </span>{" "}
          <span className="design-b__stat-em">1</span> high risk{" "}
          <span className="design-b__stat-sep" aria-hidden="true">
            ━━━
          </span>
        </p>

        <div className="design-b__actions">
          <Link to="/" className="design-b__btn design-b__btn--primary">
            Try the demo
          </Link>
          <Link
            to="/security"
            className="design-b__btn design-b__btn--ghost"
          >
            View security
          </Link>
        </div>

        <section className="design-b__section" aria-labelledby="design-b-craft">
          <h2 id="design-b-craft">Instrument-grade signals</h2>
          <ul className="design-b__features">
            <li>
              <strong style={{ color: "#e8e4d0" }}>Warehouse-native.</strong>{" "}
              Read-only, metadata-first posture so sensitive values never cross
              the line you define.
            </li>
            <li>
              <strong style={{ color: "#e8e4d0" }}>Snapshot discipline.</strong>{" "}
              One mental model: previous vs. current, with automatic risk
              ordering by column and downstream blast radius.
            </li>
            <li>
              <strong style={{ color: "#e8e4d0" }}>Human-readable causality.</strong>{" "}
              Short explanations, then SQL when you are ready to prove it in
              the warehouse.
            </li>
            <li>
              <strong style={{ color: "#e8e4d0" }}>Steady operator loop.</strong> A
              single AI surface across the product — the same context from
              overview to table drill.
            </li>
          </ul>
        </section>

        <div className="design-b__asym design-b__surface">
          <p>
            This preview uses warm neutrals, amber callouts, and zero border
            radii: more drafting table than marketing splash. The production app
            keeps the same data contract.
          </p>
          <div className="design-b__actions" style={{ marginTop: 24 }}>
            <Link
              to="/"
              className="design-b__btn design-b__btn--primary"
            >
              Open Unlockdb
            </Link>
            <Link
              to="/landing"
              className="design-b__btn design-b__btn--ghost"
            >
              Marketing site
            </Link>
          </div>
        </div>

        <p className="design-b__footer">Unlockdb · design preview b · 2026</p>
      </div>
    </div>
  );
}
