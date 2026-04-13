import { useEffect, useMemo, useRef, useState } from "react";

let lastSnapshotKeyForHistory = "";

const SNOWFLAKE_DEMO_PREVIOUS = [
  {
    customer_id: "cust-1001",
    email: "alice@vieno.fi",
    country: "Finland",
    plan_tier: "Free",
    mrr: "0",
  },
  {
    customer_id: "cust-1002",
    email: "bertil@nordiq.se",
    country: "Sweden",
    plan_tier: "Pro",
    mrr: "49",
  },
  {
    customer_id: "cust-1003",
    email: "camilla@fjell.no",
    country: "Norway",
    plan_tier: "Free",
    mrr: "0",
  },
  {
    customer_id: "cust-1004",
    email: "david@vieno.fi",
    country: "Finland",
    plan_tier: "Pro",
    mrr: "49",
  },
  {
    customer_id: "cust-1005",
    email: "elena@nordiq.se",
    country: "Sweden",
    plan_tier: "Free",
    mrr: "0",
  },
];

const SNOWFLAKE_DEMO_CURRENT = [
  {
    customer_id: "cust-1001",
    email: "alice@vieno.fi",
    country: "Finland",
    plan_tier: "Free",
    mrr: "0",
  },
  {
    customer_id: "cust-1002",
    email: null,
    country: "Sweden",
    plan_tier: "Pro",
    mrr: "49",
  },
  {
    customer_id: "cust-1003",
    email: "camilla@fjell.no",
    country: "Norway",
    plan_tier: "Pro",
    mrr: "99",
  },
  {
    customer_id: "cust-1004",
    email: "david@vieno.fi",
    country: "Denmark",
    plan_tier: "Pro",
    mrr: "49",
  },
  {
    customer_id: "cust-1005",
    email: "elena@nordiq.se",
    country: "Sweden",
    plan_tier: "Enterprise",
    mrr: "0",
  },
];

const DATABRICKS_DEMO_PREVIOUS = [
  {
    event_id: "evt-001",
    user_id: "u-1001",
    event_type: "login",
    country: "Finland",
    event_time: "2025-04-01T09:00:00Z",
  },
  {
    event_id: "evt-002",
    user_id: "u-1002",
    event_type: "purchase",
    country: "Sweden",
    event_time: "2025-04-01T10:15:00Z",
  },
  {
    event_id: "evt-003",
    user_id: "u-1003",
    event_type: "view",
    country: "Norway",
    event_time: "2025-04-01T11:00:00Z",
  },
  {
    event_id: "evt-004",
    user_id: "u-1001",
    event_type: "purchase",
    country: "Finland",
    event_time: "2025-04-01T14:00:00Z",
  },
  {
    event_id: "evt-005",
    user_id: "u-1004",
    event_type: "login",
    country: "Sweden",
    event_time: "2025-04-01T15:30:00Z",
  },
  {
    event_id: "evt-006",
    user_id: "u-1002",
    event_type: "view",
    country: "Norway",
    event_time: "2025-04-01T16:00:00Z",
  },
];

const DATABRICKS_DEMO_CURRENT = [
  {
    event_id: "evt-001",
    user_id: "u-1001",
    event_type: "login",
    country: "Finland",
    event_time: "2025-04-02T09:00:00Z",
  },
  {
    event_id: "evt-002",
    user_id: "u-1002",
    event_type: "purchase",
    country: "Sweden",
    event_time: "2025-04-02T10:15:00Z",
  },
  {
    event_id: "evt-003",
    user_id: "u-1003",
    event_type: "view",
    country: "Norway",
    event_time: "2025-04-02T11:00:00Z",
  },
  {
    event_id: "evt-004",
    user_id: "u-1001",
    event_type: "purchase",
    country: "Finland",
    event_time: "2025-04-02T14:00:00Z",
  },
  {
    event_id: "evt-005",
    user_id: "u-1004",
    event_type: "login",
    country: "Sweden",
    event_time: "2025-04-02T15:30:00Z",
  },
  {
    event_id: "evt-006",
    user_id: "u-1002",
    event_type: "view",
    country: "Norway",
    event_time: "2025-04-02T16:00:00Z",
  },
  {
    event_id: "evt-007",
    user_id: null,
    event_type: "login",
    country: "Finland",
    event_time: "2025-04-02T17:00:00Z",
  },
  {
    event_id: "evt-008",
    user_id: "u-1005",
    event_type: "refund",
    country: "Denmark",
    event_time: "2025-04-02T18:00:00Z",
  },
];

const SAMPLE_PREVIOUS_DATA = [
  { name: "Alice", age: 25, country: "Finland" },
  { name: "Bob", age: 30, country: "Sweden" },
  { name: "Charlie", age: 35, country: "Norway" },
];

const SAMPLE_CURRENT_DATA = [
  { name: "Alice", age: 25, country: "Finland" },
  { name: "Bob", age: 30, country: "Sweden" },
  { name: "Charlie", age: 35, country: "Norway" },
  { name: null, age: 40, country: "Denmark" },
];

const COLUMN_SENSITIVITY_PRESETS = {
  name: "Sensitive",
  age: "Internal",
  country: "Public",
  customer_id: "Internal",
  email: "Sensitive",
  plan_tier: "Internal",
  mrr: "Internal",
  event_id: "Internal",
  user_id: "Sensitive",
  event_type: "Internal",
  event_time: "Internal",
};

function presetSensitivity(key) {
  const k = String(key).toLowerCase();
  return COLUMN_SENSITIVITY_PRESETS[k] ?? "Internal";
}

function humanizeColumnKey(key) {
  const s = String(key).replace(/_/g, " ");
  if (!s.length) return key;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseCsvLine(line) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(field.trim());
      field = "";
    } else {
      field += c;
    }
  }
  result.push(field.trim());
  return result;
}

function parseCsv(text) {
  const normalized = text.replace(/^\ufeff/, "");
  const lines = normalized
    .split(/\n/)
    .map((l) => l.replace(/\r$/, "").trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], headerKeys: [] };
  }
  const headerKeys = parseCsvLine(lines[0]).map((h) =>
    h.replace(/^\ufeff/, "").trim()
  );
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    headerKeys.forEach((key, j) => {
      const raw = cells[j];
      row[key] =
        raw === undefined || raw === "" || raw === '""' ? null : raw;
    });
    rows.push(row);
  }
  return { rows, headerKeys };
}

function buildColumnsFromCurrentOnly(currentRows) {
  if (!currentRows.length) return [];
  const order = [];
  const seen = new Set();
  function pushKey(k) {
    if (!k || seen.has(k)) return;
    seen.add(k);
    order.push(k);
  }
  for (const k of Object.keys(currentRows[0])) pushKey(k);
  for (const r of currentRows) {
    if (!r || typeof r !== "object") continue;
    for (const k of Object.keys(r)) pushKey(k);
  }
  return order.map((key) => ({
    key,
    label: humanizeColumnKey(key),
    sensitivity: presetSensitivity(key),
  }));
}

function valueSetNonNull(data, key) {
  const s = new Set();
  for (const row of data) {
    const v = row?.[key];
    if (v !== null && v !== undefined) s.add(v);
  }
  return s;
}

function findFirstNullRowDisplayIndex(data, key) {
  for (let i = 0; i < data.length; i++) {
    const v = data[i]?.[key];
    if (v === null || v === undefined) return i + 1;
  }
  return null;
}

function findFirstRowWithValue(data, key, value) {
  for (let i = 0; i < data.length; i++) {
    if (data[i]?.[key] === value) return i + 1;
  }
  return null;
}

const COLUMN_DOWNSTREAM = {
  name: {
    mayBreak: ["User profile service"],
    mayAffect: [
      "CRM segmentation dashboard",
      "PowerBI: User segmentation",
    ],
  },
  age: {
    mayBreak: [],
    mayAffect: [
      "User segmentation dashboard",
      "PowerBI: User segmentation",
    ],
  },
  country: {
    mayBreak: [],
    mayAffect: [
      "Geo analytics dashboard",
      "Revenue dashboard",
      "Looker: Revenue by country",
    ],
  },
  event_id: {
    mayBreak: ["Event deduplication jobs"],
    mayAffect: ["Pipeline watermarking", "Idempotent ingest checks"],
  },
  user_id: {
    mayBreak: ["Identity resolution service", "User journey pipeline"],
    mayAffect: ["Session stitching", "Attribution and cohort models"],
  },
  event_type: {
    mayBreak: ["Product analytics funnel definitions"],
    mayAffect: ["Product analytics dashboard", "Feature adoption reports"],
  },
  event_time: {
    mayBreak: ["Event freshness monitors", "Time-series aggregation jobs"],
    mayAffect: ["Real-time dashboards", "Hourly event volume reporting"],
  },
  email: {
    mayBreak: ["CRM sync", "User identity service"],
    mayAffect: ["Marketing automation", "Support ticketing (email match)"],
  },
  plan_tier: {
    mayBreak: [],
    mayAffect: ["Billing analytics", "Product usage dashboards"],
  },
  mrr: {
    mayBreak: [],
    mayAffect: ["Revenue dashboards", "Finance reporting (ARR/MRR)"],
  },
};

function getDownstreamForColumn(key) {
  const d = COLUMN_DOWNSTREAM[String(key).toLowerCase()];
  return (
    d ?? {
      mayBreak: ["Downstream pipelines (demo)"],
      mayAffect: ["BI and reporting layers"],
    }
  );
}

const DATA_SOURCE_OPTIONS = [
  { id: "snowflake", label: "Snowflake (Warehouse)", recommended: true },
  { id: "databricks", label: "Databricks (Lakehouse)" },
  { id: "fabric", label: "Microsoft Fabric (OneLake)" },
  { id: "csv", label: "CSV (demo)" },
];

function formatStatChangeBullet(statChange) {
  return statChange.changeText;
}

function simpleStringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickVariant(seed, variants) {
  if (!variants.length) return "";
  return variants[seed % variants.length];
}

function inferExplainChangeKind(statChange) {
  const t = statChange.changeText ?? "";
  if (
    statChange.drillKind === "null_increase" ||
    /\bnulls? increased\b/i.test(t)
  ) {
    return "null_increase";
  }
  if (
    statChange.drillKind === "new_values" ||
    /\bintroduced new value/i.test(t)
  ) {
    return "new_values";
  }
  if (
    statChange.drillKind === "removed_values" ||
    /\bremoved value:/i.test(t)
  ) {
    return "removed_values";
  }
  if (/\bnulls? decreased\b/i.test(t)) return "null_decrease";
  if (
    /fewer distinct|more distinct|distribution changed|distinct \d/i.test(t)
  ) {
    return "distribution";
  }
  return "generic";
}

function columnDomainHint(columnKey) {
  const k = String(columnKey ?? "").toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("country")) return "country";
  if (k.includes("event_type")) return "event_type";
  if (
    /\b(amount|revenue|mrr|price|total|cost)\b/.test(k) ||
    k.includes("amount") ||
    k.includes("revenue")
  ) {
    return "money";
  }
  if (
    k === "id" ||
    k.endsWith("_id") ||
    /(^|_)id($|_)/.test(k) ||
    (k.includes("id") && (k.includes("user") || k.includes("customer")))
  ) {
    return "identity";
  }
  if (k.includes("id")) return "identity";
  return "generic";
}

function findRiskForStatChange(statChange, riskFindings) {
  if (!statChange?.columnKey) return null;
  return riskFindings.find((r) => r.id === statChange.columnKey) ?? null;
}

function buildAiExplainForStatChange(statChange, riskFindings) {
  const risk = findRiskForStatChange(statChange, riskFindings);
  const kind = inferExplainChangeKind(statChange);
  const domain = columnDomainHint(statChange.columnKey);
  const label = statChange.columnLabel ?? statChange.columnKey ?? "Column";
  const seed = simpleStringHash(statChange.id);
  const ct = (statChange.changeText ?? "").trim();

  const domainNoun = {
    identity: "identity resolution, joins, and user-level attribution",
    email: "email-based CRM syncs and user communication",
    country: "geo analytics and regional reporting",
    event_type: "product analytics, funnels, and event-based dashboards",
    money: "financial and KPI reporting",
    generic: "downstream analytics and integrations",
  }[domain];

  const title =
    ct.length <= 72 ? `${label}: ${ct}` : `${label} — ${ct.slice(0, 68)}…`;

  const whatParts = [
    `We compared your baseline and current snapshots and spotted: ${ct}.`,
  ];
  if (risk?.exampleIssue) {
    whatParts.push(`Concrete signal: ${risk.exampleIssue}`);
  }
  const whatChanged = whatParts.join(" ");

  let impact = "";
  if (kind === "null_increase") {
    impact = `More missing values can quietly disrupt ${domainNoun}. Dashboards and pipelines that assume this field is populated may skew or fail.`;
  } else if (kind === "new_values") {
    impact = `New values shift how ${domainNoun} behave—filters, segments, and rules may need updating before metrics look trustworthy again.`;
  } else if (kind === "removed_values") {
    impact = `Values disappearing from ${domainNoun} can hollow out segments and break joins or lookups that still expect the old categories.`;
  } else if (kind === "null_decrease") {
    impact = `Fewer nulls usually help ${domainNoun}, but sudden shifts can still desync historical comparisons—worth validating it's intentional.`;
  } else if (kind === "distribution") {
    impact = `Distribution drift in this field can distort ${domainNoun}—trends and breakdowns may reflect data changes rather than real-world shifts.`;
  } else {
    impact = `This shift may affect ${domainNoun}. ${risk?.whyMatters ? risk.whyMatters : "Review consumers of this column to be safe."}`;
  }

  const likelyNull = [
    "This pattern often shows up when an ingestion job, sync, or transformation stops mapping the field—or starts writing blanks for some rows.",
    "Usually it's upstream: a connector schema change, a bug in an ELT step, or a source system that began omitting the value.",
  ];
  const likelyNew = [
    "New categories commonly come from product releases, marketing campaigns, or upstream enums expanding without a coordinated rollout.",
    "Often a team enabled a new event, SKU, or dimension value before dashboards and mappings were refreshed.",
  ];
  const likelyRemoved = [
    "Removed values frequently trace to data retention rules, deduping, or a breaking change in how the source encodes categories.",
    "Sometimes an upstream job now filters rows differently, so certain labels never reach this snapshot.",
  ];
  const likelyDist = [
    "Distribution shifts can be seasonal—or a sign that sampling, filters, or warehouse logic changed between snapshots.",
    "Worth checking whether the extract window, cluster, or warehouse view changed while the business stayed the same.",
  ];
  const likelyGeneric = [
    "Without live lineage we can't know for sure—treat this as a signal to compare pipeline versions and source configs between the two loads.",
    "Often it's a mix of product change and pipeline change; the fix is to confirm which side moved first.",
  ];

  let likelyPool = likelyGeneric;
  if (kind === "null_increase" || kind === "null_decrease") likelyPool = likelyNull;
  else if (kind === "new_values") likelyPool = likelyNew;
  else if (kind === "removed_values") likelyPool = likelyRemoved;
  else if (kind === "distribution") likelyPool = likelyDist;

  const likelyCause = pickVariant(seed, likelyPool);

  const actNull = [
    `Inspect the job or transformation that writes “${label}”—replay a small batch and confirm the field is populated end-to-end.`,
    `Compare schema contracts and null-handling rules between baseline and current extracts, then add monitoring on null rate for “${label}”.`,
  ];
  const actNew = [
    `Update dimension / lookup tables and dashboard filters to include the new values for “${label}”, then tell stakeholders.`,
    `Document the new category, backfill mappings if needed, and add a test that flags unknown “${label}” values.`,
  ];
  const actRemoved = [
    `Confirm whether removed “${label}” values are expected; if not, restore upstream logic or adjust dependent reports.`,
    `Search downstream models for hard-coded references to the old “${label}” values and patch or deprecate them.`,
  ];
  const actDist = [
    `Reconcile snapshot definitions (time window, warehouse, filters) and add a simple distribution check to catch silent drift.`,
    `Plot “${label}” over time and tag the deploy or config change that lines up with the shift.`,
  ];
  const actGeneric = [
    `Share this diff with the owner of “${label}” and walk through baseline vs current row samples in the Details grid.`,
    `Use the drill-down and copilot filters to isolate affected rows, then trace them back to the ingestion step.`,
  ];

  let actPool = actGeneric;
  if (kind === "null_increase" || kind === "null_decrease") actPool = actNull;
  else if (kind === "new_values") actPool = actNew;
  else if (kind === "removed_values") actPool = actRemoved;
  else if (kind === "distribution") actPool = actDist;

  const suggestedAction = pickVariant(seed + 7, actPool);

  return {
    title,
    whatChanged,
    impact,
    likelyCause,
    suggestedAction,
  };
}

const aiExplainSectionLabelStyle = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-h)",
  marginBottom: "6px",
};

const aiExplainSectionBodyStyle = {
  margin: "0 0 18px",
  fontSize: "14px",
  lineHeight: 1.55,
  color: "var(--text)",
};

function countHighRisk(changes) {
  return changes.filter((c) => c.nullChanged).length;
}

function inferDrillKindFromRisk(r, nullBullet) {
  const isNullIncrease =
    nullBullet && /\bnulls? increased\b/.test(nullBullet);
  if (r.severity === "HIGH" && isNullIncrease) return "null_increase";
  const h = `${r.headline} ${r.exampleIssue ?? ""}`;
  if (r.severity === "MEDIUM") {
    if (/new values|introduces value/i.test(h)) return "new_values";
    if (/fewer distinct|no longer appears/i.test(h)) return "removed_values";
  }
  return null;
}

function inferDrillKindFromBullet(text) {
  if (/\bintroduced new value:/i.test(text)) return "new_values";
  if (/\bremoved value:/i.test(text)) return "removed_values";
  if (/\bnulls? increased\b/.test(text)) return "null_increase";
  return null;
}

function getDrillDownRows(selectedChange, previousData, currentData) {
  if (!selectedChange?.columnKey || !selectedChange.drillKind) return [];
  const key = selectedChange.columnKey;

  if (selectedChange.drillKind === "null_increase") {
    return currentData
      .map((row, i) => ({ row: i + 1, value: row[key] }))
      .filter(
        (x) => x.value === null || x.value === undefined || x.value === ""
      );
  }

  if (selectedChange.drillKind === "new_values") {
    const prevSet = valueSetNonNull(previousData, key);
    return currentData
      .map((row, i) => ({ row: i + 1, value: row[key] }))
      .filter((x) => {
        const v = x.value;
        if (v === null || v === undefined || v === "") return false;
        return !prevSet.has(v);
      });
  }

  if (selectedChange.drillKind === "removed_values") {
    const currSet = valueSetNonNull(currentData, key);
    return previousData
      .map((row, i) => ({ row: i + 1, value: row[key] }))
      .filter((x) => {
        const v = x.value;
        if (v === null || v === undefined || v === "") return false;
        return !currSet.has(v);
      });
  }

  return [];
}

function normalizeCellForTableSearch(v) {
  if (v === null || v === undefined || v === "") return "";
  return String(v).trim().toLowerCase();
}

function rowMatchesTableSearch(row, columns, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  for (const col of columns) {
    if (normalizeCellForTableSearch(row[col.key]).includes(q)) return true;
  }
  return false;
}

function rowMatchesColumnContainsFilter(row, columnKey, filterRaw) {
  const q = filterRaw.trim().toLowerCase();
  if (!columnKey || !q) return true;
  return normalizeCellForTableSearch(row[columnKey]).includes(q);
}

function isCurrentRowProblemForSelectedChange(
  selectedChange,
  previousData,
  currentData,
  rowIndex
) {
  if (!selectedChange?.columnKey || !selectedChange.drillKind) return false;
  const key = selectedChange.columnKey;
  const row = currentData[rowIndex];
  if (!row) return false;

  if (selectedChange.drillKind === "null_increase") {
    const v = row[key];
    return v === null || v === undefined || v === "";
  }

  if (selectedChange.drillKind === "new_values") {
    const prevSet = valueSetNonNull(previousData, key);
    const v = row[key];
    if (v === null || v === undefined || v === "") return false;
    return !prevSet.has(v);
  }

  if (selectedChange.drillKind === "removed_values") {
    const prevRow = previousData[rowIndex];
    const currSet = valueSetNonNull(currentData, key);
    if (!prevRow) return false;
    const pv = prevRow[key];
    if (pv === null || pv === undefined || pv === "") return false;
    return !currSet.has(pv);
  }

  return false;
}

function computeProblemRowCount(selectedChange, previousData, currentData) {
  if (!selectedChange?.columnKey || !selectedChange.drillKind) return null;
  if (previousData.length === 0 || currentData.length === 0) return null;
  let n = 0;
  for (let i = 0; i < currentData.length; i++) {
    if (
      isCurrentRowProblemForSelectedChange(
        selectedChange,
        previousData,
        currentData,
        i
      )
    ) {
      n++;
    }
  }
  return n;
}

function computeColumnValueChurn(previousData, currentData, key) {
  const prevSet = valueSetNonNull(previousData, key);
  const currSet = valueSetNonNull(currentData, key);
  const addedValues = [...currSet].filter((x) => !prevSet.has(x));
  const removedValues = [...prevSet].filter((x) => !currSet.has(x));
  let newValueRowCount = 0;
  for (const row of currentData) {
    const v = row[key];
    if (v === null || v === undefined || v === "") continue;
    if (!prevSet.has(v)) newValueRowCount++;
  }
  let removedPrevRowCount = 0;
  for (const row of previousData) {
    const v = row[key];
    if (v === null || v === undefined || v === "") continue;
    if (!currSet.has(v)) removedPrevRowCount++;
  }
  return {
    addedValues,
    removedValues,
    newValueRowCount,
    removedPrevRowCount,
  };
}

function sampleColumnValuesForDisplay(data, key, limit = 6) {
  const out = [];
  const seen = new Set();
  for (const row of data) {
    const v = row[key];
    if (v === null || v === undefined || v === "") continue;
    const sk = String(v);
    if (seen.has(sk)) continue;
    seen.add(sk);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function buildStatChanges(riskFindings, diffSummaryBullets, columns) {
  const items = [];
  const risksSorted = [...riskFindings].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "HIGH" ? -1 : 1
  );
  for (const r of risksSorted) {
    const nullBullet = diffSummaryBullets.find(
      (b) =>
        b.startsWith(`${r.columnLabel} `) &&
        /\bnulls? (increased|decreased)\b/.test(b)
    );
    const changeText = nullBullet ?? r.headline;
    const impactLines = [
      ...r.mayBreak.map((x) => `May break: ${x}`),
      ...r.mayAffect.map((x) => `May affect: ${x}`),
    ];
    const isNullIncrease =
      nullBullet && /\bnulls? increased\b/.test(nullBullet);
    const drillKind = inferDrillKindFromRisk(r, nullBullet);
    items.push({
      id: `risk-${r.id}`,
      columnKey: r.id,
      columnLabel: r.columnLabel,
      label: r.severity === "HIGH" ? "HIGH RISK" : "MEDIUM",
      tier: r.severity === "HIGH" ? "HIGH" : "MEDIUM",
      changeText,
      impactLines,
      nullChanged: Boolean(isNullIncrease && r.severity === "HIGH"),
      drillKind,
    });
  }
  for (let i = 0; i < diffSummaryBullets.length; i++) {
    const text = diffSummaryBullets[i];
    const col = columns.find(
      (c) => text.startsWith(`${c.label} `) || text.startsWith(`${c.label}:`)
    );
    if (col && riskFindings.some((r) => r.id === col.key)) continue;
    const ds = col
      ? getDownstreamForColumn(col.key)
      : { mayBreak: [], mayAffect: [] };
    const impactLines = [
      ...ds.mayBreak.map((x) => `May break: ${x}`),
      ...ds.mayAffect.map((x) => `May affect: ${x}`),
    ];
    const drillKind = inferDrillKindFromBullet(text);
    const isNullInc =
      drillKind === "null_increase" && /\bnulls? increased\b/.test(text);
    items.push({
      id: `change-${i}`,
      columnKey: col?.key ?? null,
      columnLabel: col?.label ?? null,
      label: "INFO",
      tier: "INFO",
      changeText: text,
      impactLines,
      nullChanged: Boolean(isNullInc),
      drillKind,
    });
  }
  return items;
}

function buildAggregatedImpactLines(riskFindings, diffSummaryBullets, columns) {
  const lines = [];
  for (const r of riskFindings) {
    for (const x of r.mayBreak) lines.push(`May break: ${x}`);
    for (const x of r.mayAffect) lines.push(`May affect: ${x}`);
  }
  const riskKeys = new Set(riskFindings.map((r) => r.id));
  for (let i = 0; i < diffSummaryBullets.length; i++) {
    const text = diffSummaryBullets[i];
    const col = columns.find(
      (c) => text.startsWith(`${c.label} `) || text.startsWith(`${c.label}:`)
    );
    if (!col || riskKeys.has(col.key)) continue;
    const ds = getDownstreamForColumn(col.key);
    for (const x of ds.mayBreak) lines.push(`May break: ${x}`);
    for (const x of ds.mayAffect) lines.push(`May affect: ${x}`);
  }
  return [...new Set(lines)];
}

function resolveColumnKeyForCopilot(columns, rawName) {
  const name = String(rawName).trim().toLowerCase();
  if (!name) return null;
  const underscored = name.replace(/\s+/g, "_");
  const c =
    columns.find((col) => col.key.toLowerCase() === underscored) ||
    columns.find((col) => col.key.toLowerCase() === name) ||
    columns.find((col) => col.label.toLowerCase() === name) ||
    columns.find(
      (col) => col.label.toLowerCase().replace(/\s+/g, "_") === underscored
    );
  return c?.key ?? null;
}

function tryHandleCopilotCommand(text, deps) {
  const q = text.trim().toLowerCase();
  if (!q) return null;

  const {
    columns,
    statChanges,
    riskFindings,
    overviewHasData,
    setActiveTab,
    setChangeFeedFilter,
    setSelectedChange,
    setSelectedColumn,
    setFeedFocusColumnKey,
    selectDataSource,
    selectedSource,
    runSnowflakeDemoDataset,
    triggerDrillNavigation,
  } = deps;

  if (
    /\b(connect snowflake|snowflake demo|load snowflake)\b/.test(q) &&
    /\b(demo|dataset|sample|load|customers|data)\b/.test(q)
  ) {
    if (selectedSource !== "snowflake") selectDataSource("snowflake");
    runSnowflakeDemoDataset();
    setActiveTab("overview");
    return "Started Snowflake demo: loading analytics.public.customers baseline vs current.";
  }

  if (/\bconnect snowflake\b/.test(q)) {
    setActiveTab("sources");
    if (selectedSource !== "snowflake") selectDataSource("snowflake");
    window.setTimeout(() => {
      document.getElementById("sf-account")?.focus();
    }, 80);
    return "Opened Sources with Snowflake selected. Account field is focused (demo — nothing is sent to a server).";
  }

  if (/\b(go to|open)\s+overview\b/.test(q) || /^\s*overview\s*$/.test(text)) {
    setActiveTab("overview");
    return "Switched to Overview.";
  }

  if (/\b(go to|open)\s+sources\b/.test(q) || /^\s*sources\s*$/.test(text)) {
    setActiveTab("sources");
    return "Switched to Sources.";
  }

  if (
    /\b(go to|open)\s+(chat|copilot)\b/.test(q) ||
    /\bcopilot history\b/.test(q) ||
    /\bopen copilot\b/.test(q)
  ) {
    setActiveTab("chat");
    return "Opened Copilot history.";
  }

  if (
    /\b(show only|only)\s+high[\s-]?risk\b|\bhigh[\s-]?risk only\b|\bfilter high risk\b|\bshow only high[\s-]?risk changes\b/.test(
      q
    )
  ) {
    setChangeFeedFilter("high-risk");
    setActiveTab("overview");
    return "Recent changes now shows HIGH risk only.";
  }

  if (
    /\bshow all changes\b|\ball changes\b|\bclear (the )?filter\b|\bshow everything\b/.test(
      q
    )
  ) {
    setChangeFeedFilter("all");
    setActiveTab("overview");
    return "Showing all changes again.";
  }

  if (/\bcompare\b/.test(q)) {
    setChangeFeedFilter("all");
    setActiveTab("overview");
    if (!overviewHasData) {
      return "Opened Overview. Load baseline + current in Sources (CSV or Snowflake demo) to compare—e.g. customers today vs yesterday as two snapshots.";
    }
    if (/\b(today|yesterday)\b/.test(q) || /\bcustomers?\b/.test(q)) {
      return "Baseline vs current here stands in for two snapshots (e.g. yesterday vs today). Recent changes and the grid summarize drift.";
    }
    return "Overview shows baseline vs current for your loaded snapshots.";
  }

  const explainMatch =
    text.match(/explain why ([a-z0-9_\s]+) is risky/i) ||
    text.match(/explain risk (?:for|of) ([a-z0-9_\s]+)/i) ||
    text.match(/why is ([a-z0-9_\s]+) risky/i);
  if (explainMatch) {
    const colName = explainMatch[1].trim();
    const key = resolveColumnKeyForCopilot(columns, colName);
    setSelectedColumn(key);
    setActiveTab("overview");
    if (!key) {
      return `Could not resolve column "${colName}" in the current schema.`;
    }
    const r = riskFindings.find((x) => x.id === key);
    if (!r) {
      return `No active risk finding for "${colName}" in this comparison.`;
    }
    const mb = r.mayBreak.length ? r.mayBreak.join("; ") : "—";
    return [
      "Risk",
      r.headline,
      "",
      "Why it matters",
      r.whyMatters,
      "",
      "What may break",
      mb,
    ].join("\n");
  }

  const missMatch =
    q.match(/(?:open )?rows (?:with )?missing ([a-z0-9_]+)/) ||
    q.match(/missing ([a-z0-9_]+) (?:values?|field)/);
  if (missMatch) {
    const colToken = missMatch[1];
    const key = resolveColumnKeyForCopilot(columns, colToken);
    setSelectedColumn(key);
    if (!key) {
      setActiveTab("overview");
      return `Unknown column for missing values: "${colToken}".`;
    }
    const sc =
      statChanges.find(
        (s) => s.columnKey === key && s.drillKind === "null_increase"
      ) ||
      statChanges.find((s) => s.columnKey === key && s.tier === "HIGH");
    if (!sc) {
      setActiveTab("overview");
      return `No null-increase drill-down for "${colToken}" in this comparison.`;
    }
    setSelectedChange(sc);
    setFeedFocusColumnKey(key);
    setActiveTab("overview");
    triggerDrillNavigation(sc);
    return `Opened drill-down for rows with missing ${colToken}.`;
  }

  return null;
}

function analyzeDatasetDiff(previousData, currentData, columns) {
  const summaryBullets = [];
  const riskFindings = [];

  if (currentData.length === 0 || columns.length === 0) {
    return {
      summaryParagraph:
        "Upload a current CSV (with a header and at least one row) to build the grid and run comparison.",
      summaryBullets: [],
      riskFindings: [],
    };
  }

  if (previousData.length === 0) {
    return {
      summaryParagraph:
        "Upload a previous CSV as baseline, or use the sample pair, to compare null rates, distinct counts, value churn, and risks.",
      summaryBullets: [],
      riskFindings: [],
    };
  }

  for (const col of columns) {
    const { key, label } = col;
    const oldNull = calculateNullPercentage(previousData, key);
    const newNull = calculateNullPercentage(currentData, key);
    const oldD = countDistinctValues(previousData, key);
    const newD = countDistinctValues(currentData, key);
    const prevSet = valueSetNonNull(previousData, key);
    const currSet = valueSetNonNull(currentData, key);
    const added = [...currSet].filter((x) => !prevSet.has(x));
    const removed = [...prevSet].filter((x) => !currSet.has(x));

    const nullUp = parsePercent(newNull) > parsePercent(oldNull);
    const nullDown = parsePercent(newNull) < parsePercent(oldNull);
    const dUp = newD > oldD;
    const dDown = newD < oldD;

    if (nullUp) {
      summaryBullets.push(`${label} nulls increased (${oldNull} → ${newNull})`);
    } else if (nullDown) {
      summaryBullets.push(`${label} nulls decreased (${oldNull} → ${newNull})`);
    }

    const addedShow = added.slice(0, 5);
    for (const v of addedShow) {
      summaryBullets.push(`${label} introduced new value: ${String(v)}`);
    }
    if (added.length > 5) {
      summaryBullets.push(
        `…and ${added.length - 5} more new value(s) in ${label}`
      );
    }

    const removedShow = removed.slice(0, 3);
    for (const v of removedShow) {
      summaryBullets.push(`${label} removed value: ${String(v)}`);
    }
    if (removed.length > 3) {
      summaryBullets.push(
        `…and ${removed.length - 3} more removed value(s) in ${label}`
      );
    }

    let severity = null;
    if (nullUp) severity = "HIGH";
    else if (dUp || dDown) severity = "MEDIUM";

    if (!severity) continue;

    const ds = getDownstreamForColumn(key);
    let headline = "";
    const whyMatters =
      severity === "HIGH"
        ? "Missing values can break joins, aggregations, identity resolution, and downstream models that expect a value."
        : "";

    let exampleIssue = null;

    if (severity === "HIGH") {
      headline = `${label} column now has missing values (${oldNull} → ${newNull})`;
      const r = findFirstNullRowDisplayIndex(currentData, key);
      if (r !== null) exampleIssue = `Row ${r} has no ${label} value.`;
    } else if (dUp && added.length > 0) {
      const preview = added
        .slice(0, 3)
        .map((v) => String(v))
        .join(", ");
      headline = `${label} has new values (${preview}${added.length > 3 ? ", …" : ""}) — distinct ${oldD} → ${newD}`;
      const first = added[0];
      const r = findFirstRowWithValue(currentData, key, first);
      if (r !== null) {
        exampleIssue = `Row ${r} introduces value "${String(first)}".`;
      }
    } else if (dDown) {
      headline = `${label} has fewer distinct values (${oldD} → ${newD})`;
      if (removed.length > 0) {
        exampleIssue = `Value "${String(removed[0])}" no longer appears in the current file.`;
      }
    } else {
      headline = `${label} distribution changed (distinct ${oldD} → ${newD})`;
    }

    const whyMedium =
      severity === "MEDIUM"
        ? dUp && added.length > 0
          ? "New categories can change dashboard filters, revenue splits, and segment rules until mappings are updated."
          : dDown
            ? "Shrinking cardinality may mean categories were dropped or merged—reports and joins can misalign."
            : "Downstream consumers that assume stable categories should review this column."
        : whyMatters;

    riskFindings.push({
      id: key,
      severity,
      headline,
      columnLabel: label,
      whyMatters: severity === "HIGH" ? whyMatters : whyMedium,
      exampleIssue,
      mayBreak: [...ds.mayBreak],
      mayAffect: [...ds.mayAffect],
    });
  }

  const summaryParagraph =
    summaryBullets.length > 0
      ? ""
      : "No material changes detected between previous and current datasets.";

  return { summaryParagraph, summaryBullets, riskFindings };
}

const demoUsers = [
  {
    name: "Jonne",
    role: "Admin",
    permissions: [
      "Connect data sources",
      "View sample data",
      "Use chat",
      "Manage users",
    ],
  },
  {
    name: "Anna",
    role: "Analyst",
    permissions: [
      "View sample data",
      "Use chat",
      "View risks and impact",
    ],
  },
  {
    name: "Mika",
    role: "Viewer",
    permissions: ["View summary and impact only"],
  },
];

const auditLogEvents = [
  { id: "1", text: "Jonne connected Snowflake", when: "2 min ago" },
  { id: "2", text: "Anna viewed table customers", when: "5 min ago" },
  { id: "3", text: "Mika viewed impact summary", when: "12 min ago" },
  { id: "4", text: 'Anna asked chat: "What changed?"', when: "18 min ago" },
  {
    id: "5",
    text: "Jonne reviewed data quality risk in Name column",
    when: "1 hour ago",
  },
];

const demoSessionProfile = {
  name: "Jonne Hovi",
  role: "Admin",
  workspace: "Unlockdb Demo Workspace",
  status: "Demo account",
};

function calculateNullPercentage(data, key) {
  const total = data.length;
  if (total === 0) return "0%";
  const nulls = data.filter(
    (row) => row[key] === null || row[key] === undefined
  ).length;

  return ((nulls / total) * 100).toFixed(0) + "%";
}

function countDistinctValues(data, key) {
  const seen = new Set();
  for (const row of data) {
    const v = row[key];
    if (v !== null && v !== undefined) seen.add(v);
  }
  return seen.size;
}

function columnInsights(data, columns) {
  return columns.map((col) => ({
    key: col.key,
    label: col.label,
    sensitivity: col.sensitivity ?? presetSensitivity(col.key),
    distinctCount: countDistinctValues(data, col.key),
    nullPercentage: calculateNullPercentage(data, col.key),
  }));
}

function parsePercent(pct) {
  return Number.parseFloat(String(pct).replace("%", "")) || 0;
}

function detectChatIntent(raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return "empty";

  if (
    /\b(downstream impact|downstream systems?|impact simulation)\b/.test(q) ||
    /\b(show\s+)?impact\b/.test(q) ||
    /^\s*impact\s*$/i.test(raw.trim()) ||
    /\bwhat(\s+is|\s+s|'s)?\s+the impact\b/.test(q)
  ) {
    return "downstream_impact";
  }

  if (
    /\bnew values introduced\b/.test(q) ||
    /\bvalues introduced\b/.test(q) ||
    /\bnew values\b/.test(q) ||
    /\bintroduced\b.*\b(values|distinct)\b/.test(q) ||
    /\b(distinct|values)\b.*\bintroduced\b/.test(q)
  ) {
    return "new_values";
  }

  if (
    /\b(what )?chang(ed|es)?\b/.test(q) ||
    /\bdiff\b/.test(q) ||
    /\bcompare(d)? (to|with) (the )?previous\b/.test(q) ||
    /\bversus before\b/.test(q) ||
    /\bfrom the last snapshot\b/.test(q)
  ) {
    return "changes";
  }

  if (
    /\brisk(s)?\b/.test(q) ||
    /\bdata quality\b/.test(q) ||
    /\bmissing values?\b/.test(q)
  ) {
    return "risk";
  }

  if (
    /\bnull percentage\b/.test(q) ||
    /\bnull rate\b/.test(q) ||
    /\bpercentage (of )?nulls?\b/.test(q) ||
    /\bproportion (of )?nulls?\b/.test(q) ||
    /^(nulls?)\s*$/i.test(raw.trim())
  ) {
    return "null_percentage";
  }

  if (
    /\bdistinct values?\b/.test(q) ||
    /\bdistinct count\b/.test(q) ||
    /\bhow many (distinct|unique)\b/.test(q) ||
    /\bunique values?\b/.test(q) ||
    /\bcardinality\b/.test(q)
  ) {
    return "distinct_values";
  }

  if (
    /\bsummary\b/.test(q) ||
    /\boverview\b/.test(q) ||
    /\b(recap|high-?level)\b/.test(q) ||
    /\bwhat('s| is) (on |this )?(screen|page|here)\b/.test(q)
  ) {
    return "summary";
  }

  return "fallback";
}

function chatBullets(lines) {
  return lines.map((line) => `• ${line}`).join("\n");
}

const CHAT_FALLBACK = [
  "I can currently answer questions about:",
  chatBullets([
    "changes",
    "nulls / null %",
    "distinct values",
    "risks",
    "downstream impact",
    "summary",
  ]),
].join("\n");

function chatAnswerSummary(ctx) {
  const colLabels = ctx.columns.map((c) => c.label).join(", ");
  const summaryBlock = chatBullets([
    `Current: ${ctx.currentData.length} rows · ${ctx.columns.length} columns (${colLabels})`,
    `Previous: ${ctx.previousData.length} rows (baseline file)`,
    "Grid + cards = current snapshot only.",
  ]);

  const changesBlock =
    ctx.diffSummaryBullets.length > 0
      ? chatBullets(ctx.diffSummaryBullets)
      : "• No material diff lines — datasets align on scanned metrics.";

  const riskHigh = ctx.riskFindings.filter((r) => r.severity === "HIGH").length;
  const riskMed = ctx.riskFindings.filter((r) => r.severity === "MEDIUM").length;
  const riskBlock =
    ctx.riskFindings.length > 0
      ? chatBullets([
          `${riskHigh} HIGH · ${riskMed} MEDIUM (see Overview summary + details)`,
          ...ctx.riskFindings.slice(0, 3).map(
            (r) => `${r.severity}: ${r.headline}`
          ),
          ...(ctx.riskFindings.length > 3
            ? [`…+${ctx.riskFindings.length - 3} more`]
            : []),
        ])
      : "• No severity-flagged risks for this comparison.";

  return [
    "Summary",
    summaryBlock,
    "",
    "Changes vs previous",
    changesBlock,
    "",
    "Risk overview",
    riskBlock,
  ].join("\n");
}

function chatAnswerChanges(ctx) {
  if (ctx.diffSummaryBullets.length === 0) {
    return [
      "Changes",
      "",
      "• No bullets — load both CSVs or use the sample pair.",
    ].join("\n");
  }
  return [
    "Changes (previous → current)",
    "",
    chatBullets(ctx.diffSummaryBullets),
  ].join("\n");
}

function chatAnswerRisk(ctx) {
  const highs = ctx.riskFindings.filter((r) => r.severity === "HIGH");
  const meds = ctx.riskFindings.filter((r) => r.severity === "MEDIUM");

  if (highs.length === 0 && meds.length === 0) {
    return [
      "Risks",
      "",
      "• No HIGH/MEDIUM flags — null rate did not worsen and cardinality is stable.",
    ].join("\n");
  }

  const lines = [];
  for (const r of [...highs, ...meds].slice(0, 5)) {
    lines.push(
      `${r.severity}: ${r.headline}${r.exampleIssue ? ` (${r.exampleIssue})` : ""}`
    );
  }
  if (ctx.riskFindings.length > 5) {
    lines.push(`…+${ctx.riskFindings.length - 5} more in Overview`);
  }

  return ["Risks", "", chatBullets(lines)].join("\n");
}

function chatAnswerNewValues(ctx) {
  const lines = ctx.diffSummaryBullets.filter((b) =>
    b.includes("introduced new value")
  );
  if (!lines.length) {
    return [
      "New values",
      "",
      "• None called out — no new non-null values vs previous for compared columns.",
    ].join("\n");
  }
  return ["New values (vs previous)", "", chatBullets(lines)].join("\n");
}

function chatAnswerDistinctValues(ctx) {
  const lines = ctx.insights.map(
    (i) =>
      `${i.label}: ${i.distinctCount} distinct value${i.distinctCount === 1 ? "" : "s"}`
  );
  return ["Distinct counts", "(column cards · current table)", "", chatBullets(lines)].join(
    "\n"
  );
}

function chatAnswerNullPercentage(ctx) {
  const lines = ctx.insights.map((i) => `${i.label}: ${i.nullPercentage} nulls`);
  return ["Null %", "(header row + column cards)", "", chatBullets(lines)].join("\n");
}

function chatAnswerDownstreamImpact(ctx) {
  if (!ctx.riskFindings.length) {
    return ["Impact", "", "• No risk cards — nothing to map downstream."].join("\n");
  }
  const breakSet = new Set();
  const affectSet = new Set();
  for (const r of ctx.riskFindings) {
    r.mayBreak.forEach((x) => breakSet.add(x));
    r.mayAffect.forEach((x) => affectSet.add(x));
  }
  const parts = [];
  if (breakSet.size) {
    parts.push(`May break:\n${[...breakSet].map((x) => `• ${x}`).join("\n")}`);
  }
  if (affectSet.size) {
    parts.push(
      `May affect:\n${[...affectSet].map((x) => `• ${x}`).join("\n")}`
    );
  }
  return ["Impact (from risk analysis)", "", parts.join("\n\n")].join("\n");
}

function chatReply(raw, ctx) {
  const intent = detectChatIntent(raw);

  if (intent === "empty") {
    return [
      "Try asking about:",
      chatBullets([
        "summary",
        "changes / diff",
        "risks",
        "null %",
        "distinct values",
        "new values introduced",
        "downstream impact",
      ]),
    ].join("\n");
  }

  switch (intent) {
    case "summary":
      return chatAnswerSummary(ctx);
    case "changes":
      return chatAnswerChanges(ctx);
    case "risk":
      return chatAnswerRisk(ctx);
    case "null_percentage":
      return chatAnswerNullPercentage(ctx);
    case "distinct_values":
      return chatAnswerDistinctValues(ctx);
    case "new_values":
      return chatAnswerNewValues(ctx);
    case "downstream_impact":
      return chatAnswerDownstreamImpact(ctx);
    default:
      return CHAT_FALLBACK;
  }
}

const insightListStyle = {
  listStyle: "none",
  padding: 0,
  margin: "20px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "28rem",
  marginLeft: "auto",
  marginRight: "auto",
};

const insightCardStyle = {
  padding: "14px 18px",
  textAlign: "left",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--social-bg)",
  boxShadow: "var(--shadow)",
  fontSize: "15px",
  lineHeight: 1.45,
  color: "var(--text)",
};

const CHAT_SUGGESTIONS = [
  { label: "Compare today vs yesterday", prompt: "compare customers today vs yesterday" },
  { label: "High risk only", prompt: "show only high-risk changes" },
  { label: "Show all changes", prompt: "show all changes" },
  { label: "Explain email risk", prompt: "explain why email is risky" },
  { label: "Missing email rows", prompt: "open rows with missing email" },
  { label: "Go to Sources", prompt: "go to sources" },
  { label: "Connect Snowflake", prompt: "connect snowflake" },
  { label: "Quick summary", prompt: "Quick summary" },
];

const chatSuggestionButtonStyle = {
  padding: "8px 12px",
  fontSize: "13px",
  fontFamily: "inherit",
  lineHeight: 1.3,
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--social-bg)",
  color: "var(--text-h)",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

const authInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "15px",
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--text-h)",
};

const authLabelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-h)",
  marginBottom: "14px",
};

function navTabStyle(isActive, isHovered) {
  const borderColor = isActive
    ? "var(--accent-border)"
    : isHovered
      ? "var(--border)"
      : "transparent";
  return {
    padding: "8px 14px",
    borderRadius: "8px",
    border: `1px solid ${borderColor}`,
    background: isActive
      ? "var(--accent-bg)"
      : isHovered
        ? "var(--social-bg)"
        : "transparent",
    color: isActive ? "var(--accent)" : "var(--text-h)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: isActive ? 600 : 500,
    fontFamily: "inherit",
    lineHeight: 1.2,
    transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
  };
}

function authSubTabStyle(isActive, isHovered) {
  return {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "8px",
    border: `1px solid ${isActive ? "var(--accent-border)" : "var(--border)"}`,
    background: isActive ? "var(--accent-bg)" : isHovered ? "var(--social-bg)" : "var(--code-bg)",
    color: isActive ? "var(--accent)" : "var(--text-h)",
    fontWeight: isActive ? 600 : 500,
    fontSize: "14px",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background 0.15s ease, border-color 0.15s ease",
  };
}

const governanceSectionStyle = {
  maxWidth: "42rem",
  marginLeft: "auto",
  marginRight: "auto",
  marginBottom: "36px",
  textAlign: "left",
};

const governanceH2Style = {
  fontSize: "22px",
  fontWeight: 600,
  color: "var(--text-h)",
  margin: "0 0 4px",
  letterSpacing: "-0.03em",
};

const governanceH3Style = {
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text-h)",
  margin: "0 0 12px",
};

const governanceMutedStyle = {
  fontSize: "13px",
  color: "var(--text)",
  margin: "0 0 20px",
  lineHeight: 1.45,
};

const overviewHelpSectionStyle = {
  maxWidth: "44rem",
  marginLeft: "auto",
  marginRight: "auto",
  marginTop: "40px",
  paddingTop: "32px",
  borderTop: "1px solid var(--border)",
  textAlign: "left",
};

function sensitivityBadgeColors(level) {
  switch (level) {
    case "Sensitive":
      return {
        background: "var(--accent-bg)",
        color: "var(--accent)",
        border: "1px solid var(--accent-border)",
      };
    case "Internal":
      return {
        background: "var(--code-bg)",
        color: "var(--text-h)",
        border: "1px solid var(--border)",
      };
    default:
      return {
        background: "var(--social-bg)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      };
  }
}

function SensitivityBadge({ level }) {
  const s = sensitivityBadgeColors(level);
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "6px",
        ...s,
        whiteSpace: "nowrap",
      }}
    >
      {level}
    </span>
  );
}

function App() {
  const [previousData, setPreviousData] = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const [previousFileName, setPreviousFileName] = useState("Not connected");
  const [currentFileName, setCurrentFileName] = useState("Not connected");
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [navHover, setNavHover] = useState(null);
  const [demoLoggedIn, setDemoLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authSubHover, setAuthSubHover] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [selectedSource, setSelectedSource] = useState(null);
  const [connectionForm, setConnectionForm] = useState({
    account: "",
    user: "",
    warehouse: "",
  });
  const [snowflakeForm, setSnowflakeForm] = useState({
    account: "",
    user: "",
    warehouse: "",
    database: "",
    schema: "",
  });
  const [snowflakeDemoConnected, setSnowflakeDemoConnected] = useState(false);
  const [snowflakeConnecting, setSnowflakeConnecting] = useState(false);
  const [databricksForm, setDatabricksForm] = useState({
    workspaceUrl: "",
    catalog: "",
    schema: "",
    clusterWarehouse: "",
  });
  const [databricksDemoConnected, setDatabricksDemoConnected] = useState(false);
  const [databricksConnecting, setDatabricksConnecting] = useState(false);
  const [connectDemoAck, setConnectDemoAck] = useState(false);

  const previousCsvInputRef = useRef(null);
  const currentCsvInputRef = useRef(null);
  const overviewDetailsRef = useRef(null);
  const chatMessageIdRef = useRef(0);
  const [feedFocusColumnKey, setFeedFocusColumnKey] = useState(null);
  const [selectedChange, setSelectedChange] = useState(null);
  const [changeFeedFilter, setChangeFeedFilter] = useState("all");
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [commandResult, setCommandResult] = useState(null);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotHistoryExpanded, setCopilotHistoryExpanded] = useState(false);
  const [history, setHistory] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const drillDownRef = useRef(null);
  const [gridSearchQuery, setGridSearchQuery] = useState("");
  const [gridFilterColumnKey, setGridFilterColumnKey] = useState("");
  const [gridFilterValue, setGridFilterValue] = useState("");
  const [problemRowsOnly, setProblemRowsOnly] = useState(false);
  const [columnDetailKey, setColumnDetailKey] = useState(null);
  const [explainStatChange, setExplainStatChange] = useState(null);

  const columns = useMemo(
    () => buildColumnsFromCurrentOnly(currentData),
    [currentData]
  );

  const insights = useMemo(
    () => columnInsights(currentData, columns),
    [currentData, columns]
  );

  const diffAnalysis = useMemo(
    () => analyzeDatasetDiff(previousData, currentData, columns),
    [previousData, currentData, columns]
  );

  const {
    summaryParagraph: diffSummaryParagraph,
    summaryBullets: diffSummaryBullets,
    riskFindings,
  } = diffAnalysis;

  const firstHighRisk = riskFindings.find((r) => r.severity === "HIGH");
  const highRiskCount = riskFindings.filter((r) => r.severity === "HIGH").length;
  const mediumRiskCount = riskFindings.filter(
    (r) => r.severity === "MEDIUM"
  ).length;
  const statChanges = useMemo(
    () => buildStatChanges(riskFindings, diffSummaryBullets, columns),
    [riskFindings, diffSummaryBullets, columns]
  );
  const filteredStatChanges = useMemo(() => {
    if (changeFeedFilter === "high-risk") {
      return statChanges.filter((s) => s.tier === "HIGH");
    }
    return statChanges;
  }, [statChanges, changeFeedFilter]);
  const impactLines = useMemo(
    () =>
      buildAggregatedImpactLines(riskFindings, diffSummaryBullets, columns),
    [riskFindings, diffSummaryBullets, columns]
  );
  const overviewHasData = currentData.length > 0 && columns.length > 0;
  const diffSummaryShort =
    (diffSummaryParagraph && diffSummaryParagraph.trim()) ||
    (diffSummaryBullets.length > 0
      ? `${diffSummaryBullets.length} change(s) vs baseline.`
      : "");

  const drillDownRows = useMemo(() => {
    if (
      !selectedChange?.columnKey ||
      !selectedChange.drillKind ||
      previousData.length === 0 ||
      currentData.length === 0
    ) {
      return [];
    }
    return getDrillDownRows(selectedChange, previousData, currentData);
  }, [selectedChange, previousData, currentData]);

  const problemRowCountForExplorer = useMemo(
    () => computeProblemRowCount(selectedChange, previousData, currentData),
    [selectedChange, previousData, currentData]
  );

  const explorerFilteredIndices = useMemo(() => {
    if (!currentData.length || !columns.length) return [];
    const out = [];
    const useProblem =
      problemRowsOnly &&
      selectedChange?.columnKey &&
      selectedChange?.drillKind &&
      previousData.length > 0;
    for (let i = 0; i < currentData.length; i++) {
      if (
        useProblem &&
        !isCurrentRowProblemForSelectedChange(
          selectedChange,
          previousData,
          currentData,
          i
        )
      ) {
        continue;
      }
      const row = currentData[i];
      if (!rowMatchesTableSearch(row, columns, gridSearchQuery)) continue;
      if (
        !rowMatchesColumnContainsFilter(
          row,
          gridFilterColumnKey,
          gridFilterValue
        )
      ) {
        continue;
      }
      out.push(i);
    }
    return out;
  }, [
    currentData,
    columns,
    gridSearchQuery,
    gridFilterColumnKey,
    gridFilterValue,
    problemRowsOnly,
    selectedChange,
    previousData,
  ]);

  const aiExplainPayload = useMemo(() => {
    if (!explainStatChange) return null;
    return buildAiExplainForStatChange(explainStatChange, riskFindings);
  }, [explainStatChange, riskFindings]);

  const columnExplorerDetail = useMemo(() => {
    if (!columnDetailKey) return null;
    const col = columns.find((c) => c.key === columnDetailKey);
    if (!col) return null;
    const ins = insights.find((i) => i.key === columnDetailKey);
    const risk = riskFindings.find((r) => r.id === columnDetailKey);
    const hasBaseline = previousData.length > 0 && currentData.length > 0;
    const churn = hasBaseline
      ? computeColumnValueChurn(previousData, currentData, columnDetailKey)
      : null;
    const baselineNullPct = hasBaseline
      ? calculateNullPercentage(previousData, columnDetailKey)
      : null;
    const distinctPrev = hasBaseline
      ? countDistinctValues(previousData, columnDetailKey)
      : null;
    const samples = sampleColumnValuesForDisplay(
      currentData,
      columnDetailKey,
      6
    );
    const ds = getDownstreamForColumn(columnDetailKey);
    return {
      col,
      ins,
      risk,
      hasBaseline,
      churn,
      baselineNullPct,
      distinctPrev,
      samples,
      ds,
    };
  }, [
    columnDetailKey,
    columns,
    insights,
    riskFindings,
    previousData,
    currentData,
  ]);

  const firstHighStatChange = statChanges.find((s) => s.tier === "HIGH");

  const chatContext = {
    previousData,
    currentData,
    columns,
    insights,
    diffSummaryBullets,
    diffSummaryParagraph,
    riskFindings,
  };

  useEffect(() => {
    setDismissed(false);
  }, [firstHighRisk?.id]);

  useEffect(() => {
    setSelectedChange(null);
    setSelectedColumn(null);
    setGridSearchQuery("");
    setGridFilterColumnKey("");
    setGridFilterValue("");
    setProblemRowsOnly(false);
    setColumnDetailKey(null);
    setExplainStatChange(null);
  }, [previousFileName, currentFileName, previousData.length, currentData.length]);

  useEffect(() => {
    if (activeTab !== "overview") {
      setColumnDetailKey(null);
      setExplainStatChange(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!columnDetailKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") setColumnDetailKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [columnDetailKey]);

  useEffect(() => {
    if (!explainStatChange) return;
    const onKey = (e) => {
      if (e.key === "Escape") setExplainStatChange(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explainStatChange]);

  useEffect(() => {
    if (previousData.length === 0 || currentData.length === 0) {
      if (previousData.length === 0 && currentData.length === 0) {
        lastSnapshotKeyForHistory = "";
      }
      return;
    }
    const key = `${previousFileName}|${currentFileName}|${previousData.length}|${currentData.length}`;
    if (lastSnapshotKeyForHistory === key) return;
    lastSnapshotKeyForHistory = key;
    const sc = buildStatChanges(riskFindings, diffSummaryBullets, columns);
    setHistory((h) =>
      [
        ...h,
        {
          timestamp: new Date().toLocaleTimeString(),
          changes: sc.length,
          highRisk: countHighRisk(sc),
        },
      ].slice(-30)
    );
  }, [
    previousData,
    currentData,
    previousFileName,
    currentFileName,
    riskFindings,
    diffSummaryBullets,
    columns,
  ]);

  function readCsvFile(file, onRows) {
    const reader = new FileReader();
    reader.onload = () => {
      const { rows, headerKeys } = parseCsv(String(reader.result ?? ""));
      if (headerKeys.length === 0) {
        window.alert("Could not read CSV headers.");
        return;
      }
      if (rows.length === 0) {
        window.alert("CSV needs at least one data row below the header.");
        return;
      }
      onRows(rows);
    };
    reader.onerror = () => window.alert("Could not read the file.");
    reader.readAsText(file);
  }

  function handlePreviousCsvSelected(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    readCsvFile(file, (rows) => {
      setSnowflakeDemoConnected(false);
      setDatabricksDemoConnected(false);
      setPreviousData(rows);
      setPreviousFileName(file.name);
      input.value = "";
    });
  }

  function handleCurrentCsvSelected(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    readCsvFile(file, (rows) => {
      setSnowflakeDemoConnected(false);
      setDatabricksDemoConnected(false);
      setCurrentData(rows);
      setCurrentFileName(file.name);
      input.value = "";
    });
  }

  function handleUseSampleDataset() {
    setSnowflakeDemoConnected(false);
    setDatabricksDemoConnected(false);
    setPreviousData(SAMPLE_PREVIOUS_DATA);
    setCurrentData(SAMPLE_CURRENT_DATA);
    setPreviousFileName("sample-previous.csv");
    setCurrentFileName("sample-current.csv");
  }

  function selectDataSource(id) {
    if (id === selectedSource) return;
    setSelectedSource(id);
    setConnectDemoAck(false);
    setSnowflakeConnecting(false);
    setDatabricksConnecting(false);
    setConnectionForm({ account: "", user: "", warehouse: "" });
    setSnowflakeForm({
      account: "",
      user: "",
      warehouse: "",
      database: "",
      schema: "",
    });
    setDatabricksForm({
      workspaceUrl: "",
      catalog: "",
      schema: "",
      clusterWarehouse: "",
    });
    if (id !== "snowflake") {
      setSnowflakeDemoConnected(false);
    }
    if (id !== "databricks") {
      setDatabricksDemoConnected(false);
    }
  }

  function handleDemoConnect(e) {
    e.preventDefault();
    setConnectDemoAck(true);
  }

  function runSnowflakeDemoDataset() {
    if (snowflakeConnecting) return;
    setSnowflakeConnecting(true);
    window.setTimeout(() => {
      setSnowflakeConnecting(false);
      setSnowflakeDemoConnected(true);
      setDatabricksDemoConnected(false);
      setPreviousData(SNOWFLAKE_DEMO_PREVIOUS);
      setCurrentData(SNOWFLAKE_DEMO_CURRENT);
      setPreviousFileName("Snowflake · customers (baseline)");
      setCurrentFileName("Snowflake · customers (current)");
    }, 1000);
  }

  function handleSnowflakeDemoConnect(e) {
    e.preventDefault();
    runSnowflakeDemoDataset();
    setActiveTab("overview");
  }

  function runDatabricksDemoDataset() {
    if (databricksConnecting) return;
    setDatabricksConnecting(true);
    window.setTimeout(() => {
      setDatabricksConnecting(false);
      setDatabricksDemoConnected(true);
      setSnowflakeDemoConnected(false);
      setPreviousData(DATABRICKS_DEMO_PREVIOUS);
      setCurrentData(DATABRICKS_DEMO_CURRENT);
      setPreviousFileName("Databricks · events (baseline)");
      setCurrentFileName("Databricks · events (current)");
    }, 1000);
  }

  function handleDatabricksDemoConnect(e) {
    e.preventDefault();
    runDatabricksDemoDataset();
    setActiveTab("overview");
  }

  function triggerDrillNavigation(statChange) {
    requestAnimationFrame(() => {
      drillDownRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      overviewDetailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      if (statChange.columnKey) {
        document
          .getElementById(`overview-risk-${statChange.columnKey}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  function handleStatChangeClick(statChange) {
    setSelectedChange(statChange);
    setFeedFocusColumnKey(statChange.columnKey ?? null);
    triggerDrillNavigation(statChange);
  }

  function sendChatMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const copilotReply = tryHandleCopilotCommand(trimmed, {
      columns,
      statChanges,
      riskFindings,
      overviewHasData,
      setActiveTab,
      setChangeFeedFilter,
      setSelectedChange,
      setSelectedColumn,
      setFeedFocusColumnKey,
      selectDataSource,
      selectedSource,
      runSnowflakeDemoDataset,
      triggerDrillNavigation,
    });
    const reply = copilotReply ?? chatReply(trimmed, chatContext);
    const base = ++chatMessageIdRef.current;
    setCommandResult({
      copilot: copilotReply != null,
      query: trimmed,
      replyPreview: reply.split("\n")[0]?.slice(0, 120) ?? "",
    });
    setMessages((prev) => [
      ...prev,
      { id: `${base}-u`, role: "user", text: trimmed },
      { id: `${base}-a`, role: "assistant", text: reply },
    ]);
  }

  function handleCopilotSend(e) {
    e.preventDefault();
    sendChatMessage(copilotInput);
    setCopilotInput("");
  }

  function openColumnExplorerDetail(columnKey) {
    setColumnDetailKey(columnKey);
    setFeedFocusColumnKey(columnKey);
  }

  function handleDemoLogin(e) {
    e.preventDefault();
    setDemoLoggedIn(true);
  }

  function handleDemoSignup(e) {
    e.preventDefault();
    setDemoLoggedIn(true);
  }

  const navTabs = [
    { id: "overview", label: "Overview" },
    { id: "about", label: "How it works" },
    { id: "sources", label: "Sources" },
    { id: "chat", label: "Copilot" },
    { id: "governance", label: "Governance" },
    { id: "audit", label: "Audit" },
    {
      id: "account",
      label: demoLoggedIn ? "Account" : "Login / Account",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px 8px",
            padding: "12px 20px",
            maxWidth: "1126px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="app-ghost-btn"
            style={{
              fontWeight: 600,
              fontSize: "17px",
              color: "var(--text-h)",
              marginRight: "4px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Unlockdb
          </button>
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => setNavHover(tab.id)}
              onMouseLeave={() => setNavHover(null)}
              style={navTabStyle(activeTab === tab.id, navHover === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "overview" &&
        overviewHasData &&
        firstHighRisk &&
        !dismissed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              padding: "10px 20px",
              borderTop: "1px solid var(--risk-high-border)",
              background: "var(--risk-high-bg)",
              maxWidth: "1126px",
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--risk-high)",
                lineHeight: 1.4,
              }}
            >
              🚨 High risk detected —{" "}
              {firstHighStatChange?.changeText ?? firstHighRisk.headline}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontFamily: "inherit",
                fontWeight: 600,
                borderRadius: "6px",
                border: "1px solid var(--risk-high-border)",
                background: "var(--bg)",
                color: "var(--text-h)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </header>

      <main
        style={{
          flex: 1,
          padding: "24px 20px calc(48px + 118px)",
          maxWidth: "1126px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {activeTab === "overview" && (
          <>
            <section
              style={{
                maxWidth: "44rem",
                margin: "0 auto 28px",
                textAlign: "left",
              }}
            >
              <h1
                style={{
                  fontSize: "clamp(26px, 4.5vw, 38px)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  color: "var(--text-h)",
                  margin: "0 0 12px",
                }}
              >
                See what changed in your data — before it breaks anything.
              </h1>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: 1.45,
                  color: "var(--text)",
                  margin: 0,
                  maxWidth: "42rem",
                }}
              >
                Live summary of drift, risks, and downstream impact. Configure
                connections under{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("sources")}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: "inherit",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sources
                </button>
                ; dig into raw rows in the details section below.
              </p>
            </section>

            {!overviewHasData ? (
              selectedSource === null ? (
                <div
                  style={{
                    maxWidth: "40rem",
                    margin: "48px auto",
                    padding: "28px 24px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--code-bg)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 18px",
                      fontSize: "17px",
                      fontWeight: 600,
                      color: "var(--text-h)",
                      lineHeight: 1.45,
                    }}
                  >
                    Connect a data source to start monitoring changes
                  </p>
                  <button
                    type="button"
                    className="app-primary-btn"
                    onClick={() => setActiveTab("sources")}
                    style={{
                      padding: "10px 22px",
                      borderRadius: "8px",
                      border: "1px solid var(--accent-border)",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                      fontWeight: 600,
                      fontSize: "14px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Open Sources
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    maxWidth: "40rem",
                    margin: "48px auto",
                    padding: "28px 24px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--code-bg)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 18px",
                      fontSize: "16px",
                      color: "var(--text-h)",
                      lineHeight: 1.5,
                    }}
                  >
                    No snapshot loaded yet. Add a baseline and current dataset
                    from{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("sources")}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "var(--accent)",
                        fontWeight: 600,
                        fontSize: "inherit",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Sources
                    </button>
                    .
                  </p>
                </div>
              )
            ) : (
              <>
                {snowflakeDemoConnected ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-h)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ color: "var(--text)" }}>Source: </span>
                      Snowflake demo
                      <span style={{ margin: "0 8px", color: "var(--border)" }}>
                        ·
                      </span>
                      <span style={{ color: "var(--text)" }}>Table: </span>
                      customers
                    </div>
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--code-bg)",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color: "var(--text)",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Database:{" "}
                        </span>
                        analytics
                      </div>
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Schema:{" "}
                        </span>
                        public
                      </div>
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Table:{" "}
                        </span>
                        customers
                      </div>
                    </div>
                  </div>
                ) : databricksDemoConnected ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-h)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ color: "var(--text)" }}>Source: </span>
                      Databricks demo
                      <span style={{ margin: "0 8px", color: "var(--border)" }}>
                        ·
                      </span>
                      <span style={{ color: "var(--text)" }}>Table: </span>
                      events
                    </div>
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--code-bg)",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color: "var(--text)",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Catalog:{" "}
                        </span>
                        main
                      </div>
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Schema:{" "}
                        </span>
                        analytics
                      </div>
                      <div>
                        <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                          Table:{" "}
                        </span>
                        events
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    maxWidth: "44rem",
                    margin: "0 auto 18px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--social-bg)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--text-h)",
                      lineHeight: 1.4,
                      marginBottom: diffSummaryShort ? "8px" : 0,
                    }}
                  >
                    {highRiskCount > 0 ? (
                      <span>
                        🚨 {highRiskCount} high risk
                        {highRiskCount === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span>ℹ️ No high risks</span>
                    )}
                    {mediumRiskCount > 0 ? (
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>
                        {" "}
                        · ⚠️ {mediumRiskCount} medium
                      </span>
                    ) : null}
                  </div>
                  {diffSummaryShort ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        lineHeight: 1.45,
                        color: "var(--text)",
                      }}
                    >
                      {diffSummaryShort}
                    </p>
                  ) : null}
                </div>

                {firstHighRisk ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 22px",
                      padding: "18px 20px",
                      borderRadius: "12px",
                      border: "2px solid var(--risk-high-border)",
                      background: "var(--risk-high-bg)",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: "var(--risk-high)",
                        marginBottom: "10px",
                      }}
                    >
                      🚨 HIGH RISK DETECTED
                    </div>
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: "17px",
                        fontWeight: 600,
                        lineHeight: 1.4,
                        color: "var(--text-h)",
                      }}
                    >
                      {firstHighRisk.headline}
                    </p>
                    {firstHighRisk.mayBreak.length > 0 ? (
                      <div
                        style={{
                          fontSize: "14px",
                          color: "var(--text)",
                          lineHeight: 1.45,
                        }}
                      >
                        → May break: {firstHighRisk.mayBreak[0]}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "14px",
                          color: "var(--text)",
                          lineHeight: 1.45,
                        }}
                      >
                        → May affect: {firstHighRisk.mayAffect[0]}
                      </div>
                    )}
                  </div>
                ) : null}

                <h2
                  style={{
                    ...governanceH2Style,
                    fontSize: "17px",
                    maxWidth: "44rem",
                    margin: "0 auto 10px",
                    textAlign: "left",
                    color: "var(--text-h)",
                  }}
                >
                  Change history
                </h2>
                {history.length === 0 ? (
                  <p
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 16px",
                      fontSize: "13px",
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    Load baseline + current data to start a monitoring
                    timeline.
                  </p>
                ) : (
                  <ul
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 20px",
                      paddingLeft: "1.2rem",
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    {history.map((entry, idx) => (
                      <li key={`${entry.timestamp}-${idx}`}>
                        {entry.timestamp} → {entry.changes} change
                        {entry.changes === 1 ? "" : "s"} ({entry.highRisk}{" "}
                        high risk)
                      </li>
                    ))}
                  </ul>
                )}

                <h2
                  style={{
                    ...governanceH2Style,
                    fontSize: "20px",
                    maxWidth: "44rem",
                    margin: "0 auto 10px",
                    textAlign: "left",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  Recent changes
                  {changeFeedFilter === "high-risk" ? (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "var(--risk-high-bg)",
                        color: "var(--risk-high)",
                        border: "1px solid var(--risk-high-border)",
                      }}
                    >
                      High risk only
                    </span>
                  ) : null}
                </h2>
                <p
                  style={{
                    maxWidth: "44rem",
                    margin: "0 auto 14px",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  Click a card for row-level drill-down, or use{" "}
                  <strong>Explain</strong> for a plain-language walkthrough.
                  Filter from the command bar (e.g. high risk only).
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    maxWidth: "44rem",
                    margin: "0 auto 28px",
                  }}
                >
                  {statChanges.length === 0 ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        fontSize: "15px",
                        color: "var(--text)",
                        padding: "18px 20px",
                        boxShadow: "var(--shadow)",
                      }}
                    >
                      {diffSummaryParagraph.trim() ||
                        "No change rows yet — add a baseline in Sources."}
                    </div>
                  ) : filteredStatChanges.length === 0 ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        fontSize: "15px",
                        color: "var(--text)",
                        padding: "18px 20px",
                        boxShadow: "var(--shadow)",
                      }}
                    >
                      No HIGH risk changes match this filter. Try{" "}
                      <strong>show all changes</strong> in the copilot bar.
                    </div>
                  ) : (
                    filteredStatChanges.map((sc) => {
                      const tag =
                        sc.label === "HIGH RISK"
                          ? "[HIGH RISK]"
                          : sc.label === "MEDIUM"
                            ? "[MEDIUM]"
                            : "[INFO]";
                      const tagColor =
                        sc.tier === "HIGH"
                          ? "var(--risk-high)"
                          : sc.tier === "MEDIUM"
                            ? "var(--risk-medium)"
                            : "var(--text-h)";
                      const cardBg =
                        sc.tier === "HIGH"
                          ? "var(--risk-high-bg)"
                          : sc.tier === "MEDIUM"
                            ? "var(--risk-medium-bg)"
                            : "var(--code-bg)";
                      const cardBorder =
                        sc.tier === "HIGH"
                          ? "var(--risk-high-border)"
                          : sc.tier === "MEDIUM"
                            ? "var(--risk-medium-border)"
                            : "var(--border)";
                      const primaryImpact = sc.impactLines[0];
                      const isSelected = selectedChange?.id === sc.id;
                      return (
                        <div
                          key={sc.id}
                          style={{
                            margin: 0,
                            borderRadius: "10px",
                            border: `1px solid ${cardBorder}`,
                            borderLeft: `5px solid ${
                              isSelected ? "var(--accent)" : cardBorder
                            }`,
                            background: cardBg,
                            boxShadow: isSelected
                              ? "var(--shadow), 0 0 0 2px var(--accent)"
                              : "var(--shadow)",
                            boxSizing: "border-box",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleStatChangeClick(sc)}
                            style={{
                              width: "100%",
                              margin: 0,
                              textAlign: "left",
                              cursor: "pointer",
                              boxSizing: "border-box",
                              padding: "18px 20px",
                              background: "transparent",
                              border: "none",
                              fontFamily: "inherit",
                              color: "inherit",
                              display: "block",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                color: tagColor,
                                marginBottom: "10px",
                              }}
                            >
                              {tag}
                            </div>
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: 600,
                                color: "var(--text-h)",
                                lineHeight: 1.4,
                                marginBottom: primaryImpact ? "10px" : 0,
                              }}
                            >
                              {formatStatChangeBullet(sc)}
                            </div>
                            {primaryImpact ? (
                              <div
                                style={{
                                  fontSize: "14px",
                                  color: "var(--text)",
                                  lineHeight: 1.45,
                                }}
                              >
                                → {primaryImpact}
                              </div>
                            ) : null}
                          </button>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: "8px",
                              padding: "0 16px 14px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setExplainStatChange(sc)}
                              className="app-ghost-btn"
                              style={{
                                padding: "8px 14px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--bg)",
                                color: "var(--accent)",
                                fontWeight: 600,
                                fontSize: "13px",
                                fontFamily: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              ✨ Explain
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {explainStatChange && aiExplainPayload ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close AI explain panel"
                      onClick={() => setExplainStatChange(null)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 38,
                        border: "none",
                        padding: 0,
                        margin: 0,
                        background: "rgba(15, 18, 28, 0.2)",
                        cursor: "pointer",
                      }}
                    />
                    <aside
                      style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: "min(400px, 94vw)",
                        zIndex: 39,
                        background: "var(--bg)",
                        borderLeft: "1px solid var(--border)",
                        boxShadow: "-12px 0 40px rgba(0,0,0,0.12)",
                        overflowY: "auto",
                        padding: "22px 20px 100px",
                        boxSizing: "border-box",
                        textAlign: "left",
                      }}
                      aria-labelledby="ai-explain-title"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "18px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--accent)",
                              marginBottom: "6px",
                            }}
                          >
                            AI explain
                          </div>
                          <h2
                            id="ai-explain-title"
                            style={{
                              margin: 0,
                              fontSize: "17px",
                              fontWeight: 700,
                              color: "var(--text-h)",
                              lineHeight: 1.35,
                            }}
                          >
                            {aiExplainPayload.title}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExplainStatChange(null)}
                          className="app-ghost-btn"
                          style={{
                            flexShrink: 0,
                            padding: "6px 12px",
                            fontSize: "13px",
                            fontWeight: 600,
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: "var(--social-bg)",
                            color: "var(--text-h)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Close
                        </button>
                      </div>

                      <div style={{ marginBottom: "4px", ...aiExplainSectionLabelStyle }}>
                        ⚠️ What changed
                      </div>
                      <p style={aiExplainSectionBodyStyle}>
                        {aiExplainPayload.whatChanged}
                      </p>

                      <div style={{ marginBottom: "4px", ...aiExplainSectionLabelStyle }}>
                        ⚠️ Impact
                      </div>
                      <p style={aiExplainSectionBodyStyle}>
                        {aiExplainPayload.impact}
                      </p>

                      <div style={{ marginBottom: "4px", ...aiExplainSectionLabelStyle }}>
                        ⚠️ Likely cause
                      </div>
                      <p style={aiExplainSectionBodyStyle}>
                        {aiExplainPayload.likelyCause}
                      </p>

                      <div style={{ marginBottom: "4px", ...aiExplainSectionLabelStyle }}>
                        💡 Suggested action
                      </div>
                      <p style={{ ...aiExplainSectionBodyStyle, marginBottom: 0 }}>
                        {aiExplainPayload.suggestedAction}
                      </p>
                    </aside>
                  </>
                ) : null}

                <div
                  id="overview-drill-down"
                  ref={drillDownRef}
                  style={{ maxWidth: "44rem", margin: "0 auto 28px" }}
                >
                  {selectedChange ? (
                    <>
                      <h2
                        style={{
                          ...governanceH2Style,
                          fontSize: "17px",
                          margin: "0 0 10px",
                          textAlign: "left",
                        }}
                      >
                        Details for:{" "}
                        {selectedChange.columnLabel ??
                          columns.find((c) => c.key === selectedChange.columnKey)
                            ?.label ??
                          selectedChange.columnKey ??
                          "—"}
                      </h2>
                      {!selectedChange.drillKind ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "var(--text)",
                            lineHeight: 1.5,
                          }}
                        >
                          No row-level drill-down for this change type.
                        </p>
                      ) : drillDownRows.length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "var(--text)",
                            lineHeight: 1.5,
                          }}
                        >
                          No matching rows in the current snapshot for this
                          drill-down.
                        </p>
                      ) : (
                        <div
                          style={{
                            overflowX: "auto",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            background: "var(--code-bg)",
                          }}
                        >
                          <table
                            style={{
                              borderCollapse: "collapse",
                              width: "100%",
                              fontSize: "14px",
                            }}
                          >
                            <thead>
                              <tr>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "10px 12px",
                                    borderBottom: "1px solid var(--border)",
                                    color: "var(--text-h)",
                                    fontWeight: 600,
                                  }}
                                >
                                  Row
                                </th>
                                <th
                                  style={{
                                    textAlign: "left",
                                    padding: "10px 12px",
                                    borderBottom: "1px solid var(--border)",
                                    color: "var(--text-h)",
                                    fontWeight: 600,
                                  }}
                                >
                                  Value
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {drillDownRows.map((r, i) => (
                                <tr key={`${r.row}-${i}`}>
                                  <td
                                    style={{
                                      padding: "8px 12px",
                                      borderBottom: "1px solid var(--border)",
                                      color: "var(--text)",
                                    }}
                                  >
                                    {r.row}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 12px",
                                      borderBottom: "1px solid var(--border)",
                                      color: "var(--text)",
                                    }}
                                  >
                                    {r.value === null ||
                                    r.value === undefined ||
                                    r.value === ""
                                      ? "—"
                                      : String(r.value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                <h2
                  style={{
                    ...governanceH2Style,
                    fontSize: "17px",
                    maxWidth: "44rem",
                    margin: "0 auto 10px",
                    textAlign: "left",
                    color: "var(--text)",
                    fontWeight: 600,
                  }}
                >
                  Impact
                </h2>
                {impactLines.length === 0 ? (
                  <p
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 24px",
                      textAlign: "left",
                      fontSize: "14px",
                      color: "var(--text)",
                    }}
                  >
                    No downstream impact lines for this comparison.
                  </p>
                ) : (
                  <ul
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 28px",
                      paddingLeft: "1.2rem",
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    {impactLines.map((line) => (
                      <li key={line} style={{ marginBottom: "6px" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}

                <section
                  id="overview-data-details"
                  ref={overviewDetailsRef}
                  style={{
                    maxWidth: "100%",
                    marginTop: "8px",
                    paddingTop: "20px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <h2
                    style={{
                      ...governanceH2Style,
                      fontSize: "17px",
                      maxWidth: "42rem",
                      margin: "0 auto 8px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    Details
                  </h2>
                  <p
                    style={{
                      maxWidth: "42rem",
                      margin: "0 auto 12px",
                      textAlign: "left",
                      fontSize: "13px",
                      lineHeight: 1.45,
                      color: "var(--text)",
                    }}
                  >
                    Raw current snapshot with search, filters, and column
                    details. Click a header or a column stat card to inspect a
                    field.
                  </p>

                  {currentData.length === 0 || columns.length === 0 ? (
                    <p
                      style={{
                        maxWidth: "36rem",
                        margin: "0 auto 16px",
                        textAlign: "left",
                        fontSize: "15px",
                        color: "var(--text)",
                      }}
                    >
                      No current data to show. Load data from Sources.
                    </p>
                  ) : (
                    <>
                      <div
                        style={{
                          maxWidth: "42rem",
                          margin: "0 auto 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <input
                          type="search"
                          value={gridSearchQuery}
                          onChange={(e) => setGridSearchQuery(e.target.value)}
                          placeholder="Search all visible columns…"
                          aria-label="Search table rows"
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            fontSize: "14px",
                            fontFamily: "inherit",
                            background: "var(--bg)",
                            color: "var(--text-h)",
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--text-h)",
                              minWidth: "140px",
                              flex: "1 1 140px",
                            }}
                          >
                            Column
                            <select
                              value={gridFilterColumnKey}
                              onChange={(e) =>
                                setGridFilterColumnKey(e.target.value)
                              }
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                background: "var(--bg)",
                                color: "var(--text-h)",
                              }}
                            >
                              <option value="">Any column</option>
                              {columns.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--text-h)",
                              minWidth: "160px",
                              flex: "2 1 160px",
                            }}
                          >
                            Contains
                            <input
                              type="text"
                              value={gridFilterValue}
                              onChange={(e) =>
                                setGridFilterValue(e.target.value)
                              }
                              placeholder="e.g. Denmark"
                              disabled={!gridFilterColumnKey}
                              aria-label="Filter by cell value"
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                background: "var(--bg)",
                                color: "var(--text-h)",
                                opacity: gridFilterColumnKey ? 1 : 0.55,
                              }}
                            />
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "13px",
                              color: "var(--text)",
                              cursor:
                                selectedChange?.drillKind &&
                                previousData.length > 0
                                  ? "pointer"
                                  : "not-allowed",
                              marginTop: "18px",
                            }}
                            title={
                              selectedChange?.drillKind &&
                              previousData.length > 0
                                ? "Same rows as the drill-down for the selected change"
                                : "Select a change with row drill-down and load baseline + current"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={problemRowsOnly}
                              onChange={(e) =>
                                setProblemRowsOnly(e.target.checked)
                              }
                              disabled={
                                !selectedChange?.drillKind ||
                                previousData.length === 0
                              }
                            />
                            Problem rows only
                          </label>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            lineHeight: 1.5,
                            color: "var(--text)",
                          }}
                        >
                          <strong>{currentData.length}</strong> total rows
                          <span style={{ color: "var(--border)" }}> · </span>
                          <strong>{explorerFilteredIndices.length}</strong>{" "}
                          shown
                          {problemRowCountForExplorer != null ? (
                            <>
                              <span style={{ color: "var(--border)" }}>
                                {" "}
                                ·{" "}
                              </span>
                              <strong>{problemRowCountForExplorer}</strong>{" "}
                              problem-related
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text)",
                                  opacity: 0.85,
                                }}
                              >
                                {" "}
                                (for selected change)
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div
                        style={{
                          maxWidth: "100%",
                          overflowX: "auto",
                          margin: "0 auto 4px",
                        }}
                      >
                        <table
                          border="1"
                          cellPadding="10"
                          style={{ borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr>
                              {columns.map((col) => (
                                <th
                                  key={col.key}
                                  tabIndex={0}
                                  aria-label={`${col.label}, open column details`}
                                  onClick={() =>
                                    openColumnExplorerDetail(col.key)
                                  }
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === " "
                                    ) {
                                      e.preventDefault();
                                      openColumnExplorerDetail(col.key);
                                    }
                                  }}
                                  style={{
                                    verticalAlign: "top",
                                    textAlign: "left",
                                    minWidth: "7rem",
                                    cursor: "pointer",
                                    outline:
                                      feedFocusColumnKey === col.key
                                        ? "2px solid var(--accent)"
                                        : undefined,
                                    outlineOffset: "2px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "flex-start",
                                      gap: "8px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        color: "var(--text-h)",
                                      }}
                                    >
                                      {col.label}
                                    </span>
                                    <SensitivityBadge
                                      level={col.sensitivity}
                                    />
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "var(--accent)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      View details
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                            <tr>
                              {insights.map((insight) => (
                                <td key={insight.key}>
                                  {insight.nullPercentage}
                                </td>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {explorerFilteredIndices.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={columns.length}
                                  style={{
                                    padding: "16px 12px",
                                    fontSize: "14px",
                                    color: "var(--text)",
                                  }}
                                >
                                  No rows match your filters.
                                </td>
                              </tr>
                            ) : (
                              explorerFilteredIndices.map((rowIndex) => {
                                const row = currentData[rowIndex];
                                return (
                                  <tr key={rowIndex}>
                                    {columns.map((col) => (
                                      <td key={col.key}>
                                        {row[col.key] === null ||
                                        row[col.key] === undefined ||
                                        row[col.key] === ""
                                          ? "—"
                                          : String(row[col.key])}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {columnDetailKey && columnExplorerDetail ? (
                        <>
                          <button
                            type="button"
                            aria-label="Close column details"
                            onClick={() => setColumnDetailKey(null)}
                            style={{
                              position: "fixed",
                              inset: 0,
                              zIndex: 36,
                              border: "none",
                              padding: 0,
                              margin: 0,
                              background: "rgba(15, 18, 28, 0.18)",
                              cursor: "pointer",
                            }}
                          />
                          <aside
                            style={{
                              position: "fixed",
                              top: 0,
                              right: 0,
                              bottom: 0,
                              width: "min(380px, 94vw)",
                              zIndex: 37,
                              background: "var(--bg)",
                              borderLeft: "1px solid var(--border)",
                              boxShadow: "-12px 0 40px rgba(0,0,0,0.12)",
                              overflowY: "auto",
                              padding: "20px 18px 100px",
                              boxSizing: "border-box",
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: "12px",
                                marginBottom: "16px",
                              }}
                            >
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "18px",
                                  fontWeight: 700,
                                  color: "var(--text-h)",
                                  lineHeight: 1.25,
                                }}
                              >
                                {columnExplorerDetail.col.label}
                              </h3>
                              <button
                                type="button"
                                onClick={() => setColumnDetailKey(null)}
                                className="app-ghost-btn"
                                style={{
                                  flexShrink: 0,
                                  padding: "6px 12px",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  background: "var(--social-bg)",
                                  color: "var(--text-h)",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Close
                              </button>
                            </div>

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Current snapshot
                            </div>
                            <p
                              style={{
                                margin: "0 0 14px",
                                fontSize: "14px",
                                lineHeight: 1.5,
                                color: "var(--text)",
                              }}
                            >
                              <strong>Nulls:</strong>{" "}
                              {columnExplorerDetail.ins?.nullPercentage ?? "—"}
                              <br />
                              <strong>Distinct values:</strong>{" "}
                              {columnExplorerDetail.ins?.distinctCount ?? "—"}
                            </p>

                            {columnExplorerDetail.hasBaseline ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "var(--text-h)",
                                    marginBottom: "6px",
                                  }}
                                >
                                  vs baseline
                                </div>
                                <p
                                  style={{
                                    margin: "0 0 14px",
                                    fontSize: "14px",
                                    lineHeight: 1.5,
                                    color: "var(--text)",
                                  }}
                                >
                                  <strong>Nulls (baseline):</strong>{" "}
                                  {columnExplorerDetail.baselineNullPct}
                                  <br />
                                  <strong>Distinct (baseline):</strong>{" "}
                                  {columnExplorerDetail.distinctPrev}
                                </p>
                              </>
                            ) : null}

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Sample values
                            </div>
                            <p
                              style={{
                                margin: "0 0 14px",
                                fontSize: "14px",
                                lineHeight: 1.45,
                                color: "var(--text)",
                              }}
                            >
                              {columnExplorerDetail.samples.length > 0
                                ? columnExplorerDetail.samples
                                    .map((v) => String(v))
                                    .join(", ")
                                : "No non-empty values in the current snapshot."}
                            </p>

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Changed vs baseline
                            </div>
                            <p
                              style={{
                                margin: "0 0 14px",
                                fontSize: "14px",
                                lineHeight: 1.5,
                                color: "var(--text)",
                              }}
                            >
                              {columnExplorerDetail.hasBaseline &&
                              columnExplorerDetail.ins
                                ? (() => {
                                    const d = columnExplorerDetail;
                                    const bits = [];
                                    if (
                                      d.baselineNullPct !== d.ins.nullPercentage
                                    ) {
                                      bits.push(
                                        `Null rate ${d.baselineNullPct} → ${d.ins.nullPercentage}.`
                                      );
                                    }
                                    if (
                                      d.distinctPrev !== d.ins.distinctCount
                                    ) {
                                      bits.push(
                                        `Distinct count ${d.distinctPrev} → ${d.ins.distinctCount}.`
                                      );
                                    }
                                    if (d.churn?.addedValues.length) {
                                      bits.push(
                                        "New categorical values appeared."
                                      );
                                    }
                                    if (d.churn?.removedValues.length) {
                                      bits.push(
                                        "Some baseline values no longer appear."
                                      );
                                    }
                                    return bits.length > 0
                                      ? bits.join(" ")
                                      : "No material drift on this column.";
                                  })()
                                : "Load baseline + current to compare."}
                            </p>

                            {columnExplorerDetail.churn &&
                            (columnExplorerDetail.churn.addedValues.length >
                              0 ||
                              columnExplorerDetail.churn.removedValues.length >
                                0) ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "var(--text-h)",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Value breakdown
                                </div>
                                {columnExplorerDetail.churn.addedValues
                                  .length > 0 ? (
                                  <div style={{ marginBottom: "12px" }}>
                                    <div
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "var(--text-h)",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      New values (
                                      {
                                        columnExplorerDetail.churn
                                          .newValueRowCount
                                      }{" "}
                                      rows in current)
                                    </div>
                                    <ul
                                      style={{
                                        margin: 0,
                                        paddingLeft: "1.2rem",
                                        fontSize: "13px",
                                        lineHeight: 1.45,
                                        color: "var(--text)",
                                      }}
                                    >
                                      {columnExplorerDetail.churn.addedValues
                                        .slice(0, 12)
                                        .map((v) => (
                                          <li key={`a-${String(v)}`}>
                                            {String(v)}
                                          </li>
                                        ))}
                                      {columnExplorerDetail.churn.addedValues
                                        .length > 12 ? (
                                        <li>
                                          …and{" "}
                                          {columnExplorerDetail.churn
                                            .addedValues.length - 12}{" "}
                                          more
                                        </li>
                                      ) : null}
                                    </ul>
                                  </div>
                                ) : null}
                                {columnExplorerDetail.churn.removedValues
                                  .length > 0 ? (
                                  <div style={{ marginBottom: "14px" }}>
                                    <div
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "var(--text-h)",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Removed values (
                                      {
                                        columnExplorerDetail.churn
                                          .removedPrevRowCount
                                      }{" "}
                                      rows in baseline)
                                    </div>
                                    <ul
                                      style={{
                                        margin: 0,
                                        paddingLeft: "1.2rem",
                                        fontSize: "13px",
                                        lineHeight: 1.45,
                                        color: "var(--text)",
                                      }}
                                    >
                                      {columnExplorerDetail.churn.removedValues
                                        .slice(0, 12)
                                        .map((v) => (
                                          <li key={`r-${String(v)}`}>
                                            {String(v)}
                                          </li>
                                        ))}
                                      {columnExplorerDetail.churn.removedValues
                                        .length > 12 ? (
                                        <li>
                                          …and{" "}
                                          {columnExplorerDetail.churn
                                            .removedValues.length - 12}{" "}
                                          more
                                        </li>
                                      ) : null}
                                    </ul>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Why it may matter
                            </div>
                            {columnExplorerDetail.risk ? (
                              <>
                                <p
                                  style={{
                                    margin: "0 0 10px",
                                    fontSize: "14px",
                                    lineHeight: 1.5,
                                    color: "var(--text)",
                                  }}
                                >
                                  {columnExplorerDetail.risk.whyMatters}
                                </p>
                                {columnExplorerDetail.risk.mayBreak.length >
                                0 ? (
                                  <ul
                                    style={{
                                      margin: "0 0 8px",
                                      paddingLeft: "1.2rem",
                                      fontSize: "13px",
                                      lineHeight: 1.45,
                                      color: "var(--text)",
                                    }}
                                  >
                                    {columnExplorerDetail.risk.mayBreak.map(
                                      (x) => (
                                        <li key={x}>May break: {x}</li>
                                      )
                                    )}
                                  </ul>
                                ) : null}
                                {columnExplorerDetail.risk.mayAffect.length >
                                0 ? (
                                  <ul
                                    style={{
                                      margin: 0,
                                      paddingLeft: "1.2rem",
                                      fontSize: "13px",
                                      lineHeight: 1.45,
                                      color: "var(--text)",
                                    }}
                                  >
                                    {columnExplorerDetail.risk.mayAffect.map(
                                      (x) => (
                                        <li key={x}>May affect: {x}</li>
                                      )
                                    )}
                                  </ul>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    fontSize: "14px",
                                    lineHeight: 1.5,
                                    color: "var(--text)",
                                  }}
                                >
                                  No risk card for this column in this
                                  comparison. Typical downstream touchpoints:
                                </p>
                                <ul
                                  style={{
                                    margin: 0,
                                    paddingLeft: "1.2rem",
                                    fontSize: "13px",
                                    lineHeight: 1.45,
                                    color: "var(--text)",
                                  }}
                                >
                                  {columnExplorerDetail.ds.mayBreak.map(
                                    (x) => (
                                      <li key={`fb-${x}`}>May break: {x}</li>
                                    )
                                  )}
                                  {columnExplorerDetail.ds.mayAffect.map(
                                    (x) => (
                                      <li key={`fa-${x}`}>May affect: {x}</li>
                                    )
                                  )}
                                </ul>
                              </>
                            )}
                          </aside>
                        </>
                      ) : null}
                    </>
                  )}

                  {columns.length > 0 && currentData.length > 0 ? (
                    <>
                      <h3
                        style={{
                          ...governanceH2Style,
                          fontSize: "16px",
                          maxWidth: "42rem",
                          margin: "20px auto 10px",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        Column stats
                      </h3>
                      <ul style={insightListStyle}>
                        {insights.map((insight) => (
                          <li key={insight.key}>
                            <button
                              type="button"
                              onClick={() =>
                                openColumnExplorerDetail(insight.key)
                              }
                              style={{
                                ...insightCardStyle,
                                width: "100%",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                display: "block",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: "10px",
                                  marginBottom: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    color: "var(--text-h)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {insight.label}
                                </span>
                                <SensitivityBadge
                                  level={insight.sensitivity}
                                />
                              </div>
                              <div>
                                {insight.distinctCount} distinct value
                                {insight.distinctCount === 1 ? "" : "s"}
                              </div>
                              <div>{insight.nullPercentage} nulls</div>
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "var(--accent)",
                                }}
                              >
                                Open details →
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <h2
                    style={{
                      ...governanceH2Style,
                      fontSize: "17px",
                      maxWidth: "42rem",
                      margin: "28px auto 10px",
                      textAlign: "left",
                    }}
                  >
                    Column-level risks
                  </h2>
                  {riskFindings.length === 0 ? (
                    <p
                      style={{
                        maxWidth: "42rem",
                        margin: "0 auto 8px",
                        textAlign: "left",
                        fontSize: "14px",
                        lineHeight: 1.5,
                        color: "var(--text)",
                      }}
                    >
                      No column-level risks flagged for this comparison.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        maxWidth: "42rem",
                        margin: "0 auto 8px",
                      }}
                    >
                      {riskFindings.map((r) => {
                        const isHigh = r.severity === "HIGH";
                        return (
                          <div
                            key={r.id}
                            id={`overview-risk-${r.id}`}
                            style={{
                              ...insightCardStyle,
                              margin: 0,
                              borderLeft: `4px solid ${
                                isHigh
                                  ? "var(--risk-high-border)"
                                  : "var(--risk-medium-border)"
                              }`,
                              background: isHigh
                                ? "var(--risk-high-bg)"
                                : "var(--risk-medium-bg)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                color: isHigh
                                  ? "var(--risk-high)"
                                  : "var(--risk-medium)",
                                marginBottom: "6px",
                              }}
                            >
                              {isHigh ? "🚨 HIGH" : "⚠️ MEDIUM"} RISK —{" "}
                              {r.headline}
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--text-h)",
                                marginBottom: "4px",
                              }}
                            >
                              Why this matters
                            </div>
                            <p
                              style={{ margin: "0 0 10px", fontSize: "14px" }}
                            >
                              {r.whyMatters}
                            </p>
                            {r.exampleIssue ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "var(--text-h)",
                                    marginBottom: "4px",
                                  }}
                                >
                                  Example
                                </div>
                                <p
                                  style={{
                                    margin: "0 0 10px",
                                    fontSize: "14px",
                                  }}
                                >
                                  {r.exampleIssue}
                                </p>
                              </>
                            ) : null}
                            {r.mayBreak.length > 0 ? (
                              <>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "var(--text-h)",
                                    marginBottom: "4px",
                                  }}
                                >
                                  May break
                                </div>
                                <ul
                                  style={{
                                    margin: "0 0 8px",
                                    paddingLeft: "1.2rem",
                                    fontSize: "14px",
                                  }}
                                >
                                  {r.mayBreak.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              </>
                            ) : null}
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--text-h)",
                                marginBottom: "4px",
                              }}
                            >
                              May affect
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: "1.2rem",
                                fontSize: "14px",
                              }}
                            >
                              {r.mayAffect.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            <section
              style={overviewHelpSectionStyle}
              aria-label="Onboarding and help"
            >
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  margin: "0 0 12px",
                }}
              >
                How this works
              </h2>
              <ol
                style={{
                  margin: "0 0 32px",
                  paddingLeft: "1.25rem",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                <li style={{ marginBottom: "10px" }}>
                  Connect a <strong>baseline</strong> and a{" "}
                  <strong>current</strong> snapshot under{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("sources")}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "none",
                      color: "var(--accent)",
                      fontWeight: 600,
                      fontSize: "inherit",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Sources
                  </button>{" "}
                  (CSV uploads or the Snowflake demo).
                </li>
                <li style={{ marginBottom: "10px" }}>
                  Unlockdb diffs columns—null rates, distinct counts, value
                  churn—and surfaces risks plus likely downstream impact.
                </li>
                <li>
                  Explore <strong>Recent changes</strong>, the grid, and the
                  bottom <strong>copilot</strong> bar to filter, explain, and
                  open row-level drill-downs.
                </li>
              </ol>

              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  margin: "0 0 12px",
                }}
              >
                FAQ
              </h2>
              <div
                style={{
                  margin: "0 0 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <div>
                  <h3 style={{ ...governanceH3Style, marginBottom: "6px" }}>
                    Is my data sent anywhere?
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                    }}
                  >
                    In this demo, uploads and comparisons stay in your browser.
                    Snowflake form fields are for the UI only until a real
                    connector is wired up.
                  </p>
                </div>
                <div>
                  <h3 style={{ ...governanceH3Style, marginBottom: "6px" }}>
                    What counts as high risk?
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                    }}
                  >
                    Issues like sharp increases in nulls, unstable identifiers,
                    or breaking value changes are promoted when they are likely
                    to affect joins, reporting, or downstream systems.
                  </p>
                </div>
                <div>
                  <h3 style={{ ...governanceH3Style, marginBottom: "6px" }}>
                    Can I use my own files?
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                    }}
                  >
                    Yes—use CSV under Sources for baseline and current. Column
                    headers must match between the two snapshots.
                  </p>
                </div>
              </div>

              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  margin: "0 0 12px",
                }}
              >
                Coming soon
              </h2>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                <li style={{ marginBottom: "8px" }}>
                  Scheduled snapshots and change alerts
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Team workspaces, approvals, and audit exports
                </li>
                <li>Native warehouse sync beyond the demo connector</li>
              </ul>
            </section>
          </>
        )}

        {activeTab === "about" && (
          <section
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              textAlign: "left",
              paddingBottom: "8px",
            }}
          >
            <header style={{ marginBottom: "40px" }}>
              <h1
                style={{
                  fontSize: "clamp(26px, 4vw, 36px)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  color: "var(--text-h)",
                  margin: "0 0 14px",
                }}
              >
                See what changed in your data — before it breaks anything
              </h1>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: 1.5,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                Unlockdb helps teams detect data changes and understand their
                impact on downstream systems.
              </p>
            </header>

            <div style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  marginBottom: "10px",
                }}
              >
                The problem
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                Small data changes can silently break dashboards, pipelines, and
                integrations. Most teams only notice issues after something is
                already broken.
              </p>
            </div>

            <div style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  marginBottom: "12px",
                }}
              >
                How Unlockdb works
              </h2>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  fontSize: "15px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                <li style={{ marginBottom: "8px" }}>Compare data (before vs after)</li>
                <li style={{ marginBottom: "8px" }}>
                  Detect changes automatically
                </li>
                <li style={{ marginBottom: "8px" }}>Highlight risks</li>
                <li>Show downstream impact</li>
              </ol>
            </div>

            <div style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  marginBottom: "10px",
                }}
              >
                Example
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                Email column goes from 0% to 20% nulls → CRM sync may break
              </p>
            </div>

            <div style={{ marginBottom: "36px" }}>
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  marginBottom: "10px",
                }}
              >
                Why this is different
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                Unlockdb doesn’t just show what changed — it explains why it
                matters and what might break.
              </p>
            </div>

            <div>
              <h2
                style={{
                  ...governanceH2Style,
                  fontSize: "20px",
                  marginBottom: "12px",
                }}
              >
                Coming soon
              </h2>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  fontSize: "15px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                <li style={{ marginBottom: "8px" }}>Monitoring</li>
                <li style={{ marginBottom: "8px" }}>Alerts (Slack / Teams)</li>
                <li style={{ marginBottom: "8px" }}>
                  Data warehouse integrations
                </li>
                <li>AI copilot</li>
              </ul>
            </div>
          </section>
        )}

        {activeTab === "sources" && (
          <section style={{ maxWidth: "42rem", margin: "0 auto" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--text-h)",
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Sources
            </h1>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.5,
                color: "var(--text)",
                margin: "0 0 22px",
              }}
            >
              Connect a warehouse or load CSV snapshots for baseline vs.
              current comparison.
            </p>

            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-h)",
                  marginBottom: "10px",
                }}
              >
                Select data source
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {DATA_SOURCE_OPTIONS.map((opt) => {
                  const { id, label, recommended } = opt;
                  const active = selectedSource === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectDataSource(id)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "8px",
                        border: active
                          ? "2px solid var(--accent-border)"
                          : recommended
                            ? "2px solid var(--accent-border)"
                            : "1px solid var(--border)",
                        background: active
                          ? "var(--accent-bg)"
                          : "var(--social-bg)",
                        color: active ? "var(--accent)" : "var(--text-h)",
                        fontWeight: active || recommended ? 600 : 500,
                        fontSize: "14px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {label}
                      {recommended && !active ? (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                          }}
                        >
                          Primary
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.5,
                  color: "var(--text)",
                  margin: "12px 0 0",
                  maxWidth: "36rem",
                }}
              >
                Connect your data platform to monitor schema and data changes
                over time.
              </p>
            </div>

            {selectedSource !== null ? (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text)",
                  marginBottom: "16px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    Source:{" "}
                  </span>
                  {
                    DATA_SOURCE_OPTIONS.find((o) => o.id === selectedSource)
                      ?.label
                  }
                </span>
                {selectedSource === "snowflake" && snowflakeDemoConnected ? (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: "1px solid var(--accent-border)",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                    }}
                  >
                    Connected
                  </span>
                ) : selectedSource === "databricks" &&
                  databricksDemoConnected ? (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: "1px solid var(--accent-border)",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                    }}
                  >
                    Connected
                  </span>
                ) : null}
              </div>
            ) : null}

            <input
              ref={previousCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              aria-hidden={true}
              onChange={handlePreviousCsvSelected}
            />
            <input
              ref={currentCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              aria-hidden={true}
              onChange={handleCurrentCsvSelected}
            />

            {selectedSource === "csv" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    className="app-primary-btn"
                    onClick={() => previousCsvInputRef.current?.click()}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      border: "1px solid var(--accent-border)",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                      fontWeight: 600,
                      fontSize: "14px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Upload previous CSV
                  </button>
                  <button
                    type="button"
                    className="app-primary-btn"
                    onClick={() => currentCsvInputRef.current?.click()}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      border: "1px solid var(--accent-border)",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                      fontWeight: 600,
                      fontSize: "14px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Upload current CSV
                  </button>
                  <button
                    type="button"
                    className="app-ghost-btn"
                    onClick={handleUseSampleDataset}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--social-bg)",
                      color: "var(--text-h)",
                      fontWeight: 500,
                      fontSize: "14px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Use sample dataset
                  </button>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Previous:{" "}
                    </span>
                    {previousFileName} ({previousData.length} rows)
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Current:{" "}
                    </span>
                    {currentFileName} ({currentData.length} rows ·{" "}
                    {columns.length} columns)
                  </div>
                </div>
              </div>
            ) : null}

            {selectedSource === "snowflake" && !snowflakeDemoConnected ? (
              <form
                onSubmit={handleSnowflakeDemoConnect}
                style={{
                  padding: "18px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-border)",
                  background: "var(--accent-bg)",
                  boxSizing: "border-box",
                  marginBottom: "20px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--text-h)",
                  }}
                >
                  Connect Snowflake
                </h2>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    color: "var(--text)",
                  }}
                >
                  Demo mode — this simulates a read-only Snowflake connection.
                </p>
                <div style={authLabelStyle}>
                  <label htmlFor="sf-account">Account</label>
                  <input
                    id="sf-account"
                    type="text"
                    autoComplete="off"
                    value={snowflakeForm.account}
                    onChange={(e) =>
                      setSnowflakeForm((f) => ({
                        ...f,
                        account: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="e.g. xy12345.us-east-1"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sf-user">User</label>
                  <input
                    id="sf-user"
                    type="text"
                    autoComplete="username"
                    value={snowflakeForm.user}
                    onChange={(e) =>
                      setSnowflakeForm((f) => ({ ...f, user: e.target.value }))
                    }
                    style={authInputStyle}
                    placeholder="Service user"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sf-warehouse">Warehouse</label>
                  <input
                    id="sf-warehouse"
                    type="text"
                    autoComplete="off"
                    value={snowflakeForm.warehouse}
                    onChange={(e) =>
                      setSnowflakeForm((f) => ({
                        ...f,
                        warehouse: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="COMPUTE_WH"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sf-database">Database</label>
                  <input
                    id="sf-database"
                    type="text"
                    autoComplete="off"
                    value={snowflakeForm.database}
                    onChange={(e) =>
                      setSnowflakeForm((f) => ({
                        ...f,
                        database: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="analytics"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sf-schema">Schema</label>
                  <input
                    id="sf-schema"
                    type="text"
                    autoComplete="off"
                    value={snowflakeForm.schema}
                    onChange={(e) =>
                      setSnowflakeForm((f) => ({
                        ...f,
                        schema: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="public"
                  />
                </div>
                <button
                  type="submit"
                  disabled={snowflakeConnecting}
                  className="app-primary-btn"
                  style={{
                    marginTop: "14px",
                    padding: "12px 22px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: "14px",
                    fontFamily: "inherit",
                    cursor: snowflakeConnecting ? "wait" : "pointer",
                    opacity: snowflakeConnecting ? 0.85 : 1,
                  }}
                >
                  {snowflakeConnecting
                    ? "Connecting…"
                    : "Connect to Snowflake"}
                </button>
              </form>
            ) : null}

            {selectedSource === "snowflake" && snowflakeDemoConnected ? (
              <div
                style={{
                  marginBottom: "24px",
                  padding: "18px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--code-bg)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                  }}
                >
                  Connected to Snowflake demo workspace
                </p>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "14px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                  }}
                >
                  Connected
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.55,
                    color: "var(--text)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Source:{" "}
                    </span>
                    Snowflake demo
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Database:{" "}
                    </span>
                    analytics
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Schema:{" "}
                    </span>
                    public
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Table:{" "}
                    </span>
                    customers
                  </div>
                </div>
              </div>
            ) : null}

            {selectedSource === "databricks" && !databricksDemoConnected ? (
              <form
                onSubmit={handleDatabricksDemoConnect}
                style={{
                  padding: "18px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-border)",
                  background: "var(--accent-bg)",
                  boxSizing: "border-box",
                  marginBottom: "20px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--text-h)",
                  }}
                >
                  Connect Databricks
                </h2>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "13px",
                    lineHeight: 1.45,
                    color: "var(--text)",
                  }}
                >
                  Demo mode — this simulates a read-only Databricks connection.
                </p>
                <div style={authLabelStyle}>
                  <label htmlFor="db-workspace">Workspace URL</label>
                  <input
                    id="db-workspace"
                    type="text"
                    autoComplete="off"
                    value={databricksForm.workspaceUrl}
                    onChange={(e) =>
                      setDatabricksForm((f) => ({
                        ...f,
                        workspaceUrl: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="https://dbc-xxxxxxxx.cloud.databricks.com"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="db-catalog">Catalog</label>
                  <input
                    id="db-catalog"
                    type="text"
                    autoComplete="off"
                    value={databricksForm.catalog}
                    onChange={(e) =>
                      setDatabricksForm((f) => ({
                        ...f,
                        catalog: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="main"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="db-schema">Schema</label>
                  <input
                    id="db-schema"
                    type="text"
                    autoComplete="off"
                    value={databricksForm.schema}
                    onChange={(e) =>
                      setDatabricksForm((f) => ({
                        ...f,
                        schema: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="analytics"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="db-cluster">Cluster / SQL Warehouse</label>
                  <input
                    id="db-cluster"
                    type="text"
                    autoComplete="off"
                    value={databricksForm.clusterWarehouse}
                    onChange={(e) =>
                      setDatabricksForm((f) => ({
                        ...f,
                        clusterWarehouse: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="Shared autoscaling cluster"
                  />
                </div>
                <button
                  type="submit"
                  disabled={databricksConnecting}
                  className="app-primary-btn"
                  style={{
                    marginTop: "14px",
                    padding: "12px 22px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: "14px",
                    fontFamily: "inherit",
                    cursor: databricksConnecting ? "wait" : "pointer",
                    opacity: databricksConnecting ? 0.85 : 1,
                  }}
                >
                  {databricksConnecting
                    ? "Connecting…"
                    : "Connect to Databricks"}
                </button>
              </form>
            ) : null}

            {selectedSource === "databricks" && databricksDemoConnected ? (
              <div
                style={{
                  marginBottom: "24px",
                  padding: "18px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--code-bg)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                  }}
                >
                  Connected to Databricks demo workspace
                </p>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "14px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                  }}
                >
                  Connected
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.55,
                    color: "var(--text)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Source:{" "}
                    </span>
                    Databricks demo
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Catalog:{" "}
                    </span>
                    main
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Schema:{" "}
                    </span>
                    analytics
                  </div>
                  <div>
                    <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                      Table:{" "}
                    </span>
                    events
                  </div>
                </div>
              </div>
            ) : null}

            {selectedSource === "fabric" ? (
              <form
                onSubmit={handleDemoConnect}
                style={{
                  padding: "16px 18px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--code-bg)",
                  boxSizing: "border-box",
                }}
              >
                <div style={authLabelStyle}>
                  <label htmlFor="sources-conn-account">
                    Account / Workspace
                  </label>
                  <input
                    id="sources-conn-account"
                    type="text"
                    autoComplete="off"
                    value={connectionForm.account}
                    onChange={(e) =>
                      setConnectionForm((f) => ({
                        ...f,
                        account: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="Workspace URL or Fabric tenant"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sources-conn-user">User</label>
                  <input
                    id="sources-conn-user"
                    type="text"
                    autoComplete="username"
                    value={connectionForm.user}
                    onChange={(e) =>
                      setConnectionForm((f) => ({ ...f, user: e.target.value }))
                    }
                    style={authInputStyle}
                    placeholder="User or service principal"
                  />
                </div>
                <div style={authLabelStyle}>
                  <label htmlFor="sources-conn-warehouse">
                    Compute (Warehouse / Cluster)
                  </label>
                  <input
                    id="sources-conn-warehouse"
                    type="text"
                    autoComplete="off"
                    value={connectionForm.warehouse}
                    onChange={(e) =>
                      setConnectionForm((f) => ({
                        ...f,
                        warehouse: e.target.value,
                      }))
                    }
                    style={authInputStyle}
                    placeholder="Warehouse or cluster"
                  />
                </div>
                <button
                  type="submit"
                  className="app-primary-btn"
                  style={{
                    marginTop: "14px",
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    fontWeight: 600,
                    fontSize: "14px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Connect
                </button>
                {connectDemoAck ? (
                  <p
                    style={{
                      margin: "12px 0 0",
                      fontSize: "13px",
                      lineHeight: 1.45,
                      color: "var(--text)",
                    }}
                  >
                    Demo only — no connection was made. Replace{" "}
                    <code style={{ fontSize: "12px" }}>handleDemoConnect</code>{" "}
                    with your Snowflake, Databricks, or Fabric connector / API
                    call.
                  </p>
                ) : null}
              </form>
            ) : null}
          </section>
        )}

        {activeTab === "governance" && (
          <section style={{ ...governanceSectionStyle, marginBottom: 0 }}>
            <h2 style={governanceH2Style}>Governance</h2>
            <p style={governanceMutedStyle}>
              Demo only. No real authentication or permission enforcement.
            </p>

            <h3 style={{ ...governanceH3Style, marginTop: "4px" }}>
              Users &amp; Roles
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              {demoUsers.map((u) => (
                <div
                  key={u.name}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--social-bg)",
                    boxShadow: "var(--shadow)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "var(--text-h)",
                      }}
                    >
                      {u.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--accent)",
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border)",
                        padding: "3px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      {u.role}
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "1.1rem",
                      fontSize: "14px",
                      lineHeight: 1.5,
                      color: "var(--text)",
                    }}
                  >
                    {u.permissions.map((p) => (
                      <li key={p} style={{ marginBottom: "4px" }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "audit" && (
          <section style={{ ...governanceSectionStyle, marginBottom: 0 }}>
            <h2 style={governanceH2Style}>Audit Log</h2>
            <p style={governanceMutedStyle}>
              Demo activity only — not connected to a real audit store.
            </p>
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "var(--code-bg)",
                padding: "4px 16px",
                boxShadow: "var(--shadow)",
              }}
            >
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                }}
              >
                {auditLogEvents.map((ev, i) => (
                  <li
                    key={ev.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "16px",
                      padding: "12px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      fontSize: "14px",
                      lineHeight: 1.45,
                      color: "var(--text)",
                    }}
                  >
                    <span style={{ color: "var(--text-h)" }}>{ev.text}</span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text)",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {ev.when}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "chat" && (
          <section
            style={{
              maxWidth: "36rem",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--text-h)",
                margin: "0 0 8px",
              }}
            >
              Copilot history
            </h2>
            <p style={{ ...governanceMutedStyle, marginBottom: "16px" }}>
              Commands run from the sticky bar below. This tab is the full
              transcript; deterministic copilot actions also update Overview,
              Sources, and filters.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minHeight: "200px",
                maxHeight: "min(52vh, 420px)",
                overflowY: "auto",
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "10px",
                background: "var(--code-bg)",
                border: "1px solid var(--border)",
              }}
            >
              {messages.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  Try the bar: compare, high risk only, go to sources, connect
                  snowflake, explain why email is risky…
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      lineHeight: m.role === "assistant" ? 1.55 : 1.45,
                      color: "var(--text)",
                      background:
                        m.role === "user"
                          ? "var(--accent-bg)"
                          : "var(--social-bg)",
                      border: "1px solid var(--border)",
                      whiteSpace:
                        m.role === "assistant" ? "pre-line" : "normal",
                    }}
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s.prompt}
                  type="button"
                  className="chat-suggestion-btn"
                  onClick={() => sendChatMessage(s.prompt)}
                  style={chatSuggestionButtonStyle}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--text)",
                lineHeight: 1.45,
              }}
            >
              Type commands in the bottom bar — it stays visible on every tab.
            </p>
          </section>
        )}

        {activeTab === "account" &&
          (demoLoggedIn ? (
            <section style={{ maxWidth: "28rem", margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--text-h)",
                  margin: "0 0 8px",
                }}
              >
                Account
              </h2>
              <p style={{ ...governanceMutedStyle, marginBottom: "16px" }}>
                Demo session — not a real signed-in user.
              </p>
              <div
                style={{
                  padding: "20px 22px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--social-bg)",
                  boxShadow: "var(--shadow)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                }}
              >
                <dl style={{ margin: 0 }}>
                  <dt
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text)",
                      marginTop: 0,
                    }}
                  >
                    Name
                  </dt>
                  <dd
                    style={{
                      margin: "4px 0 0",
                      color: "var(--text-h)",
                      fontWeight: 600,
                    }}
                  >
                    {demoSessionProfile.name}
                  </dd>
                  <dt
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text)",
                      marginTop: "12px",
                    }}
                  >
                    Role
                  </dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--text-h)" }}>
                    {demoSessionProfile.role}
                  </dd>
                  <dt
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text)",
                      marginTop: "12px",
                    }}
                  >
                    Workspace
                  </dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--text-h)" }}>
                    {demoSessionProfile.workspace}
                  </dd>
                  <dt
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text)",
                      marginTop: "12px",
                    }}
                  >
                    Status
                  </dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--text-h)" }}>
                    {demoSessionProfile.status}
                  </dd>
                </dl>
                <button
                  type="button"
                  className="app-ghost-btn"
                  onClick={() => setDemoLoggedIn(false)}
                  style={{
                    marginTop: "20px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text-h)",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Log out (demo)
                </button>
              </div>
            </section>
          ) : (
            <section style={{ maxWidth: "420px", margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--text-h)",
                  margin: "0 0 8px",
                }}
              >
                Login / Account
              </h2>
              <p style={{ ...governanceMutedStyle, marginBottom: "18px" }}>
                Demo only — no real authentication yet.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  onMouseEnter={() => setAuthSubHover("login")}
                  onMouseLeave={() => setAuthSubHover(null)}
                  style={authSubTabStyle(
                    authMode === "login",
                    authSubHover === "login"
                  )}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  onMouseEnter={() => setAuthSubHover("signup")}
                  onMouseLeave={() => setAuthSubHover(null)}
                  style={authSubTabStyle(
                    authMode === "signup",
                    authSubHover === "signup"
                  )}
                >
                  Sign up
                </button>
              </div>

              <div
                style={{
                  padding: "22px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--social-bg)",
                  boxShadow: "var(--shadow)",
                }}
              >
                {authMode === "login" ? (
                  <form onSubmit={handleDemoLogin}>
                    <label style={authLabelStyle}>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        style={authInputStyle}
                      />
                    </label>
                    <label style={authLabelStyle}>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        style={authInputStyle}
                      />
                    </label>
                    <button
                      type="submit"
                      className="app-primary-btn"
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--accent-border)",
                        background: "var(--accent-bg)",
                        color: "var(--accent)",
                        fontWeight: 600,
                        fontSize: "15px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      Log in
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleDemoSignup}>
                    <label style={authLabelStyle}>
                      Full name
                      <input
                        type="text"
                        autoComplete="name"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        style={authInputStyle}
                      />
                    </label>
                    <label style={authLabelStyle}>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        style={authInputStyle}
                      />
                    </label>
                    <label style={authLabelStyle}>
                      Password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        style={authInputStyle}
                      />
                    </label>
                    <button
                      type="submit"
                      className="app-primary-btn"
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid var(--accent-border)",
                        background: "var(--accent-bg)",
                        color: "var(--accent)",
                        fontWeight: 600,
                        fontSize: "15px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      Create account
                    </button>
                  </form>
                )}
              </div>
            </section>
          ))}
      </main>

      <footer
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 25,
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
          boxShadow: "0 -6px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: "1126px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 20px 14px",
          }}
        >
          {copilotHistoryExpanded ? (
            <div
              style={{
                maxHeight: "min(28vh, 220px)",
                overflowY: "auto",
                marginBottom: "10px",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--code-bg)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {messages.length === 0 ? (
                <span
                  style={{ fontSize: "12px", color: "var(--text)" }}
                >
                  No messages yet.
                </span>
              ) : (
                messages.slice(-8).map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.45,
                      color: "var(--text)",
                      whiteSpace: m.role === "assistant" ? "pre-line" : "normal",
                      padding: "4px 0",
                      borderTop:
                        i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--text-h)",
                        marginRight: "6px",
                      }}
                    >
                      {m.role === "user" ? "You" : "Copilot"}
                    </span>
                    {m.text}
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setCopilotHistoryExpanded((x) => !x)}
              className="app-ghost-btn"
              style={{
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--social-bg)",
                color: "var(--text-h)",
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
              aria-expanded={copilotHistoryExpanded}
            >
              {copilotHistoryExpanded ? "Hide" : "History"}
            </button>
            <form
              onSubmit={handleCopilotSend}
              style={{
                display: "flex",
                flex: 1,
                gap: "8px",
                alignItems: "stretch",
                minWidth: "min(100%, 240px)",
              }}
            >
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder="Command — e.g. compare customers today vs yesterday, high risk only, go to sources…"
                aria-label="Copilot command"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  background: "var(--bg)",
                  color: "var(--text-h)",
                }}
              />
              <button
                type="submit"
                className="app-primary-btn"
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-border)",
                  background: "var(--accent-bg)",
                  color: "var(--accent)",
                  fontWeight: 600,
                  fontSize: "14px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Run
              </button>
            </form>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
              fontSize: "11px",
              color: "var(--text)",
              lineHeight: 1.35,
            }}
          >
            {changeFeedFilter === "high-risk" ? (
              <span>
                Feed filter: <strong>HIGH risk only</strong>
              </span>
            ) : (
              <span>
                Feed filter: <strong>all</strong>
              </span>
            )}
            {selectedColumn ? (
              <span>
                Column focus:{" "}
                <strong>
                  {columns.find((c) => c.key === selectedColumn)?.label ??
                    selectedColumn}
                </strong>
              </span>
            ) : null}
            {commandResult?.copilot ? (
              <span style={{ opacity: 0.9 }}>Last: copilot action</span>
            ) : commandResult ? (
              <span style={{ opacity: 0.9 }}>Last: assistant reply</span>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
