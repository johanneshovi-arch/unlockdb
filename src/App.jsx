import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import UnlockdbLogo from "./UnlockdbLogo.jsx";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { askClaude, SQL_INVESTIGATION_SYSTEM } from "./claudeApi.js";

/** Tab ids ↔ URL paths for react-router */
const TAB_TO_PATH = {
  overview: "/",
  about: "/how-it-works",
  sources: "/sources",
  chat: "/copilot",
  governance: "/governance",
  settings: "/settings",
  contracts: "/contracts",
  security: "/security",
  audit: "/audit",
  account: "/account",
};

const PATH_TO_TAB = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tabId, path]) => [path, tabId])
);

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function tabIdFromPathname(pathname) {
  const n = normalizePathname(pathname);
  return PATH_TO_TAB[n] ?? null;
}

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

const SNOWFLAKE_DEMO_PREVIOUS_SCHEMA = {
  customers: [
    { name: "customer_id", type: "VARCHAR", nullable: false },
    { name: "email", type: "VARCHAR", nullable: true },
    { name: "country", type: "VARCHAR", nullable: true },
    { name: "plan_tier", type: "VARCHAR", nullable: true },
    { name: "mrr", type: "NUMBER", nullable: true },
    { name: "fax_number", type: "VARCHAR", nullable: true },
  ],
};

const SNOWFLAKE_DEMO_CURRENT_SCHEMA = {
  customers: [
    { name: "customer_id", type: "VARCHAR", nullable: false },
    { name: "email", type: "VARCHAR", nullable: true },
    { name: "country", type: "VARCHAR", nullable: true },
    { name: "plan_tier", type: "VARCHAR", nullable: true },
    { name: "mrr", type: "NUMBER", nullable: true },
    { name: "phone_number", type: "VARCHAR", nullable: true },
    { name: "created_at", type: "TIMESTAMP", nullable: true },
  ],
};

const DEMO_TABLES_MONITORED = 20;

function detectSchemaChanges(prevSchema, currSchema) {
  if (!Array.isArray(prevSchema) || !Array.isArray(currSchema)) return [];
  const prevMap = new Map(prevSchema.map((c) => [c.name, c]));
  const currMap = new Map(currSchema.map((c) => [c.name, c]));
  const out = [];
  for (const [name, curr] of currMap) {
    if (!prevMap.has(name)) {
      out.push({ type: "added", column: name, dataType: curr.type });
    }
  }
  for (const [name, prev] of prevMap) {
    if (!currMap.has(name)) {
      out.push({ type: "dropped", column: name, dataType: prev.type });
    }
  }
  for (const [name, prev] of prevMap) {
    const curr = currMap.get(name);
    if (!curr) continue;
    if (prev.type !== curr.type) {
      out.push({
        type: "type_change",
        column: name,
        previousType: prev.type,
        newType: curr.type,
      });
    }
    if (Boolean(prev.nullable) !== Boolean(curr.nullable)) {
      out.push({
        type: "nullability_change",
        column: name,
        previousNullable: prev.nullable,
        newNullable: curr.nullable,
      });
    }
  }
  return out;
}

function sparklineDataFromSeries(values) {
  return values.map((v, i) => ({ i, v }));
}

function insightSparklineSeries(insightKey, riskFindings) {
  const rf = riskFindings.find((r) => r.id === insightKey);
  if (rf?.severity === "HIGH") {
    return sparklineDataFromSeries([0, 0, 0, 1, 2, 5, 20]);
  }
  if (rf?.severity === "MEDIUM") {
    return sparklineDataFromSeries([3, 3, 4, 3, 5, 4, 6]);
  }
  return sparklineDataFromSeries([0, 0, 0, 0, 0, 1, 0]);
}

function insightSparklineColor(insightKey, riskFindings) {
  const rf = riskFindings.find((r) => r.id === insightKey);
  if (rf?.severity === "HIGH") return "#ef4444";
  if (rf?.severity === "MEDIUM") return "#f59e0b";
  return "#22c55e";
}

function tableBrowserSparklineSeries(tbl) {
  if (tbl.riskLevel === "high") {
    return sparklineDataFromSeries([0, 0, 0, 1, 2, 5, 20]);
  }
  if (tbl.riskLevel === "medium" || tbl.status === "changes") {
    return sparklineDataFromSeries([3, 3, 4, 3, 5, 4, 6]);
  }
  if (tbl.riskLevel === "low") {
    return sparklineDataFromSeries([3, 4, 3, 4, 5, 4, 5]);
  }
  return sparklineDataFromSeries([0, 0, 0, 0, 0, 1, 0]);
}

function tableBrowserSparklineColor(tbl) {
  if (tbl.riskLevel === "high") return "#ef4444";
  if (tbl.riskLevel === "medium" || tbl.status === "changes") {
    return "#f59e0b";
  }
  if (tbl.riskLevel === "low") return "#f59e0b";
  return "#22c55e";
}

function heatmapNotMonitored(tbl) {
  return (
    Boolean(tbl.schema?.toLowerCase().includes(".hr")) ||
    /\b(temp_|LEGACY|BACKUP|SANDBOX)\b/i.test(String(tbl.name ?? ""))
  );
}

function heatmapCellBackground(tbl) {
  if (heatmapNotMonitored(tbl)) {
    return "#333333";
  }
  if (tbl.riskLevel === "high" || tbl.status === "issues") {
    return "rgba(239, 68, 68, 0.35)";
  }
  if (
    tbl.riskLevel === "medium" ||
    tbl.status === "changes" ||
    (tbl.changeCount ?? 0) > 0
  ) {
    return "rgba(245, 158, 11, 0.35)";
  }
  if (tbl.riskLevel === "none" || tbl.status === "ok") {
    return "rgba(34, 197, 94, 0.28)";
  }
  return "#333333";
}

function highlightSqlForDisplay(sql) {
  const s = String(sql ?? "");
  const parts = [];
  let last = 0;
  let m;
  const re = /\b(ORDER\s+BY|IS\s+NULL|SELECT|FROM|WHERE|AND|OR|LIMIT)\b/gi;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      parts.push({ k: "t", t: s.slice(last, m.index) });
    }
    parts.push({ k: "kw", t: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ k: "t", t: s.slice(last) });
  if (parts.length === 0) parts.push({ k: "t", t: s });
  return parts;
}

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

const SNOWFLAKE_TABLE_BROWSER = [
  {
    name: "customers",
    schema: "analytics.public",
    rows: 12847,
    columns: 5,
    lastSync: "2 min ago",
    status: "issues",
    hasChanges: true,
    changeCount: 2,
    riskLevel: "high",
  },
  {
    name: "orders",
    schema: "analytics.public",
    rows: 84392,
    columns: 8,
    lastSync: "2 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "medium",
  },
  {
    name: "order_items",
    schema: "analytics.public",
    rows: 231847,
    columns: 6,
    lastSync: "5 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "products",
    schema: "analytics.public",
    rows: 4821,
    columns: 9,
    lastSync: "5 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "product_categories",
    schema: "analytics.public",
    rows: 48,
    columns: 3,
    lastSync: "1 hour ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "sessions",
    schema: "analytics.public",
    rows: 98234,
    columns: 6,
    lastSync: "12 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "medium",
  },
  {
    name: "revenue_daily",
    schema: "analytics.public",
    rows: 365,
    columns: 4,
    lastSync: "1 hour ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "revenue_monthly",
    schema: "analytics.public",
    rows: 36,
    columns: 5,
    lastSync: "1 hour ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "tbl_temp_crm_001",
    schema: "analytics.staging",
    rows: 2841,
    columns: 12,
    lastSync: "3 hours ago",
    status: "issues",
    hasChanges: true,
    changeCount: 4,
    riskLevel: "high",
    aiNameSuggestion: "crm_contacts_staging",
  },
  {
    name: "LEGACY_USER_EXPORT_v3",
    schema: "analytics.staging",
    rows: 18293,
    columns: 23,
    lastSync: "6 hours ago",
    status: "issues",
    hasChanges: true,
    changeCount: 7,
    riskLevel: "high",
    aiNameSuggestion: "users_legacy",
  },
  {
    name: "marketing_campaigns",
    schema: "analytics.public",
    rows: 847,
    columns: 11,
    lastSync: "30 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "campaign_clicks",
    schema: "analytics.public",
    rows: 482910,
    columns: 7,
    lastSync: "5 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "low",
  },
  {
    name: "user_segments",
    schema: "analytics.public",
    rows: 24,
    columns: 4,
    lastSync: "1 hour ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "invoices",
    schema: "analytics.finance",
    rows: 38291,
    columns: 9,
    lastSync: "15 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "payments",
    schema: "analytics.finance",
    rows: 29847,
    columns: 8,
    lastSync: "15 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 2,
    riskLevel: "medium",
  },
  {
    name: "subscriptions",
    schema: "analytics.finance",
    rows: 8472,
    columns: 7,
    lastSync: "30 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "support_tickets",
    schema: "analytics.public",
    rows: 14829,
    columns: 10,
    lastSync: "10 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "proc_data_final_v2",
    schema: "analytics.staging",
    rows: 5821,
    columns: 18,
    lastSync: "2 hours ago",
    status: "issues",
    hasChanges: true,
    changeCount: 3,
    riskLevel: "high",
    aiNameSuggestion: "processed_transactions",
  },
  {
    name: "geo_regions",
    schema: "analytics.public",
    rows: 195,
    columns: 4,
    lastSync: "1 day ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "employee_data",
    schema: "analytics.hr",
    rows: 284,
    columns: 15,
    lastSync: "1 day ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
];

const DATABRICKS_TABLE_BROWSER = [
  {
    name: "events",
    schema: "main.analytics",
    rows: 412891,
    columns: 5,
    lastSync: "1 min ago",
    status: "issues",
    hasChanges: true,
    changeCount: 3,
    riskLevel: "high",
  },
  {
    name: "page_views",
    schema: "main.analytics",
    rows: 1829471,
    columns: 6,
    lastSync: "1 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "medium",
  },
  {
    name: "clicks",
    schema: "main.analytics",
    rows: 982847,
    columns: 5,
    lastSync: "2 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "conversions",
    schema: "main.analytics",
    rows: 48291,
    columns: 7,
    lastSync: "5 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 2,
    riskLevel: "medium",
  },
  {
    name: "user_properties",
    schema: "main.analytics",
    rows: 98234,
    columns: 8,
    lastSync: "10 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "sessions_raw",
    schema: "main.bronze",
    rows: 2847291,
    columns: 4,
    lastSync: "1 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "sessions_clean",
    schema: "main.silver",
    rows: 2841029,
    columns: 8,
    lastSync: "5 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "low",
  },
  {
    name: "RAW_EVENTS_BACKUP_0401",
    schema: "main.bronze",
    rows: 8472910,
    columns: 3,
    lastSync: "2 days ago",
    status: "issues",
    hasChanges: true,
    changeCount: 5,
    riskLevel: "high",
    aiNameSuggestion: "events_backup_2024_04",
  },
  {
    name: "ml_training_data",
    schema: "main.ml",
    rows: 482910,
    columns: 24,
    lastSync: "1 hour ago",
    status: "issues",
    hasChanges: true,
    changeCount: 2,
    riskLevel: "high",
  },
  {
    name: "ml_predictions",
    schema: "main.ml",
    rows: 48291,
    columns: 6,
    lastSync: "30 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "feature_store",
    schema: "main.ml",
    rows: 98234,
    columns: 47,
    lastSync: "15 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 3,
    riskLevel: "medium",
  },
  {
    name: "temp_analysis_jsmith",
    schema: "main.sandbox",
    rows: 1247,
    columns: 8,
    lastSync: "3 days ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
    aiNameSuggestion: "customer_analysis_q1",
  },
  {
    name: "product_events",
    schema: "main.analytics",
    rows: 284710,
    columns: 6,
    lastSync: "2 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "error_logs",
    schema: "main.monitoring",
    rows: 84729,
    columns: 5,
    lastSync: "1 min ago",
    status: "issues",
    hasChanges: true,
    changeCount: 8,
    riskLevel: "high",
  },
  {
    name: "pipeline_runs",
    schema: "main.monitoring",
    rows: 12847,
    columns: 7,
    lastSync: "5 min ago",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "low",
  },
  {
    name: "data_quality_checks",
    schema: "main.monitoring",
    rows: 4821,
    columns: 6,
    lastSync: "10 min ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "attribution_model_v4",
    schema: "main.ml",
    rows: 28471,
    columns: 12,
    lastSync: "2 hours ago",
    status: "changes",
    hasChanges: true,
    changeCount: 2,
    riskLevel: "medium",
  },
  {
    name: "FINAL_REPORT_DO_NOT_DELETE",
    schema: "main.sandbox",
    rows: 847,
    columns: 9,
    lastSync: "1 week ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
    aiNameSuggestion: "quarterly_report_archive",
  },
  {
    name: "cohort_analysis",
    schema: "main.analytics",
    rows: 2847,
    columns: 8,
    lastSync: "1 hour ago",
    status: "ok",
    hasChanges: false,
    changeCount: 0,
    riskLevel: "none",
  },
  {
    name: "realtime_events",
    schema: "main.streaming",
    rows: 9284710,
    columns: 5,
    lastSync: "just now",
    status: "changes",
    hasChanges: true,
    changeCount: 1,
    riskLevel: "low",
  },
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

const SETTINGS_ALERT_DEMO_TABLE_IDS = [
  "customers",
  "orders",
  "events",
  "sessions",
  "revenue_daily",
];

const DEFAULT_SETTINGS_TABLE_SENSITIVITY = {
  customers: "high",
  orders: "high",
  events: "low",
  sessions: "normal",
  revenue_daily: "normal",
};

function parseNullPercentPointIncreaseFromChangeText(changeText) {
  const m = String(changeText ?? "").match(
    /(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/
  );
  if (!m) return null;
  const a = Number.parseFloat(m[1]);
  const b = Number.parseFloat(m[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, b - a);
}

function resolveActiveDemoTableIdForAlertSettings(
  selectedSource,
  databricksDemoConnected,
  snowflakeWarehouseTableDisplay,
  databricksWarehouseTableDisplay
) {
  if (selectedSource === "databricks" && databricksDemoConnected) {
    const raw = databricksWarehouseTableDisplay
      ? String(databricksWarehouseTableDisplay).trim().toLowerCase()
      : "events";
    const norm = raw.replace(/\s+/g, "_");
    if (SETTINGS_ALERT_DEMO_TABLE_IDS.includes(norm)) return norm;
    return "events";
  }
  if (selectedSource === "snowflake" && snowflakeWarehouseTableDisplay) {
    const raw = String(snowflakeWarehouseTableDisplay).trim().toLowerCase();
    const norm = raw.replace(/\s+/g, "_");
    if (SETTINGS_ALERT_DEMO_TABLE_IDS.includes(norm)) return norm;
  }
  return "customers";
}

function adjustStatChangeForUserAlertSettings(sc, options) {
  const { nullThresholdPts, sensitivityMode } = options;
  if (
    sensitivityMode === "muted" &&
    (sc.tier === "HIGH" || sc.tier === "MEDIUM")
  ) {
    return null;
  }
  const mult =
    sensitivityMode === "high"
      ? 0.75
      : sensitivityMode === "low"
        ? 1.25
        : 1;
  const effectiveNullTh = nullThresholdPts * mult;
  const kind = inferExplainChangeKind(sc);
  const isNullIncreaseHigh =
    sc.tier === "HIGH" &&
    (kind === "null_increase" || sc.drillKind === "null_increase");
  if (!isNullIncreaseHigh) {
    return sc;
  }
  const inc = parseNullPercentPointIncreaseFromChangeText(sc.changeText);
  if (inc === null) {
    return sc;
  }
  if (inc <= effectiveNullTh) {
    return { ...sc, tier: "INFO", label: "INFO" };
  }
  return sc;
}

function settingsAlertSensitivityBadgeStyle(mode) {
  switch (mode) {
    case "high":
      return {
        label: "Sensitive",
        background: "var(--risk-high-bg)",
        color: "var(--risk-high)",
        border: "1px solid var(--risk-high-border)",
      };
    case "low":
      return {
        label: "Relaxed",
        background: "var(--accent-bg)",
        color: "var(--accent)",
        border: "1px solid var(--accent-border)",
      };
    case "muted":
      return {
        label: "Muted",
        background: "var(--code-bg)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      };
    default:
      return {
        label: "Default",
        background: "var(--code-bg)",
        color: "var(--text-h)",
        border: "1px solid var(--border)",
      };
  }
}

const settingsPageSelectStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--text-h)",
  minWidth: "200px",
};

const settingsPageSectionCardStyle = {
  padding: "16px 18px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--social-bg)",
  boxShadow: "none",
  marginBottom: "18px",
};

const settingsPageNumberInputStyle = {
  maxWidth: "120px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "14px",
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--text-h)",
  boxSizing: "border-box",
};

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

function buildExplainClaudeContext(statChange, previousData, currentData, drillSlice) {
  return {
    columnKey: statChange.columnKey,
    columnLabel: statChange.columnLabel,
    changeText: statChange.changeText,
    tier: statChange.tier,
    impactLines: statChange.impactLines,
    previousRowCount: previousData.length,
    currentRowCount: currentData.length,
    drillDownRows: drillSlice,
  };
}

function buildCopilotSourceLabel(
  selectedSource,
  snowflakeDemoConnected,
  databricksDemoConnected,
  snowflakeWarehouseTableDisplay,
  databricksWarehouseTableDisplay
) {
  if (selectedSource === "snowflake" && snowflakeDemoConnected) {
    return `Snowflake · ${snowflakeWarehouseTableDisplay ?? "connected"}`;
  }
  if (selectedSource === "snowflake") return "Snowflake (not connected)";
  if (selectedSource === "databricks" && databricksDemoConnected) {
    return `Databricks · ${databricksWarehouseTableDisplay ?? "connected"}`;
  }
  if (selectedSource === "databricks") return "Databricks (not connected)";
  if (selectedSource === "csv") return "CSV";
  if (selectedSource === "fabric") return "Microsoft Fabric";
  return "Not connected";
}

function buildCopilotTableLabel(
  selectedSource,
  snowflakeDemoConnected,
  databricksDemoConnected,
  snowflakeWarehouseTableDisplay,
  databricksWarehouseTableDisplay
) {
  if (selectedSource === "snowflake" && snowflakeDemoConnected) {
    return snowflakeWarehouseTableDisplay ?? null;
  }
  if (selectedSource === "databricks" && databricksDemoConnected) {
    return databricksWarehouseTableDisplay ?? null;
  }
  return null;
}

function demoTableBrowserStatusDotColor(status) {
  if (status === "issues") return "var(--risk-high)";
  if (status === "changes") return "#ca8a04";
  if (status === "ok") return "#22c55e";
  return "#9ca3af";
}

function buildWorkspaceSummaryForClaude(tableBrowserSource, tableBrowserList) {
  if (!tableBrowserSource || !tableBrowserList?.length) return null;
  const source =
    tableBrowserSource === "snowflake" ? "Snowflake" : "Databricks";
  const tablesWithIssues = tableBrowserList.filter(
    (t) => t.riskLevel === "high"
  ).length;
  const tablesWithChanges = tableBrowserList.filter(
    (t) => t.hasChanges
  ).length;
  return {
    source,
    totalTables: tableBrowserList.length,
    tablesWithIssues,
    tablesWithChanges,
    allTables: tableBrowserList.map((t) => ({
      name: t.name,
      schema: t.schema,
      status: t.status,
      riskLevel: t.riskLevel,
      changeCount: t.changeCount,
      lastSync: t.lastSync,
      aiNameSuggestion: t.aiNameSuggestion ?? null,
    })),
  };
}

function buildCopilotContextPack(ctx, meta) {
  const lines = [];
  if (meta.workspaceSummary) {
    lines.push(
      `Workspace summary:\n${JSON.stringify(meta.workspaceSummary)}`
    );
  }
  lines.push(`Source: ${meta.sourceLabel}`);
  if (meta.tableLabel) lines.push(`Table: ${meta.tableLabel}`);
  lines.push(
    `Rows: baseline ${ctx.previousData.length}, current ${ctx.currentData.length}`
  );
  const colBits = ctx.insights.map(
    (i) => `${i.label} null=${i.nullPercentage} distinct=${i.distinctCount}`
  );
  lines.push(`Columns (${ctx.columns.length}): ${colBits.join("; ")}`);
  if (ctx.diffSummaryParagraph?.trim()) {
    lines.push(`Summary: ${ctx.diffSummaryParagraph.trim().slice(0, 400)}`);
  }
  const bullets = (ctx.diffSummaryBullets ?? []).slice(0, 40);
  if (bullets.length) {
    lines.push(`Changes: ${bullets.join(" · ")}`);
  }
  const risks = (ctx.riskFindings ?? []).slice(0, 20).map((r) => {
    const mb = (r.mayBreak ?? []).slice(0, 2).join(", ");
    const ma = (r.mayAffect ?? []).slice(0, 2).join(", ");
    return `[${r.severity}] ${r.headline} | mayBreak: ${mb || "—"} | mayAffect: ${ma || "—"}`;
  });
  if (risks.length) lines.push(`Risks: ${risks.join(" || ")}`);
  if (Array.isArray(ctx.contractViolations)) {
    const cv = ctx.contractViolations.map((v) => ({
      column: v.column,
      rule: v.message,
      severity: v.severity,
      affectedRows: v.affectedRows,
    }));
    if (cv.length) {
      lines.push(`Contract violations: ${JSON.stringify(cv)}`);
    } else if (ctx.contracts?.length) {
      lines.push(
        `Contracts: ${ctx.contracts.length} rule(s) defined — all passed on loaded data.`
      );
    }
  }
  const imp = (meta.impactLines ?? []).slice(0, 15);
  if (imp.length) lines.push(`Impact lines: ${imp.join(" · ")}`);
  if (meta.deterministicActionReply) {
    lines.push(`Recent UI action: ${meta.deterministicActionReply}`);
  }
  if (ctx.rowLevelDiff != null && ctx.dataQualityIssues != null) {
    lines.push(
      `Row-level diff & quality (JSON): ${JSON.stringify(
        rowDiffForClaudePayload(ctx.rowLevelDiff, ctx.dataQualityIssues)
      )}`
    );
  }
  let out = lines.join("\n");
  if (out.length > 3800) {
    out = `${out.slice(0, 3797)}...`;
  }
  return out;
}

/** First balanced {...} in text (avoids lastIndexOf('}') breaking on } inside strings). */
function extractFirstBalancedJsonObject(text) {
  if (text == null || typeof text !== "string") return null;
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    if (c === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Normalize model quirks: Response/Action keys, stringified action, single-quoted JSON attempt. */
function normalizeCopilotPayload(obj) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const o = { ...obj };
  if (o.response === undefined && o.Response !== undefined) {
    o.response = o.Response;
  }
  if (o.action === undefined && o.Action !== undefined) {
    o.action = o.Action;
  }
  if (typeof o.action === "string" && o.action.trim()) {
    const s = o.action.trim();
    if (s.startsWith("{")) {
      try {
        o.action = JSON.parse(s);
      } catch {
        o.action = { type: s };
      }
    } else {
      o.action = { type: s };
    }
  }
  return o;
}

/** Extract JSON with optional { response, action } from Claude (may be fenced, prose, or non-standard JSON). */
function parseCopilotActionJson(text) {
  if (text == null || typeof text !== "string") return null;
  let t = text.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n*```/im.exec(t);
  if (fenced) t = fenced[1].trim();
  const tryOne = (s) => {
    if (s == null) return null;
    try {
      const o = JSON.parse(s);
      if (!o || typeof o !== "object" || Array.isArray(o)) return null;
      return o;
    } catch {
      return null;
    }
  };
  const stripTrailingCommas = (s) => s?.replace(/,\s*([}\]])/g, "$1");
  const candidates = [
    t,
    extractFirstBalancedJsonObject(t),
    extractFirstBalancedJsonObject(t.replace(/^[\s\S]*?(\{)/, "$1")),
  ].filter(Boolean);
  for (const c of candidates) {
    const parsed =
      tryOne(c) ||
      tryOne(stripTrailingCommas(c));
    if (!parsed) continue;
    if (
      "response" in parsed ||
      "action" in parsed ||
      "Response" in parsed ||
      "Action" in parsed ||
      (typeof parsed.type === "string" && parsed.type.length > 0)
    ) {
      return normalizeCopilotPayload(parsed);
    }
  }
  return null;
}

const UNLOCKDB_COPILOT_ACTION_SYSTEM = `You are the AI Assistant for Unlockdb.
You can answer questions AND control the app directly.
The system message also includes a block UNLOCKDB APP STATE with live connection status, loaded data, current tab, and the exact list of actions the UI can run—trust that over anything assumed from memory.

When the user wants to perform an action, respond with JSON in this exact format (use double quotes):
{
  "response": "your natural language reply",
  "action": { "type": "ACTION_TYPE" }
}
When no app action is needed, use: "action": null
If the user only asks a question, respond with { "response": "your answer", "action": null }.
When the user says "show table", "I can't see the table", "show me the data", "show rows", "see the data", "view the table", or similar: respond with action { "type": "SHOW_TABLE_DATA" } (not null).
When the user asks to see the table, show data, view rows, or "show me the customers": execute action type SHOW_TABLE_DATA.
When the user asks what changed, to see the diff, or to compare baseline vs current: execute SHOW_DIFF.
Keep "response" short and friendly. Always return valid JSON only, no surrounding prose.`;

async function claudeChatReply(userMessage, packedContextString, claudeOptions = {}) {
  try {
    const raw = await askClaude(userMessage, packedContextString, {
      mode: "chat",
      systemPrompt: claudeOptions.systemPrompt,
      maxTokens: claudeOptions.maxTokens,
    });
    return typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  } catch (e) {
    console.error("claudeChatReply failed:", e);
    return "";
  }
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
    `Use the drill-down and AI assistant filters to isolate affected rows, then trace them back to the ingestion step.`,
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

const loadingDotStyle = {
  display: "inline-block",
  animation: "pulse 1.5s ease-in-out infinite",
};

const aiExplainSectionLabelStyle = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--accent)",
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
    navigateToTab,
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
    navigateToTab("sources");
    return "Snowflake demo connected. Open Sources and pick a table in the browser (e.g. customers or events for a full comparison).";
  }

  if (/\bconnect snowflake\b/.test(q)) {
    navigateToTab("sources");
    if (selectedSource !== "snowflake") selectDataSource("snowflake");
    window.setTimeout(() => {
      document.getElementById("sf-account")?.focus();
    }, 80);
    return "Opened Sources with Snowflake selected. Account field is focused (demo — nothing is sent to a server).";
  }

  if (/\b(go to|open)\s+overview\b/.test(q) || /^\s*overview\s*$/.test(text)) {
    navigateToTab("overview");
    return "Switched to Overview.";
  }

  if (/\b(go to|open)\s+sources\b/.test(q) || /^\s*sources\s*$/.test(text)) {
    navigateToTab("sources");
    return "Switched to Sources.";
  }

  if (
    /\b(go to|open)\s+(chat|copilot|ai\s*assistant)\b/i.test(q) ||
    /\b(copilot|ai\s*assistant)\s+history\b/i.test(q) ||
    /\bopen\s+(copilot|ai\s*assistant)\b/i.test(q)
  ) {
    navigateToTab("chat");
    return "Opened AI Assistant history.";
  }

  if (
    /\b(show only|only)\s+high[\s-]?risk\b|\bhigh[\s-]?risk only\b|\bfilter high risk\b|\bshow only high[\s-]?risk changes\b/.test(
      q
    )
  ) {
    setChangeFeedFilter("high-risk");
    navigateToTab("overview");
    return "Recent changes now shows HIGH risk only.";
  }

  if (
    /\bshow all changes\b|\ball changes\b|\bclear (the )?filter\b|\bshow everything\b/.test(
      q
    )
  ) {
    setChangeFeedFilter("all");
    navigateToTab("overview");
    return "Showing all changes again.";
  }

  if (/\bcompare\b/.test(q)) {
    setChangeFeedFilter("all");
    navigateToTab("overview");
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
    navigateToTab("overview");
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
      navigateToTab("overview");
      return `Unknown column for missing values: "${colToken}".`;
    }
    const sc =
      statChanges.find(
        (s) => s.columnKey === key && s.drillKind === "null_increase"
      ) ||
      statChanges.find((s) => s.columnKey === key && s.tier === "HIGH");
    if (!sc) {
      navigateToTab("overview");
      return `No null-increase drill-down for "${colToken}" in this comparison.`;
    }
    setSelectedChange(sc);
    setFeedFocusColumnKey(key);
    navigateToTab("overview");
    triggerDrillNavigation(sc);
    return `Opened drill-down for rows with missing ${colToken}.`;
  }

  return null;
}

function analyzeDatasetDiff(
  previousData,
  currentData,
  columns,
  schemaColumnPair = null
) {
  const summaryBullets = [];
  const riskFindings = [];

  let schemaChanges = [];
  if (schemaColumnPair?.previous && schemaColumnPair?.current) {
    schemaChanges = detectSchemaChanges(
      schemaColumnPair.previous,
      schemaColumnPair.current
    );
  }

  if (currentData.length === 0 || columns.length === 0) {
    return {
      summaryParagraph:
        "Upload a current CSV (with a header and at least one row) to build the grid and run comparison.",
      summaryBullets: [],
      riskFindings: [],
      schemaChanges,
    };
  }

  if (previousData.length === 0) {
    return {
      summaryParagraph:
        "Upload a previous CSV as baseline, or use the sample pair, to compare null rates, distinct counts, value churn, and risks.",
      summaryBullets: [],
      riskFindings: [],
      schemaChanges,
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

  return { summaryParagraph, summaryBullets, riskFindings, schemaChanges };
}

/** First column whose key looks like a stable row identifier. */
function findIdentifierColumnKey(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const idLike =
    /\b(id|key|code|uuid|guid)\b|(^|_)(id|key|code|nr|num)(_|$)/i;
  for (const c of columns) {
    const k = String(c.key ?? "");
    if (idLike.test(k)) return c.key;
  }
  return null;
}

function cellEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return String(a) === String(b);
}

/**
 * Row-level diff: new rows, removed rows, value changes (per column examples).
 * With an identifier column: match by that value. Otherwise align by row index
 * (tail rows = added/removed; same index = candidate for value change).
 */
function analyzeRowLevelDiff(previousData, currentData, columns) {
  const empty = {
    newRows: { count: 0, examples: [] },
    removedRows: { count: 0, examples: [] },
    changedValues: { count: 0, byColumn: {} },
    mode: "none",
    idKey: null,
  };
  if (!Array.isArray(previousData) || !Array.isArray(currentData)) return empty;
  if (!columns?.length) return { ...empty, mode: "no-columns" };

  const colKeys = columns.map((c) => c.key);
  const idKey = findIdentifierColumnKey(columns);

  if (idKey != null) {
    const prevMap = new Map();
    const currMap = new Map();
    previousData.forEach((row) => {
      const v = row?.[idKey];
      if (v === null || v === undefined || v === "") return;
      prevMap.set(String(v), row);
    });
    currentData.forEach((row) => {
      const v = row?.[idKey];
      if (v === null || v === undefined || v === "") return;
      currMap.set(String(v), row);
    });

    const newExamples = [];
    let newCount = 0;
    for (const [, row] of currMap) {
      const id = String(row[idKey]);
      if (!prevMap.has(id)) {
        newCount++;
        if (newExamples.length < 3) newExamples.push(row);
      }
    }

    const remExamples = [];
    let remCount = 0;
    for (const [, row] of prevMap) {
      const id = String(row[idKey]);
      if (!currMap.has(id)) {
        remCount++;
        if (remExamples.length < 3) remExamples.push(row);
      }
    }

    const byColumn = {};
    const changedIds = new Set();
    for (const id of currMap.keys()) {
      if (!prevMap.has(id)) continue;
      const a = prevMap.get(id);
      const b = currMap.get(id);
      let rowChanged = false;
      for (const ck of colKeys) {
        if (!cellEqual(a?.[ck], b?.[ck])) {
          rowChanged = true;
          if (!byColumn[ck]) byColumn[ck] = { count: 0, examples: [] };
          byColumn[ck].count++;
          if (byColumn[ck].examples.length < 3) {
            byColumn[ck].examples.push({
              before: a?.[ck] ?? "",
              after: b?.[ck] ?? "",
            });
          }
        }
      }
      if (rowChanged) changedIds.add(id);
    }

    return {
      newRows: { count: newCount, examples: newExamples },
      removedRows: { count: remCount, examples: remExamples },
      changedValues: { count: changedIds.size, byColumn },
      mode: "id",
      idKey,
    };
  }

  const n = Math.min(previousData.length, currentData.length);
  const byColumnIdx = {};
  let changedRows = 0;
  for (let i = 0; i < n; i++) {
    const a = previousData[i];
    const b = currentData[i];
    let rowChanged = false;
    for (const ck of colKeys) {
      if (!cellEqual(a?.[ck], b?.[ck])) {
        rowChanged = true;
        if (!byColumnIdx[ck]) byColumnIdx[ck] = { count: 0, examples: [] };
        byColumnIdx[ck].count++;
        if (byColumnIdx[ck].examples.length < 3) {
          byColumnIdx[ck].examples.push({
            before: a?.[ck] ?? "",
            after: b?.[ck] ?? "",
          });
        }
      }
    }
    if (rowChanged) changedRows++;
  }
  const newCount = Math.max(0, currentData.length - previousData.length);
  const newExamples = currentData.slice(
    previousData.length,
    previousData.length + 3
  );
  const remCount = Math.max(0, previousData.length - currentData.length);
  const remExamples = previousData.slice(
    currentData.length,
    currentData.length + 3
  );

  return {
    newRows: { count: newCount, examples: newExamples },
    removedRows: { count: remCount, examples: remExamples },
    changedValues: { count: changedRows, byColumn: byColumnIdx },
    mode: "index",
    idKey: null,
  };
}

function stableRowFingerprint(row, columnKeys) {
  const o = {};
  for (const k of columnKeys) {
    o[k] = row?.[k] ?? null;
  }
  return JSON.stringify(o);
}

/**
 * Data Explorer diff: same id vs. index contract as {@link analyzeRowLevelDiff}.
 */
function buildDataExplorerDiffRows(previousData, currentData, columns) {
  const out = [];
  if (!Array.isArray(previousData) || !Array.isArray(currentData) || !columns?.length) {
    return out;
  }
  const colKeys = columns.map((c) => c.key);
  const idKey = findIdentifierColumnKey(columns);
  if (idKey != null) {
    const prevMap = new Map();
    for (const row of previousData) {
      const v = row?.[idKey];
      if (v == null || v === "") continue;
      prevMap.set(String(v), row);
    }
    const currMap = new Map();
    for (const row of currentData) {
      const v = row?.[idKey];
      if (v == null || v === "") continue;
      currMap.set(String(v), row);
    }
    for (let i = 0; i < currentData.length; i++) {
      const row = currentData[i];
      const v = row?.[idKey];
      if (v == null || v === "") {
        const p = previousData[i];
        if (p === undefined) {
          out.push({ kind: "new", prev: null, curr: row, key: `cidx-${i}` });
        } else {
          const ch = colKeys.some((k) => !cellEqual(p?.[k], row?.[k]));
          out.push({
            kind: ch ? "changed" : "unchanged",
            prev: p,
            curr: row,
            key: `bidx-${i}`,
          });
        }
        continue;
      }
      const id = String(v);
      if (!prevMap.has(id)) {
        out.push({ kind: "new", prev: null, curr: row, key: `n-${id}` });
      } else {
        const p = prevMap.get(id);
        const ch = colKeys.some((k) => !cellEqual(p?.[k], row?.[k]));
        out.push({
          kind: ch ? "changed" : "unchanged",
          prev: p,
          curr: row,
          key: `m-${id}`,
        });
      }
    }
    for (const row of previousData) {
      const v = row?.[idKey];
      if (v == null || v === "") continue;
      if (!currMap.has(String(v))) {
        out.push({ kind: "removed", prev: row, curr: null, key: `r-${String(v)}` });
      }
    }
    for (let i = currentData.length; i < previousData.length; i++) {
      const p = previousData[i];
      const v = p?.[idKey];
      if (v == null || v === "") {
        out.push({ kind: "removed", prev: p, curr: null, key: `t-${i}` });
      }
    }
    return out;
  }
  const m = Math.min(previousData.length, currentData.length);
  for (let i = 0; i < m; i++) {
    const p = previousData[i];
    const c = currentData[i];
    const ch = colKeys.some((k) => !cellEqual(p?.[k], c?.[k]));
    out.push({
      kind: ch ? "changed" : "unchanged",
      prev: p,
      curr: c,
      key: `ix-${i}`,
    });
  }
  for (let i = m; i < currentData.length; i++) {
    out.push({ kind: "new", prev: null, curr: currentData[i], key: `ixn-${i}` });
  }
  for (let i = m; i < previousData.length; i++) {
    out.push({
      kind: "removed",
      prev: previousData[i],
      curr: null,
      key: `ixr-${i}`,
    });
  }
  return out;
}

/**
 * Data Explorer panel (Overview): current / previous / diff tables.
 */
function DataExplorerPanel({
  open,
  explorerTitle,
  explorerTab,
  onSetTab,
  onClose,
  currentData,
  previousData,
  columnKeys,
  diffRows,
}) {
  if (!open) return null;
  const tableShellStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
  };
  const thStyle = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#1a1a1a",
    color: "#888",
    padding: "8px 12px",
    borderBottom: "1px solid #2a2a2a",
    textAlign: "left",
    fontSize: "11px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };
  const tdStyle = {
    padding: "6px 12px",
    borderBottom: "1px solid #1a1a1a",
    color: "#e0e0e0",
    fontSize: "13px",
  };
  const rowNew = {
    background: "rgba(34, 197, 94, 0.08)",
    borderLeft: "3px solid #22c55e",
  };
  const rowDel = {
    background: "rgba(239, 68, 68, 0.08)",
    borderLeft: "3px solid #ef4444",
  };
  const rowCh = {
    background: "rgba(245, 158, 11, 0.08)",
    borderLeft: "3px solid #f59e0b",
  };

  const nRows =
    explorerTab === "current"
      ? currentData.length
      : explorerTab === "previous"
        ? previousData.length
        : diffRows.length;
  const nCols = columnKeys.length;
  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => onSetTab(id)}
      style={{
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        borderRadius: "6px",
        border: `1px solid ${explorerTab === id ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
        background: explorerTab === id ? "rgba(59, 130, 246, 0.15)" : "rgba(0,0,0,0.2)",
        color: explorerTab === id ? "#93c5fd" : "var(--text)",
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const simpleTable = (data, mode) => (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <table style={tableShellStyle}>
        <thead>
          <tr>
            {columnKeys.map((col) => (
              <th key={String(col)} style={thStyle}>
                {String(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(1, columnKeys.length)}
                style={{ ...tdStyle, color: "#888", fontStyle: "italic" }}
              >
                No rows.
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={mode + "-" + i}
                style={{
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#151515";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                {columnKeys.map((col) => {
                  const v = row?.[col];
                  const isNull = v == null || v === undefined;
                  const isEmpty = v === "";
                  return (
                    <td
                      key={String(col) + i}
                      style={{
                        ...tdStyle,
                        color: isNull || isEmpty ? "#666" : "inherit",
                        fontStyle: isNull ? "italic" : "normal",
                      }}
                    >
                      {isNull ? "NULL" : v}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: "100%",
        margin: "0 auto 20px",
        width: "100%",
        maxHeight: "400px",
        display: "flex",
        flexDirection: "column",
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          borderBottom: "1px solid #1a1a1a",
          background: "rgba(0,0,0,0.35)",
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--text-h)",
              marginBottom: "2px",
            }}
          >
            {explorerTitle}
          </div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>
            {nRows} rows · {nCols} columns
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {tabBtn("current", "Current")}
          {tabBtn("previous", "Previous")}
          {tabBtn("diff", "Diff")}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Data Explorer"
            style={{
              marginLeft: "6px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--text-h)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div style={{ padding: 0, flex: 1, minHeight: 0, overflow: "auto" }}>
        {explorerTab === "current" ? (
          simpleTable(currentData, "c")
        ) : explorerTab === "previous" ? (
          simpleTable(previousData, "p")
        ) : diffRows.length === 0 ? (
          <p
            style={{ margin: "12px 14px", color: "#888", fontSize: "13px" }}
          >
            No diff: load baseline and current snapshots, or the datasets are
            identical in structure.
          </p>
        ) : (
          <div style={{ minWidth: 0, width: "100%" }}>
              <table style={tableShellStyle}>
                <thead>
                  <tr>
                    {columnKeys.map((col) => (
                      <th key={String(col) + "d"} style={thStyle}>
                        {String(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((dr) => {
                    const rowSt =
                      dr.kind === "new"
                        ? rowNew
                        : dr.kind === "removed"
                          ? rowDel
                          : dr.kind === "changed"
                            ? rowCh
                            : { borderLeft: "3px solid transparent" };
                    return (
                      <tr
                        key={dr.key}
                        style={{
                          ...rowSt,
                          transition: "background 0.1s",
                        }}
                      >
                        {columnKeys.map((col) => {
                          if (dr.kind === "removed") {
                            const v = dr.prev?.[col];
                            const isN = v == null || v === undefined;
                            const isE = v === "";
                            return (
                              <td
                                key={String(col) + "rm"}
                                style={{
                                  ...tdStyle,
                                  color: isN || isE ? "#666" : "inherit",
                                  fontStyle: isN ? "italic" : "normal",
                                }}
                              >
                                {isN ? "NULL" : v}
                              </td>
                            );
                          }
                          const o = dr.prev?.[col];
                          const c = dr.curr?.[col];
                          if (dr.kind === "new" || dr.kind === "unchanged") {
                            const isN = c == null || c === undefined;
                            const isE = c === "";
                            return (
                              <td
                                key={String(col) + "n"}
                                style={{
                                  ...tdStyle,
                                  color: isN || isE ? "#666" : "inherit",
                                  fontStyle: isN ? "italic" : "normal",
                                }}
                              >
                                {isN ? "NULL" : c}
                              </td>
                            );
                          }
                          if (dr.kind === "changed" && !cellEqual(o, c)) {
                            const fmt = (x) => {
                              if (x == null || x === undefined) return "NULL";
                              if (x === "") return "∅";
                              return String(x);
                            };
                            return (
                              <td key={String(col) + "ch"} style={tdStyle}>
                                <span style={{ color: "#9ca3af" }}>{fmt(o)}</span>
                                <span style={{ color: "#6b7280" }}> → </span>
                                <span style={{ color: "#d97706", fontWeight: 600 }}>
                                  {fmt(c === undefined ? null : c)}
                                </span>
                              </td>
                            );
                          }
                          const isN2 = c == null || c === undefined;
                          const isE2 = c === "";
                          return (
                            <td
                              key={String(col) + "eq"}
                              style={{
                                ...tdStyle,
                                color: isN2 || isE2 ? "#666" : "inherit",
                                fontStyle: isN2 ? "italic" : "normal",
                              }}
                            >
                              {isN2 ? "NULL" : c}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Data quality heuristics on current snapshot (and nulls use current).
 */
function analyzeDataQualityIssues(_previousData, currentData, columns) {
  const issues = [];
  if (!columns?.length || !Array.isArray(currentData) || currentData.length === 0) {
    return issues;
  }

  for (const col of columns) {
    const pctNum = parsePercent(calculateNullPercentage(currentData, col.key));
    if (pctNum > 0) {
      const nulls = currentData.filter(
        (r) =>
          r[col.key] === null ||
          r[col.key] === undefined ||
          r[col.key] === ""
      ).length;
      issues.push({
        id: `dq-missing-${col.key}`,
        kind: "missing",
        severity: pctNum >= 20 ? "high" : "medium",
        columnKey: col.key,
        columnLabel: col.label,
        nullCount: nulls,
        nullPctLabel: calculateNullPercentage(currentData, col.key),
        message: `${col.label}: ${nulls} missing values (${calculateNullPercentage(currentData, col.key)})`,
      });
    }
  }

  for (const col of columns) {
    const rawVals = currentData
      .map((r) => r[col.key])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    const values = [...new Set(rawVals.map((v) => String(v)))];
    if (values.length < 2) continue;

    const byLower = new Map();
    for (const v of values) {
      const L = v.toLowerCase();
      if (!byLower.has(L)) byLower.set(L, new Set());
      byLower.get(L).add(v);
    }
    for (const [, set] of byLower) {
      if (set.size > 1) {
        const ex = [...set].slice(0, 2);
        issues.push({
          id: `dq-case-${col.key}`,
          kind: "format_case",
          severity: "medium",
          columnKey: col.key,
          columnLabel: col.label,
          message: `${col.label}: inconsistent formatting detected`,
          examples: [`e.g. '${ex[0]}' and '${ex[1]}' in same column`],
        });
        break;
      }
    }

    const isoLike = /^\d{4}-\d{2}-\d{2}/;
    const dmyLike = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/;
    let hasIso = false;
    let hasDmy = false;
    for (const v of values) {
      if (isoLike.test(v)) hasIso = true;
      if (dmyLike.test(v)) hasDmy = true;
    }
    if (hasIso && hasDmy) {
      issues.push({
        id: `dq-date-${col.key}`,
        kind: "format_date",
        severity: "medium",
        columnKey: col.key,
        columnLabel: col.label,
        message: `${col.label}: inconsistent formatting detected`,
        examples: ["e.g. ISO dates (2024-01-01) and dotted dates (01.01.2024)"],
      });
    }

    let hasCommaThousands = false;
    let hasPlainLongNumber = false;
    for (const v of values) {
      if (/\d,\d{3}\b/.test(v)) hasCommaThousands = true;
      if (/^\d{4,}$/.test(v.replace(/\s/g, ""))) hasPlainLongNumber = true;
    }
    if (hasCommaThousands && hasPlainLongNumber) {
      issues.push({
        id: `dq-num-${col.key}`,
        kind: "format_number",
        severity: "medium",
        columnKey: col.key,
        columnLabel: col.label,
        message: `${col.label}: inconsistent formatting detected`,
        examples: ["e.g. '1,000' vs '1000' style numbers"],
      });
    }
  }

  const colKeys = columns.map((c) => c.key);
  const seen = new Map();
  for (const row of currentData) {
    const fp = stableRowFingerprint(row, colKeys);
    seen.set(fp, (seen.get(fp) ?? 0) + 1);
  }
  let duplicateExtra = 0;
  for (const c of seen.values()) {
    if (c > 1) duplicateExtra += c - 1;
  }
  if (duplicateExtra > 0) {
    issues.push({
      id: "dq-dup-rows",
      kind: "duplicate_rows",
      severity: duplicateExtra >= 5 ? "high" : "medium",
      columnKey: null,
      columnLabel: null,
      duplicateExtra,
      message: `${duplicateExtra} duplicate row${duplicateExtra === 1 ? "" : "s"} detected`,
    });
  }

  return issues;
}

function RowDiffMiniTable({ rows, columns, maxCols = 5 }) {
  if (!rows?.length) return null;
  const keys = (columns ?? []).slice(0, maxCols).map((c) => c.key);
  if (!keys.length) return null;
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "11px",
        marginTop: "10px",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        overflow: "hidden",
        background: "var(--code-bg)",
      }}
    >
      <thead>
        <tr>
          {keys.map((k) => (
            <th
              key={k}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderBottom: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              {(columns ?? []).find((c) => c.key === k)?.label ?? k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {keys.map((k) => (
              <td
                key={k}
                style={{
                  padding: "6px 8px",
                  borderTop: "1px solid var(--border)",
                  color: "var(--text)",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={String(row?.[k] ?? "")}
              >
                {String(row?.[k] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function rowDiffForClaudePayload(rowLevelDiff, qualityIssues) {
  return {
    newRowCount: rowLevelDiff.newRows.count,
    removedRowCount: rowLevelDiff.removedRows.count,
    changedValueCount: rowLevelDiff.changedValues.count,
    diffMode: rowLevelDiff.mode,
    idKey: rowLevelDiff.idKey ?? null,
    qualityIssues: (qualityIssues ?? []).slice(0, 20).map((q) => ({
      kind: q.kind,
      severity: q.severity,
      message: q.message,
    })),
  };
}

const demoUsers = [
  {
    name: "Jonne",
    role: "Admin",
    permissions: [
      "Connect data sources",
      "View sample data",
      "Use AI Assistant",
      "Manage users",
    ],
  },
  {
    name: "Anna",
    role: "Analyst",
    permissions: [
      "View sample data",
      "Use AI Assistant",
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
  {
    id: "4",
    text: 'Anna asked AI Assistant: "What changed?"',
    when: "18 min ago",
  },
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

function isContractCellEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function parseOneOfList(raw) {
  return String(raw ?? "")
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function contractColumnLabel(columns, key) {
  if (key === "_row_count") return "Row count";
  return columns.find((c) => c.key === key)?.label ?? key;
}

/** @returns {{ contractId: string, column: string, severity: string, message: string, affectedRows: number }[]} */
function evaluateContracts(contracts, previousData, currentData, columns) {
  const violations = [];
  if (!contracts?.length || !currentData.length || !columns.length) {
    return violations;
  }
  const colKeys = new Set(columns.map((c) => c.key));

  for (const c of contracts) {
    const contractId = String(c.id ?? "");
    const severity = String(c.severity ?? "warning").toLowerCase();
    const rule = c.rule;
    const label = (c.label ?? "Contract").trim();

    if (rule === "no_drop_pct" || rule === "no_increase_pct") {
      const threshold = parsePercent(c.value ?? "0");
      const prevLen = previousData.length;
      const curLen = currentData.length;
      if (prevLen <= 0) continue;
      if (rule === "no_drop_pct") {
        if (curLen < prevLen) {
          const dropPct = ((prevLen - curLen) / prevLen) * 100;
          if (dropPct > threshold) {
            violations.push({
              contractId,
              column: "_row_count",
              severity,
              message: `${label} — row count dropped about ${dropPct.toFixed(1)}% (${prevLen} → ${curLen}); allowed max drop ${threshold}%.`,
              affectedRows: prevLen - curLen,
            });
          }
        }
      } else if (curLen > prevLen) {
        const incPct = ((curLen - prevLen) / prevLen) * 100;
        if (incPct > threshold) {
          violations.push({
            contractId,
            column: "_row_count",
            severity,
            message: `${label} — row count rose about ${incPct.toFixed(1)}% (${prevLen} → ${curLen}); allowed max increase ${threshold}%.`,
            affectedRows: curLen - prevLen,
          });
        }
      }
      continue;
    }

    const keysForNotNullAny =
      c.column === "*" || c.column === "__any__"
        ? columns.map((co) => co.key)
        : null;

    if (rule === "not_null" && keysForNotNullAny) {
      for (const key of keysForNotNullAny) {
        const badRows = [];
        for (let i = 0; i < currentData.length; i++) {
          if (isContractCellEmpty(currentData[i][key])) badRows.push(i + 1);
        }
        if (badRows.length) {
          const colLabel = contractColumnLabel(columns, key);
          violations.push({
            contractId,
            column: key,
            severity,
            message: `${colLabel} must not be null — ${badRows.length} row(s) with empty values (e.g. row ${badRows[0]}).`,
            affectedRows: badRows.length,
          });
        }
      }
      continue;
    }

    if (!c.column || c.column === "*" || !colKeys.has(c.column)) continue;
    const colKey = c.column;

    if (rule === "not_null") {
      const badRows = [];
      for (let i = 0; i < currentData.length; i++) {
        if (isContractCellEmpty(currentData[i][colKey])) badRows.push(i + 1);
      }
      if (badRows.length) {
        const colLabel = contractColumnLabel(columns, colKey);
        violations.push({
          contractId,
          column: colKey,
          severity,
          message: `${colLabel} must not be null — ${badRows.length} row(s) (e.g. row ${badRows[0]}).`,
          affectedRows: badRows.length,
        });
      }
      continue;
    }

    if (rule === "must_be_unique") {
      const counts = new Map();
      const firstRow = new Map();
      for (let i = 0; i < currentData.length; i++) {
        const v = currentData[i][colKey];
        if (isContractCellEmpty(v)) continue;
        const k = String(v);
        counts.set(k, (counts.get(k) ?? 0) + 1);
        if (!firstRow.has(k)) firstRow.set(k, i + 1);
      }
      let dupRows = 0;
      const examples = [];
      for (const [val, cnt] of counts) {
        if (cnt > 1) {
          dupRows += cnt;
          if (examples.length < 3) examples.push(`"${val}" (${cnt}×)`);
        }
      }
      if (dupRows > 0) {
        const colLabel = contractColumnLabel(columns, colKey);
        violations.push({
          contractId,
          column: colKey,
          severity,
          message: `${colLabel} must be unique — duplicate values: ${examples.join(", ")}.`,
          affectedRows: dupRows,
        });
      }
      continue;
    }

    if (rule === "one_of") {
      const allowed = new Set(
        parseOneOfList(c.value).map((s) => s.toLowerCase())
      );
      if (!allowed.size) continue;
      const badRows = [];
      const badSamples = new Set();
      for (let i = 0; i < currentData.length; i++) {
        const raw = currentData[i][colKey];
        if (isContractCellEmpty(raw)) continue;
        const norm = String(raw).trim().toLowerCase();
        if (!allowed.has(norm)) {
          badRows.push(i + 1);
          if (badSamples.size < 4) badSamples.add(String(raw).trim());
        }
      }
      if (badRows.length) {
        const colLabel = contractColumnLabel(columns, colKey);
        const samples = [...badSamples].join(", ");
        violations.push({
          contractId,
          column: colKey,
          severity,
          message: `${colLabel} must be one of allowed values — ${badRows.length} row(s) with unexpected value(s): ${samples}.`,
          affectedRows: badRows.length,
        });
      }
      continue;
    }

    if (rule === "greater_than") {
      const threshold = Number.parseFloat(String(c.value ?? "").trim());
      if (!Number.isFinite(threshold)) continue;
      const badRows = [];
      for (let i = 0; i < currentData.length; i++) {
        const n = Number.parseFloat(currentData[i][colKey]);
        if (Number.isFinite(n) && n <= threshold) badRows.push(i + 1);
      }
      if (badRows.length) {
        const colLabel = contractColumnLabel(columns, colKey);
        violations.push({
          contractId,
          column: colKey,
          severity,
          message: `${colLabel} must be greater than ${threshold} — ${badRows.length} row(s) fail (e.g. row ${badRows[0]}).`,
          affectedRows: badRows.length,
        });
      }
      continue;
    }

    if (rule === "less_than") {
      const threshold = Number.parseFloat(String(c.value ?? "").trim());
      if (!Number.isFinite(threshold)) continue;
      const badRows = [];
      for (let i = 0; i < currentData.length; i++) {
        const n = Number.parseFloat(currentData[i][colKey]);
        if (Number.isFinite(n) && n >= threshold) badRows.push(i + 1);
      }
      if (badRows.length) {
        const colLabel = contractColumnLabel(columns, colKey);
        violations.push({
          contractId,
          column: colKey,
          severity,
          message: `${colLabel} must be less than ${threshold} — ${badRows.length} row(s) fail (e.g. row ${badRows[0]}).`,
          affectedRows: badRows.length,
        });
      }
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  violations.sort(
    (a, b) =>
      (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) ||
      String(a.column).localeCompare(String(b.column))
  );
  return violations;
}

function detectChatIntent(raw) {
  const q = raw.trim().toLowerCase();
  if (!q) return "empty";

  if (
    /\bcontract violations?\b/.test(q) ||
    /\bcheck contracts\b/.test(q) ||
    /\b(which|any) contracts? (failed|failing)\b/.test(q) ||
    (/\bcontracts?\b/.test(q) && /\bviolat/.test(q))
  ) {
    return "contracts";
  }

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
    "data contracts / violations",
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

function chatAnswerContracts(ctx) {
  const defs = ctx.contracts?.length ?? 0;
  if (!defs) {
    return [
      "Data contracts",
      "",
      "• No rules defined yet — open the Contracts tab to review expectations.",
    ].join("\n");
  }
  if (!ctx.currentData?.length) {
    return [
      "Data contracts",
      "",
      "• Rules are on file, but there is no current snapshot loaded — open Sources and load data to evaluate.",
    ].join("\n");
  }
  const v = ctx.contractViolations ?? [];
  if (!v.length) {
    return [
      "Data contracts",
      "",
      `• All ${defs} contract rule(s) passed on the loaded current data.`,
    ].join("\n");
  }
  const lines = v.slice(0, 12).map(
    (x) =>
      `[${String(x.severity).toUpperCase()}] ${x.message} (affected rows: ${x.affectedRows})`
  );
  if (v.length > 12) lines.push(`…+${v.length - 12} more`);
  return ["Data contract violations", "", chatBullets(lines)].join("\n");
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
    case "contracts":
      return chatAnswerContracts(ctx);
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
  boxShadow: "none",
  fontSize: "15px",
  lineHeight: 1.45,
  color: "var(--text)",
};

const CHAT_SUGGESTION_ROWS = [
  [
    {
      id: "connect-sf",
      label: "Connect Snowflake",
      prompt: "Connect to the Snowflake demo and open Sources.",
    },
    {
      id: "load-customers",
      label: "Load customers table",
      prompt: "Load the customers table from Snowflake.",
    },
    {
      id: "high-risk",
      label: "Show high risk only",
      prompt: "Show only high risk changes on Overview.",
    },
    {
      id: "what-changed",
      label: "What changed?",
      prompt: "What changed?",
    },
  ],
  [
    {
      id: "team-summary",
      label: "Summarize for my team",
      prompt: "Summarize for my team",
    },
    {
      id: "null-5",
      label: "Set null threshold to 5%",
      prompt: "Set the null rate increase threshold to 5%.",
    },
    {
      id: "go-settings",
      label: "Go to settings",
      prompt: "Go to settings",
    },
    {
      id: "disconnect",
      label: "Disconnect",
      prompt: "Disconnect and clear loaded data",
    },
  ],
];

const chatSuggestionButtonStyle = {
  padding: "8px 12px",
  fontSize: "13px",
  fontFamily: "inherit",
  lineHeight: 1.3,
  borderRadius: "8px",
  border: "1px solid #333333",
  background: "#111111",
  color: "#777777",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
};

const authInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid #2f2f2f",
  fontSize: "15px",
  fontFamily: "inherit",
  background: "#0f0f0f",
  color: "#ffffff",
};

const authLabelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-h)",
  marginBottom: "14px",
};

function navTabStyle(isActive, isHovered) {
  return {
    padding: "8px 14px",
    borderRadius: "8px",
    border: isActive ? "1px solid #2f2f2f" : "1px solid transparent",
    background: isActive || isHovered ? "#111111" : "transparent",
    color: isActive ? "#ffffff" : isHovered ? "#999999" : "#666666",
    boxShadow: isActive ? "0 0 12px rgba(124, 58, 237, 0.15)" : "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: isActive ? 600 : 500,
    fontFamily: "inherit",
    lineHeight: 1.2,
    transition:
      "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
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
  marginBottom: 0,
  paddingBottom: "160px",
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

const securityPageWrapStyle = {
  maxWidth: "700px",
  marginLeft: "auto",
  marginRight: "auto",
  marginBottom: 0,
  textAlign: "left",
  padding: "0 20px 160px",
  boxSizing: "border-box",
};

const securitySectionCardStyle = {
  padding: "20px 22px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--social-bg)",
  marginBottom: "20px",
};

const overviewHelpSectionStyle = {
  maxWidth: "44rem",
  marginLeft: "auto",
  marginRight: "auto",
  marginTop: "40px",
  paddingTop: "32px",
  paddingBottom: "160px",
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

function SourcesWarehouseSecurityChecklistCard() {
  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "12px 14px 12px 16px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        borderLeft: "3px solid rgba(34, 197, 94, 0.45)",
        background: "var(--code-bg)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-h)",
          marginBottom: "8px",
          lineHeight: 1.3,
        }}
      >
        How Unlockdb accesses your data
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: "none",
          fontSize: "13px",
          lineHeight: 1.45,
          color: "var(--text)",
        }}
      >
        <li style={{ marginBottom: "4px" }}>
          ✅ Read-only access — we cannot modify your data
        </li>
        <li style={{ marginBottom: "4px" }}>
          ✅ Credentials never stored by Unlockdb
        </li>
        <li style={{ marginBottom: "4px" }}>
          ✅ Raw data never leaves your warehouse
        </li>
        <li style={{ marginBottom: "4px" }}>
          ✅ Claude AI sees statistics only, not actual values
        </li>
        <li>✅ TLS encryption for all connections</li>
      </ul>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathTab = tabIdFromPathname(location.pathname);

  const navigateToTab = useCallback(
    (tabId) => {
      const p = TAB_TO_PATH[tabId];
      if (p != null) navigate(p);
    },
    [navigate]
  );

  const [previousData, setPreviousData] = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const [previousFileName, setPreviousFileName] = useState("Not connected");
  const [currentFileName, setCurrentFileName] = useState("Not connected");
  const [messages, setMessages] = useState([]);
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
  const [snowflakeWarehouseDataLoaded, setSnowflakeWarehouseDataLoaded] =
    useState(false);
  const [snowflakeWarehouseTableDisplay, setSnowflakeWarehouseTableDisplay] =
    useState(null);
  const [databricksWarehouseTableDisplay, setDatabricksWarehouseTableDisplay] =
    useState(null);
  const [activeSourceName, setActiveSourceName] = useState(null);
  const [tableBrowserSource, setTableBrowserSource] = useState(null);
  const [tableBrowserList, setTableBrowserList] = useState([]);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableBrowserAiNameTipId, setTableBrowserAiNameTipId] = useState(null);
  const [tableBrowserRowHoverKey, setTableBrowserRowHoverKey] =
    useState(null);
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
  const chatEndStickyRef = useRef(null);
  const copilotSubmitGuardRef = useRef(false);
  const [feedFocusColumnKey, setFeedFocusColumnKey] = useState(null);
  const [selectedChange, setSelectedChange] = useState(null);
  const [changeFeedFilter, setChangeFeedFilter] = useState("all");
  const [overviewKey, setOverviewKey] = useState(0);
  const [showDataExplorer, setShowDataExplorer] = useState(false);
  const [explorerTab, setExplorerTab] = useState("current");
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotHistoryExpanded, setCopilotHistoryExpanded] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(String(message ?? ""));
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);
  const [contracts, setContracts] = useState([
    {
      id: "1",
      column: "email",
      rule: "not_null",
      value: null,
      severity: "critical",
      label: "Email must not be null",
    },
    {
      id: "2",
      column: "country",
      rule: "one_of",
      value: "FI, SE, NO, DK",
      severity: "warning",
      label: "Country must be one of: FI, SE, NO, DK",
    },
    {
      id: "3",
      column: "_row_count",
      rule: "no_drop_pct",
      value: "10",
      severity: "critical",
      label: "Row count must not drop by more than 10%",
    },
  ]);
  const [history, setHistory] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [overviewTrustBannerDismissed, setOverviewTrustBannerDismissed] =
    useState(false);
  const [aiAnalysisPrivacyTipVisible, setAiAnalysisPrivacyTipVisible] =
    useState(false);
  const drillDownRef = useRef(null);
  const [gridSearchQuery, setGridSearchQuery] = useState("");
  const [gridFilterColumnKey, setGridFilterColumnKey] = useState("");
  const [gridFilterValue, setGridFilterValue] = useState("");
  const [problemRowsOnly, setProblemRowsOnly] = useState(false);
  const [columnDetailKey, setColumnDetailKey] = useState(null);
  const [explainStatChange, setExplainStatChange] = useState(null);
  const [explainClaudeLoading, setExplainClaudeLoading] = useState(false);
  const [explainMergedPayload, setExplainMergedPayload] = useState(null);
  const [autoAnalysis, setAutoAnalysis] = useState(null);
  const [feedCardHoverId, setFeedCardHoverId] = useState(null);
  const [tableBrowserViewMode, setTableBrowserViewMode] = useState("list");
  const [sqlInvestigateById, setSqlInvestigateById] = useState({});
  const [sqlInvestigateLoadingId, setSqlInvestigateLoadingId] = useState(null);
  const [sqlCopiedChangeId, setSqlCopiedChangeId] = useState(null);
  const sqlCopiedTimerRef = useRef(null);
  const [nullRateIncreaseThreshold, setNullRateIncreaseThreshold] =
    useState(5);
  const [distinctValueChangeThreshold, setDistinctValueChangeThreshold] =
    useState(10);
  const [rowCountChangeThreshold, setRowCountChangeThreshold] = useState(20);
  const [settingsTableSensitivity, setSettingsTableSensitivity] = useState(
    () => ({ ...DEFAULT_SETTINGS_TABLE_SENSITIVITY })
  );
  const [acknowledgedChangeIds, setAcknowledgedChangeIds] = useState([]);
  const [acknowledgedChangeEntries, setAcknowledgedChangeEntries] = useState(
    []
  );
  const [settingsSavedMessageVisible, setSettingsSavedMessageVisible] =
    useState(false);
  const [markKnownMessage, setMarkKnownMessage] = useState(null);
  const settingsSaveMessageTimerRef = useRef(null);
  const markKnownMessageTimerRef = useRef(null);

  const columns = useMemo(
    () => buildColumnsFromCurrentOnly(currentData),
    [currentData]
  );
  const dataExplorerColumnKeys = useMemo(
    () => columns.map((c) => c.key),
    [columns]
  );
  const explorerDiffRows = useMemo(
    () => buildDataExplorerDiffRows(previousData, currentData, columns),
    [previousData, currentData, columns]
  );
  const dataExplorerTitle = useMemo(() => {
    if (
      activeSourceName === "snowflake" &&
      String(snowflakeWarehouseTableDisplay ?? "").trim()
    ) {
      return `Data Explorer — ${String(snowflakeWarehouseTableDisplay).trim()}`;
    }
    if (
      activeSourceName === "databricks" &&
      String(databricksWarehouseTableDisplay ?? "").trim()
    ) {
      return `Data Explorer — ${String(
        databricksWarehouseTableDisplay
      ).trim()}`;
    }
    if (
      String(currentFileName ?? "").trim() &&
      currentFileName !== "Not connected"
    ) {
      return `Data Explorer — ${String(currentFileName).trim()}`;
    }
    if (String(previousFileName ?? "").includes(".csv")) {
      return "Data Explorer — uploaded CSV";
    }
    return "Data Explorer — current snapshot";
  }, [
    activeSourceName,
    snowflakeWarehouseTableDisplay,
    databricksWarehouseTableDisplay,
    currentFileName,
    previousFileName,
  ]);

  const insights = useMemo(
    () => columnInsights(currentData, columns),
    [currentData, columns]
  );

  const schemaColumnPairForDiff = useMemo(() => {
    if (
      activeSourceName === "snowflake" &&
      String(snowflakeWarehouseTableDisplay ?? "")
        .trim()
        .toLowerCase() === "customers"
    ) {
      return {
        previous: SNOWFLAKE_DEMO_PREVIOUS_SCHEMA.customers,
        current: SNOWFLAKE_DEMO_CURRENT_SCHEMA.customers,
      };
    }
    return null;
  }, [activeSourceName, snowflakeWarehouseTableDisplay]);

  const diffAnalysis = useMemo(
    () =>
      analyzeDatasetDiff(
        previousData,
        currentData,
        columns,
        schemaColumnPairForDiff
      ),
    [previousData, currentData, columns, schemaColumnPairForDiff]
  );

  const {
    summaryParagraph: diffSummaryParagraph,
    summaryBullets: diffSummaryBullets,
    riskFindings,
    schemaChanges = [],
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
  const activeAlertSettingsTableId = resolveActiveDemoTableIdForAlertSettings(
    selectedSource,
    databricksDemoConnected,
    snowflakeWarehouseTableDisplay,
    databricksWarehouseTableDisplay
  );
  const activeTableSensitivityForAlerts =
    settingsTableSensitivity[activeAlertSettingsTableId] ?? "normal";
  const statChangesAfterAckAndAlerts = useMemo(() => {
    const ack = new Set(acknowledgedChangeIds);
    const out = [];
    for (const sc of statChanges) {
      if (ack.has(sc.id)) continue;
      const adj = adjustStatChangeForUserAlertSettings(sc, {
        nullThresholdPts: nullRateIncreaseThreshold,
        sensitivityMode: activeTableSensitivityForAlerts,
      });
      if (adj) out.push(adj);
    }
    return out;
  }, [
    statChanges,
    acknowledgedChangeIds,
    nullRateIncreaseThreshold,
    activeTableSensitivityForAlerts,
  ]);
  const displayStatChangesForFeed = useMemo(() => {
    if (changeFeedFilter === "high-risk") {
      return statChangesAfterAckAndAlerts.filter((s) => s.tier === "HIGH");
    }
    return statChangesAfterAckAndAlerts;
  }, [statChangesAfterAckAndAlerts, changeFeedFilter]);
  const impactLines = useMemo(
    () =>
      buildAggregatedImpactLines(riskFindings, diffSummaryBullets, columns),
    [riskFindings, diffSummaryBullets, columns]
  );
  const tableBrowserFiltered = useMemo(() => {
    const q = tableSearchQuery.trim().toLowerCase();
    if (!q) return tableBrowserList;
    return tableBrowserList.filter((t) =>
      String(t.name ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [tableBrowserList, tableSearchQuery]);

  const tableBrowserSummary = useMemo(() => {
    const list = tableBrowserList;
    const withChanges = list.filter((t) => t.hasChanges).length;
    const highRisk = list.filter((t) => t.riskLevel === "high").length;
    return { total: list.length, withChanges, highRisk };
  }, [tableBrowserList]);
  const overviewHasData = currentData.length > 0 && columns.length > 0;
  const rowLevelDiff = useMemo(
    () => analyzeRowLevelDiff(previousData, currentData, columns),
    [previousData, currentData, columns]
  );
  const dataQualityIssues = useMemo(
    () => analyzeDataQualityIssues(previousData, currentData, columns),
    [previousData, currentData, columns]
  );
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

  const explainBasePayload = useMemo(() => {
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

  const contractViolationList = useMemo(
    () => evaluateContracts(contracts, previousData, currentData, columns),
    [contracts, previousData, currentData, columns]
  );

  const renderContractTableBadge = useCallback(
    (tblName) => {
      if (!contracts.length) return null;
      const warehouseKey =
        activeSourceName === "snowflake"
          ? "snowflake"
          : activeSourceName === "databricks"
            ? "databricks"
            : null;
      if (!warehouseKey) return null;
      const isActive =
        overviewHasData &&
        ((warehouseKey === "snowflake" &&
          activeSourceName === "snowflake" &&
          snowflakeWarehouseTableDisplay === tblName) ||
          (warehouseKey === "databricks" &&
            activeSourceName === "databricks" &&
            databricksWarehouseTableDisplay === tblName));
      if (!isActive) return null;
      const n = contractViolationList.length;
      const base = {
        fontSize: "10px",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: "6px",
        whiteSpace: "nowrap",
      };
      if (n > 0) {
        return (
          <span
            style={{
              ...base,
              border: "1px solid var(--risk-high-border)",
              background: "var(--risk-high-bg)",
              color: "var(--risk-high)",
            }}
          >
            📋 {n} contract violation{n === 1 ? "" : "s"}
          </span>
        );
      }
      return (
        <span
          style={{
            ...base,
            border: "1px solid rgba(34, 197, 94, 0.35)",
            background: "rgba(34, 197, 94, 0.08)",
            color: "#86efac",
          }}
        >
          📋 ✅ Contracts OK
        </span>
      );
    },
    [
      contracts.length,
      overviewHasData,
      activeSourceName,
      snowflakeWarehouseTableDisplay,
      databricksWarehouseTableDisplay,
      contractViolationList.length,
    ]
  );

  const chatContext = {
    previousData,
    currentData,
    columns,
    insights,
    diffSummaryBullets,
    diffSummaryParagraph,
    riskFindings,
    rowLevelDiff,
    dataQualityIssues,
    contracts,
    contractViolations: contractViolationList,
  };

  const chatContextRef = useRef(chatContext);
  useEffect(() => {
    chatContextRef.current = chatContext;
  }, [chatContext]);

  useEffect(() => {
    chatEndStickyRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setDismissed(false);
    setFeedCardHoverId(null);
    setAcknowledgedChangeIds([]);
    setAcknowledgedChangeEntries([]);
    setAutoAnalysis(null);
  }, [previousFileName, currentFileName, previousData.length, currentData.length]);

  useEffect(() => {
    if (pathTab === null) return;
    if (pathTab !== "overview") {
      setColumnDetailKey(null);
      setExplainStatChange(null);
    }
  }, [pathTab]);

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
    if (!explainStatChange) {
      setExplainClaudeLoading(false);
      setExplainMergedPayload(null);
    }
  }, [explainStatChange]);

  useEffect(() => {
    if (!explainStatChange) return;
    let cancelled = false;
    const base = buildAiExplainForStatChange(
      explainStatChange,
      riskFindings
    );
    (async () => {
      try {
        const drillSlice = getDrillDownRows(
          explainStatChange,
          previousData,
          currentData
        ).slice(0, 5);
        const ctx = {
          ...buildExplainClaudeContext(
            explainStatChange,
            previousData,
            currentData,
            drillSlice
          ),
          rowDiffSummary: rowDiffForClaudePayload(
            rowLevelDiff,
            dataQualityIssues
          ),
        };
        const prompt =
          String(explainStatChange.changeText ?? "").trim() || base.title;
        const result = await askClaude(prompt, ctx);
        if (cancelled) return;
        if (typeof result === "string") {
          setExplainMergedPayload(base);
        } else if (result && typeof result === "object") {
          setExplainMergedPayload({
            ...base,
            whatChanged: String(result.whatChanged ?? base.whatChanged),
            impact: String(result.impact ?? base.impact),
            likelyCause: String(result.likelyCause ?? base.likelyCause),
            suggestedAction: String(
              result.suggestedAction ?? base.suggestedAction
            ),
          });
        } else {
          setExplainMergedPayload(base);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setExplainMergedPayload(
            buildAiExplainForStatChange(explainStatChange, riskFindings)
          );
        }
      } finally {
        if (!cancelled) setExplainClaudeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    explainStatChange,
    riskFindings,
    previousData,
    currentData,
    rowLevelDiff,
    dataQualityIssues,
  ]);

  useEffect(() => {
    if (previousData.length === 0 || currentData.length === 0) {
      setAutoAnalysis(null);
      return;
    }
    const sc = statChanges.find((s) => s.tier === "HIGH");
    if (!sc) {
      setAutoAnalysis(null);
      return;
    }
    let cancelled = false;
    const tid = window.setTimeout(() => {
      (async () => {
        try {
          const drillSlice = getDrillDownRows(
            sc,
            previousData,
            currentData
          ).slice(0, 5);
          const ctx = {
            ...buildExplainClaudeContext(
              sc,
              previousData,
              currentData,
              drillSlice
            ),
            rowDiffSummary: rowDiffForClaudePayload(
              rowLevelDiff,
              dataQualityIssues
            ),
          };
          const prompt = String(sc.changeText ?? "").trim();
          const result = await askClaude(prompt || "High-risk data change", ctx);
          if (cancelled) return;
          if (typeof result === "string") {
            setAutoAnalysis(result);
          } else if (typeof result === "object" && result != null) {
            setAutoAnalysis({
              whatChanged: String(result.whatChanged ?? ""),
              impact: String(result.impact ?? ""),
              likelyCause: String(result.likelyCause ?? ""),
              suggestedAction: String(result.suggestedAction ?? ""),
            });
          }
        } catch (e) {
          console.error(e);
        }
      })();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [
    previousFileName,
    currentFileName,
    previousData.length,
    currentData.length,
    firstHighStatChange?.id,
    firstHighStatChange?.changeText,
    previousData,
    currentData,
    statChanges,
    rowLevelDiff,
    dataQualityIssues,
  ]);

  useEffect(() => {
    return () => {
      if (settingsSaveMessageTimerRef.current) {
        window.clearTimeout(settingsSaveMessageTimerRef.current);
      }
      if (markKnownMessageTimerRef.current) {
        window.clearTimeout(markKnownMessageTimerRef.current);
      }
    };
  }, []);

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
      onRows(rows, headerKeys.length);
    };
    reader.onerror = () => window.alert("Could not read the file.");
    reader.readAsText(file);
  }

  function resetTableBrowserState() {
    setTableBrowserSource(null);
    setTableBrowserList([]);
    setTableSearchQuery("");
    setTableBrowserAiNameTipId(null);
    setTableBrowserRowHoverKey(null);
  }

  function resetSnowflakeWarehouseBrowserState() {
    setSnowflakeWarehouseDataLoaded(false);
    setSnowflakeWarehouseTableDisplay(null);
    setTableBrowserRowHoverKey(null);
  }

  function handlePreviousCsvSelected(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    readCsvFile(file, (rows) => {
      setSnowflakeDemoConnected(false);
      setDatabricksDemoConnected(false);
      resetSnowflakeWarehouseBrowserState();
      resetTableBrowserState();
      setDatabricksWarehouseTableDisplay(null);
      setActiveSourceName("csv");
      setPreviousData(rows);
      setPreviousFileName(file.name);
      input.value = "";
    });
  }

  function handleCurrentCsvSelected(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    readCsvFile(file, (rows, columnCount) => {
      setSnowflakeDemoConnected(false);
      setDatabricksDemoConnected(false);
      resetSnowflakeWarehouseBrowserState();
      resetTableBrowserState();
      setDatabricksWarehouseTableDisplay(null);
      setActiveSourceName("csv");
      setCurrentData(rows);
      setCurrentFileName(file.name);
      input.value = "";
    });
  }

  function handleResetCsvFiles() {
    setPreviousData([]);
    setCurrentData([]);
    setPreviousFileName("Not connected");
    setCurrentFileName("Not connected");
    setSnowflakeDemoConnected(false);
    setDatabricksDemoConnected(false);
    resetSnowflakeWarehouseBrowserState();
    resetTableBrowserState();
    setDatabricksWarehouseTableDisplay(null);
    setActiveSourceName("csv");
    setSelectedSource("csv");
  }

  function handleUseSampleDataset() {
    setSnowflakeDemoConnected(false);
    setDatabricksDemoConnected(false);
    setSnowflakeWarehouseDataLoaded(false);
    setSnowflakeWarehouseTableDisplay(null);
    setDatabricksWarehouseTableDisplay(null);
    resetTableBrowserState();
    setActiveSourceName("csv");
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
      resetSnowflakeWarehouseBrowserState();
    }
    if (id !== "databricks") {
      setDatabricksDemoConnected(false);
      setDatabricksWarehouseTableDisplay(null);
    }
    resetTableBrowserState();
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
      resetSnowflakeWarehouseBrowserState();
      setDatabricksWarehouseTableDisplay(null);
      setActiveSourceName(null);
      setPreviousData([]);
      setCurrentData([]);
      setPreviousFileName("Snowflake · select a table");
      setCurrentFileName("Snowflake · select a table");
      setTableBrowserSource("snowflake");
      setTableBrowserList([...SNOWFLAKE_TABLE_BROWSER]);
      setTableSearchQuery("");
      setTableBrowserAiNameTipId(null);
    }, 1000);
  }

  function handleSnowflakeDemoConnect(e) {
    e.preventDefault();
    runSnowflakeDemoDataset();
    navigateToTab("sources");
  }

  function loadDemoForWarehouseTable(tableName, warehouseSource) {
    setTableBrowserAiNameTipId(null);
    const isSnowflake = warehouseSource === "snowflake";
    if (isSnowflake) {
      setSnowflakeDemoConnected(true);
      setDatabricksDemoConnected(false);
      setDatabricksWarehouseTableDisplay(null);
      setSelectedSource("snowflake");
      setSnowflakeWarehouseDataLoaded(true);
      setSnowflakeWarehouseTableDisplay(tableName);
      setActiveSourceName("snowflake");
    } else {
      setDatabricksDemoConnected(true);
      setSnowflakeDemoConnected(false);
      setSnowflakeWarehouseDataLoaded(false);
      setSnowflakeWarehouseTableDisplay(null);
      setDatabricksWarehouseTableDisplay(tableName);
      setSelectedSource("databricks");
      setActiveSourceName("databricks");
    }
    if (tableName === "events") {
      setPreviousData(DATABRICKS_DEMO_PREVIOUS);
      setCurrentData(DATABRICKS_DEMO_CURRENT);
    } else {
      setPreviousData(SNOWFLAKE_DEMO_PREVIOUS);
      setCurrentData(SNOWFLAKE_DEMO_CURRENT);
    }
    const labelPrefix = isSnowflake ? "Snowflake" : "Databricks";
    setPreviousFileName(`${labelPrefix} · ${tableName} (baseline)`);
    setCurrentFileName(`${labelPrefix} · ${tableName} (current)`);
    navigateToTab("overview");
  }

  function loadSnowflakeWarehouseCleanCustomersNoDiff() {
    const snapshot = SNOWFLAKE_DEMO_CURRENT.map((row) => ({ ...row }));
    setActiveSourceName("snowflake");
    setSnowflakeWarehouseDataLoaded(true);
    setSnowflakeWarehouseTableDisplay("customers");
    setPreviousData(snapshot.map((row) => ({ ...row })));
    setCurrentData(snapshot.map((row) => ({ ...row })));
    setPreviousFileName("Snowflake · customers (baseline)");
    setCurrentFileName("Snowflake · customers (current)");
    navigateToTab("overview");
  }

  function runDatabricksDemoDataset() {
    if (databricksConnecting) return;
    setDatabricksConnecting(true);
    window.setTimeout(() => {
      setDatabricksConnecting(false);
      setDatabricksDemoConnected(true);
      setSnowflakeDemoConnected(false);
      resetSnowflakeWarehouseBrowserState();
      setDatabricksWarehouseTableDisplay(null);
      setActiveSourceName(null);
      setPreviousData([]);
      setCurrentData([]);
      setPreviousFileName("Databricks · select a table");
      setCurrentFileName("Databricks · select a table");
      setTableBrowserSource("databricks");
      setTableBrowserList([...DATABRICKS_TABLE_BROWSER]);
      setTableSearchQuery("");
      setTableBrowserAiNameTipId(null);
    }, 1000);
  }

  function handleDatabricksDemoConnect(e) {
    e.preventDefault();
    runDatabricksDemoDataset();
    navigateToTab("sources");
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

  function handleOpenAiExplainPanel(statChange) {
    setExplainStatChange(statChange);
    setExplainClaudeLoading(true);
    setExplainMergedPayload(null);
  }

  async function handleGetInvestigationSql(sc) {
    const tableForPrompt =
      activeSourceName === "snowflake"
        ? "customers"
        : activeSourceName === "databricks"
          ? databricksWarehouseTableDisplay ?? "events"
          : "customers";
    const prompt = `Generate a Snowflake SQL query to investigate this issue: ${sc.changeText}
Table: ${tableForPrompt}
Return ONLY the SQL, no explanation.`;
    setSqlInvestigateLoadingId(sc.id);
    try {
      const raw = await askClaude(prompt, "", {
        mode: "chat",
        systemPrompt: SQL_INVESTIGATION_SYSTEM,
        maxTokens: 1200,
        plainPrompt: true,
      });
      let out = String(raw ?? "").trim();
      if (!out) {
        out = "-- Set VITE_ANTHROPIC_API_KEY to generate SQL from Claude.";
      } else {
        const fenced = /^```(?:sql)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(
          out
        );
        if (fenced) out = fenced[1].trim();
      }
      setSqlInvestigateById((prev) => ({ ...prev, [sc.id]: out }));
    } catch (e) {
      console.error(e);
      setSqlInvestigateById((prev) => ({
        ...prev,
        [sc.id]: `-- ${String(e?.message ?? e)}`,
      }));
    } finally {
      setSqlInvestigateLoadingId(null);
    }
  }

  function handleCopyInvestigationSql(changeId, text) {
    const t = String(text ?? "");
    if (!t || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(t).then(() => {
      if (sqlCopiedTimerRef.current) {
        window.clearTimeout(sqlCopiedTimerRef.current);
      }
      setSqlCopiedChangeId(changeId);
      sqlCopiedTimerRef.current = window.setTimeout(() => {
        setSqlCopiedChangeId(null);
        sqlCopiedTimerRef.current = null;
      }, 2000);
    });
  }

  function executeAppAction(action) {
    console.log("[executeAppAction] incoming", action);
    if (action == null || typeof action !== "object") return;
    let t0 = action.type;
    if ((t0 == null || t0 === "") && action.Type != null) {
      t0 = action.Type;
    }
    if (t0 == null || t0 === "") {
      console.warn("[executeAppAction] missing action.type, skipping");
      return;
    }
    const type =
      typeof t0 === "string"
        ? t0.trim().toUpperCase().replace(/[\s-]+/g, "_")
        : t0;
    switch (type) {
      case "NAVIGATE": {
        const tab = action.tab;
        if (tab && TAB_TO_PATH[tab]) navigateToTab(tab);
        break;
      }
      case "CONNECT_SNOWFLAKE":
        selectDataSource("snowflake");
        runSnowflakeDemoDataset();
        navigateToTab("sources");
        break;
      case "CONNECT_DATABRICKS":
        selectDataSource("databricks");
        runDatabricksDemoDataset();
        navigateToTab("sources");
        break;
      case "LOAD_TABLE": {
        const raw = action.tableName;
        if (raw == null || String(raw).trim() === "") break;
        const name = String(raw).trim();
        const n = name.toLowerCase();
        const sf = SNOWFLAKE_TABLE_BROWSER.find(
          (t) => t.name.toLowerCase() === n
        );
        const dbx = DATABRICKS_TABLE_BROWSER.find(
          (t) => t.name.toLowerCase() === n
        );
        if (sf) {
          selectDataSource("snowflake");
          if (!snowflakeDemoConnected) {
            runSnowflakeDemoDataset();
            window.setTimeout(() => {
              loadDemoForWarehouseTable(sf.name, "snowflake");
            }, 1200);
          } else {
            loadDemoForWarehouseTable(sf.name, "snowflake");
          }
          navigateToTab("overview");
          window.scrollTo({ top: 0, behavior: "smooth" });
          break;
        }
        if (dbx) {
          selectDataSource("databricks");
          if (!databricksDemoConnected) {
            runDatabricksDemoDataset();
            window.setTimeout(() => {
              loadDemoForWarehouseTable(dbx.name, "databricks");
            }, 1200);
          } else {
            loadDemoForWarehouseTable(dbx.name, "databricks");
          }
          navigateToTab("overview");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        break;
      }
      case "FILTER_HIGH_RISK":
      case "SHOW_HIGH_RISK_ONLY":
        setChangeFeedFilter("high-risk");
        navigateToTab("overview");
        break;
      case "FILTER_ALL":
        setChangeFeedFilter("all");
        navigateToTab("overview");
        break;
      case "UPDATE_SETTING": {
        const s = action.setting;
        const v = Number(action.value);
        if (Number.isFinite(v)) {
          if (s === "nullThreshold") {
            setNullRateIncreaseThreshold(v);
          } else if (s === "rowCountThreshold") {
            setRowCountChangeThreshold(v);
          }
        }
        navigateToTab("settings");
        break;
      }
      case "SUMMARIZE":
        navigateToTab("overview");
        break;
      case "UPLOAD_CSV":
        if (selectedSource !== "csv") {
          selectDataSource("csv");
        }
        setActiveSourceName("csv");
        navigateToTab("sources");
        break;
      case "SHOW_TABLE_DATA":
      case "SHOW_TABLE":
        setShowDataExplorer(true);
        setExplorerTab("current");
        navigateToTab("overview");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "SHOW_DIFF":
        setShowDataExplorer(true);
        setExplorerTab("diff");
        navigateToTab("overview");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "DISCONNECT":
        setPreviousData([]);
        setCurrentData([]);
        setPreviousFileName("Not connected");
        setCurrentFileName("Not connected");
        setSnowflakeDemoConnected(false);
        setDatabricksDemoConnected(false);
        resetSnowflakeWarehouseBrowserState();
        resetTableBrowserState();
        setDatabricksWarehouseTableDisplay(null);
        setActiveSourceName("csv");
        setSelectedSource("csv");
        navigateToTab("sources");
        break;
      default:
        break;
    }
    setOverviewKey((prev) => prev + 1);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }

  function sendChatMessage(text) {
    console.log("SEND:", text);
    const trimmed = text.trim();
    if (!trimmed) return;
    setCopilotHistoryExpanded(true);
    let handledCommandReply = null;
    try {
      handledCommandReply = tryHandleCopilotCommand(trimmed, {
        columns,
        statChanges,
        riskFindings,
        overviewHasData,
        navigateToTab,
        setChangeFeedFilter,
        setSelectedChange,
        setSelectedColumn,
        setFeedFocusColumnKey,
        selectDataSource,
        selectedSource,
        runSnowflakeDemoDataset,
        triggerDrillNavigation,
      });
    } catch (e) {
      console.error("tryHandleCopilotCommand failed:", e);
      handledCommandReply = null;
    }
    const base = ++chatMessageIdRef.current;
    const assistantId = `${base}-a`;
    setMessages((prev) => [
      ...prev,
      { id: `${base}-u`, role: "user", text: trimmed },
      {
        id: assistantId,
        role: "assistant",
        text: "Analyzing...",
        pending: true,
        analyzing: true,
      },
    ]);
    (async () => {
      let finalText = "";
      const ctx = chatContextRef.current;
      try {
        const sourceLabel = buildCopilotSourceLabel(
          selectedSource,
          snowflakeDemoConnected,
          databricksDemoConnected,
          snowflakeWarehouseTableDisplay,
          databricksWarehouseTableDisplay
        );
        const tableLabel = buildCopilotTableLabel(
          selectedSource,
          snowflakeDemoConnected,
          databricksDemoConnected,
          snowflakeWarehouseTableDisplay,
          databricksWarehouseTableDisplay
        );
        const workspaceSummary = buildWorkspaceSummaryForClaude(
          tableBrowserSource,
          tableBrowserList
        );
        const packed = buildCopilotContextPack(ctx, {
          sourceLabel,
          tableLabel,
          impactLines,
          deterministicActionReply: handledCommandReply,
          workspaceSummary,
        });
        const context = buildAppContext();
        const copilotSystemPrompt = `${UNLOCKDB_COPILOT_ACTION_SYSTEM}\n\n${context}`;
        let replyFromClaudeApi = false;
        try {
          finalText = await claudeChatReply(trimmed, packed, {
            systemPrompt: copilotSystemPrompt,
            maxTokens: 1200,
          });
          if (!finalText) {
            throw new Error("empty claude reply");
          }
          replyFromClaudeApi = true;
        } catch (e) {
          console.error(e);
          try {
            finalText =
              handledCommandReply ?? chatReply(trimmed, ctx);
          } catch (e2) {
            console.error("chatReply failed:", e2);
            finalText =
              typeof handledCommandReply === "string"
                ? handledCommandReply
                : "";
          }
        }
        finalText = String(finalText ?? "").trim();
        if (!finalText) {
          finalText =
            "No reply received. Check your connection and API setup, then try again.";
        } else if (replyFromClaudeApi) {
          const claudeResponse = finalText;
          // Get Claude's response text
          const rawResponse = claudeResponse;
          console.log("Claude raw response:", rawResponse);

          // Try to parse as JSON
          let parsed = null;
          try {
            const cleaned = rawResponse
              .replace(/```json/gi, "")
              .replace(/```/g, "")
              .trim();
            const jsonSlice =
              extractFirstBalancedJsonObject(cleaned) ?? cleaned;
            parsed = JSON.parse(jsonSlice);
            console.log("Parsed successfully:", parsed);
          } catch (e) {
            console.log("Not JSON, showing as text");
            parsed = null;
          }

          const responseText = parsed
            ? parsed.response ?? parsed.Response
            : undefined;

          if (parsed && (responseText != null && String(responseText) !== "")) {
            finalText = String(responseText);
            if (parsed.action && parsed.action.type) {
              console.log("Executing action:", parsed.action);
              try {
                executeAppAction(parsed.action);
                showToast("✓ " + (finalText || "Done"));
              } catch (err) {
                console.error("executeAppAction failed:", err);
              }
            }
          } else if (parsed && parsed.action && parsed.action.type) {
            finalText = "Done.";
            console.log("Executing action:", parsed.action);
            try {
              executeAppAction(parsed.action);
              showToast("✓ " + finalText);
            } catch (err) {
              console.error("executeAppAction failed:", err);
            }
          } else {
            finalText = rawResponse;
          }
        }
      } catch (e) {
        console.error("sendChatMessage reply pipeline failed:", e);
        let fb = "";
        try {
          fb =
            typeof handledCommandReply === "string" && handledCommandReply.trim()
              ? handledCommandReply
              : chatReply(trimmed, ctx);
        } catch (e2) {
          console.error("chatReply fallback failed:", e2);
          fb =
            typeof handledCommandReply === "string"
              ? handledCommandReply
              : "";
        }
        finalText =
          String(fb ?? "").trim() ||
          "Something went wrong. Try again, or check the browser console for details.";
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: finalText,
                pending: false,
                analyzing: false,
              }
            : m
        )
      );
    })();
  }

  function handleCopilotSend(e) {
    setCopilotHistoryExpanded(true);
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (copilotSubmitGuardRef.current) return;
    copilotSubmitGuardRef.current = true;
    try {
      sendChatMessage(copilotInput);
      setCopilotInput("");
    } finally {
      window.queueMicrotask(() => {
        copilotSubmitGuardRef.current = false;
      });
    }
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

  function handleSaveAlertSettings() {
    if (settingsSaveMessageTimerRef.current) {
      window.clearTimeout(settingsSaveMessageTimerRef.current);
    }
    setSettingsSavedMessageVisible(true);
    settingsSaveMessageTimerRef.current = window.setTimeout(() => {
      setSettingsSavedMessageVisible(false);
      settingsSaveMessageTimerRef.current = null;
    }, 2600);
  }

  function handleMarkChangeAsKnown(sc) {
    setAcknowledgedChangeIds((prev) =>
      prev.includes(sc.id) ? prev : [...prev, sc.id]
    );
    setAcknowledgedChangeEntries((prev) => {
      if (prev.some((e) => e.id === sc.id)) return prev;
      return [
        ...prev,
        {
          id: sc.id,
          changeText: sc.changeText,
          at: new Date().toLocaleString(),
        },
      ];
    });
    if (selectedChange?.id === sc.id) {
      setSelectedChange(null);
    }
    if (explainStatChange?.id === sc.id) {
      setExplainStatChange(null);
    }
    if (markKnownMessageTimerRef.current) {
      window.clearTimeout(markKnownMessageTimerRef.current);
    }
    setMarkKnownMessage("Marked as known. Won't alert on this again.");
    markKnownMessageTimerRef.current = window.setTimeout(() => {
      setMarkKnownMessage(null);
      markKnownMessageTimerRef.current = null;
    }, 3200);
  }

  function handleClearAllAcknowledgedChanges() {
    setAcknowledgedChangeIds([]);
    setAcknowledgedChangeEntries([]);
  }

  const navTabs = [
    { id: "overview", label: "Overview" },
    { id: "about", label: "How it works" },
    { id: "sources", label: "Sources" },
    { id: "governance", label: "Governance" },
    { id: "settings", label: "Settings" },
    { id: "security", label: "🔒 Security" },
    { id: "contracts", label: "Contracts" },
    { id: "audit", label: "Audit" },
    {
      id: "account",
      label: demoLoggedIn ? "Account" : "Login / Account",
    },
  ];

  function buildAppContext() {
    const dataLoaded =
      currentData.length > 0
        ? `Yes — ${currentData.length} current rows, ${previousData.length} baseline (previous) rows`
        : "No data loaded yet";
    const tablesBlock =
      tableBrowserList.length > 0
        ? tableBrowserList
            .map(
              (t) =>
                `${t.name} (${t.riskLevel ?? "?"} risk, ${
                  t.changeCount ?? 0
                } changes)`
            )
            .join("\n")
        : "No tables loaded";
    return `
UNLOCKDB APP STATE:

Navigation tabs available:
${navTabs.map((t) => t.label).join(", ")}
Current route tab: ${pathTab != null ? pathTab : "—"}
Selected data source mode: ${String(selectedSource ?? "none")} (e.g. csv, snowflake, databricks in the UI)
Overview change feed filter: ${
      changeFeedFilter === "high-risk" ? "high risk only" : "all"
    }
Table browser (warehouse) context: ${
      tableBrowserSource
        ? `${tableBrowserSource} — ${
            tableBrowserList.length
          } table(s) in the browser list below`
        : "not open / no list"
    }

Data source status:
${
  snowflakeDemoConnected
    ? "Snowflake: CONNECTED (demo)"
    : "Snowflake: not connected"
}
${
  databricksDemoConnected
    ? "Databricks: CONNECTED (demo)"
    : "Databricks: not connected"
}

Data loaded:
${dataLoaded}

Tables available (if connected; use exact names for LOAD_TABLE):
${tablesBlock}

Current settings:
- Null threshold: ${Number.isFinite(nullRateIncreaseThreshold) ? nullRateIncreaseThreshold : 5}%
- Row count threshold: ${Number.isFinite(rowCountChangeThreshold) ? rowCountChangeThreshold : 20}%

Features available in this app:
1. CSV UPLOAD: Sources tab → CSV (demo) button
   → User uploads two CSV files (baseline + current)
   → App compares them automatically
   → Works with any CSV data

2. SNOWFLAKE DEMO: Sources → Snowflake → Connect
   → Loads realistic demo data
   → 20 demo tables available

3. DATABRICKS DEMO: Sources → Databricks → Connect
   → Loads events demo data

4. TABLE BROWSER: After connecting
   → Browse and click any of 20 tables
   → List view or Heatmap view

5. AI ANALYSIS: Auto-runs when data loads
   → Shows what changed and why
   → Explains business impact

6. SQL GENERATOR: Click any change card
   → "Get SQL" button generates query
   → Copy and run in Snowflake

7. DATA CONTRACTS: Contracts tab
   → Define rules: email not null, etc.
   → Auto-checks on data load

8. SETTINGS: Settings tab
   → Null threshold, row count threshold
   → Table sensitivity per table

9. SECURITY: Security tab
   → Privacy policy and data handling

10. GOVERNANCE: Governance tab
    → Users, roles, permissions demo

11. AUDIT: Audit tab
    → Change log and audit trail

AVAILABLE AI ACTIONS (execute only with JSON; types must match exactly):
- NAVIGATE: { "type": "NAVIGATE", "tab": "overview"|"about"|"sources"|"settings"|"security"|"governance"|"audit"|"contracts"|"account" }
- CONNECT_SNOWFLAKE: { "type": "CONNECT_SNOWFLAKE" }
- CONNECT_DATABRICKS: { "type": "CONNECT_DATABRICKS" }
- LOAD_TABLE: { "type": "LOAD_TABLE", "tableName": "<name from table browser or demo list>" }
- FILTER_HIGH_RISK: { "type": "FILTER_HIGH_RISK" }  (or SHOW_HIGH_RISK_ONLY, same effect)
- FILTER_ALL: { "type": "FILTER_ALL" }
- UPDATE_SETTING: { "type": "UPDATE_SETTING", "setting": "nullThreshold"|"rowCountThreshold", "value": <number> }
- SUMMARIZE: { "type": "SUMMARIZE" }
- DISCONNECT: { "type": "DISCONNECT" }
- UPLOAD_CSV: { "type": "UPLOAD_CSV" } — navigates to Sources and selects the CSV uploader
- SHOW_TABLE_DATA: { "type": "SHOW_TABLE_DATA" } — opens the Data Explorer panel (Current snapshot table); "SHOW_TABLE" is accepted as an alias
- SHOW_DIFF: { "type": "SHOW_DIFF" } — opens the Data Explorer on the Diff view (new / changed / removed rows)

When user asks about CSV:
→ Explain they can upload two CSV files
→ Execute UPLOAD_CSV (or NAVIGATE to "sources" if UPLOAD_CSV is unavailable on client)
→ Tell them to use the "CSV (demo)" flow in Sources
`.trim();
  }

  if (pathTab === null) {
    return <Navigate to="/" replace />;
  }
  const activeTab = pathTab;

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {toast ? (
        <div
          style={{
            position: "fixed",
            top: "80px",
            right: "20px",
            background: "var(--accent)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            zIndex: 9999,
            animation: "fadeIn 0.2s ease",
            maxWidth: "min(90vw, 24rem)",
            lineHeight: 1.4,
            textAlign: "left",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
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
            onClick={() => navigateToTab("overview")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginRight: "8px",
              padding: "4px 8px 4px 4px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <UnlockdbLogo />
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: "#ffffff",
                  fontSize: "16px",
                  letterSpacing: "-0.02em",
                }}
              >
                Unlockdb
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "#555555",
                  letterSpacing: "0.05em",
                  fontWeight: 500,
                  marginTop: "2px",
                }}
              >
                data change intelligence
              </span>
            </span>
          </button>
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              id={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => navigateToTab(tab.id)}
              onMouseEnter={() => setNavHover(tab.id)}
              onMouseLeave={() => setNavHover(null)}
              style={{
                ...navTabStyle(activeTab === tab.id, navHover === tab.id),
                ...(tab.id === "security"
                  ? { position: "relative", paddingRight: "20px" }
                  : {}),
              }}
            >
              {tab.label}
              {tab.id === "security" ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "10px",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 0 1px var(--bg)",
                  }}
                />
              ) : null}
            </button>
          ))}
        </div>
        {activeTab === "overview" &&
        overviewHasData &&
        highRiskCount > 0 &&
        !dismissed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              padding: "10px 20px",
              borderBottom: "1px solid rgba(239, 68, 68, 0.2)",
              background: "rgba(239, 68, 68, 0.08)",
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
              className="app-ghost-btn"
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "6px",
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
          padding: "24px 20px calc(48px + 140px)",
          maxWidth: "1126px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {activeTab === "overview" && (
          <section
            key={overviewKey}
            style={{
              width: "100%",
            }}
          >
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
                  onClick={() => navigateToTab("sources")}
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

            {showDataExplorer ? (
              <div
                style={{
                  maxWidth: "44rem",
                  width: "100%",
                  margin: "0 auto 20px",
                  boxSizing: "border-box",
                }}
              >
                <DataExplorerPanel
                  open
                  explorerTitle={dataExplorerTitle}
                  explorerTab={explorerTab}
                  onSetTab={setExplorerTab}
                  onClose={() => setShowDataExplorer(false)}
                  currentData={currentData}
                  previousData={previousData}
                  columnKeys={dataExplorerColumnKeys}
                  diffRows={explorerDiffRows}
                />
              </div>
            ) : null}

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
                    onClick={() => navigateToTab("sources")}
                    style={{
                      padding: "10px 22px",
                      borderRadius: "8px",
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
                      onClick={() => navigateToTab("sources")}
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
                <div
                  style={{
                    maxWidth: "44rem",
                    margin: "0 auto 18px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(148px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {[
                    {
                      label: "Tables monitored",
                      value: DEMO_TABLES_MONITORED,
                      sub: "↑ 2 this week",
                      border: "var(--border)",
                      numColor: "#ffffff",
                    },
                    {
                      label: "Changes detected",
                      value: statChanges.length,
                      sub: null,
                      border:
                        statChanges.length > 0
                          ? "rgba(245, 158, 11, 0.45)"
                          : "var(--border)",
                      numColor:
                        statChanges.length > 0 ? "#f59e0b" : "#ffffff",
                    },
                    {
                      label: "High risk",
                      value: highRiskCount,
                      sub: null,
                      border:
                        highRiskCount > 0
                          ? "rgba(239, 68, 68, 0.45)"
                          : "rgba(34, 197, 94, 0.35)",
                      numColor: highRiskCount > 0 ? "#ef4444" : "#22c55e",
                    },
                    {
                      label: "Schema changes",
                      value: schemaChanges.length,
                      sub: null,
                      border:
                        schemaChanges.length > 0
                          ? "var(--accent-border)"
                          : "var(--border)",
                      numColor:
                        schemaChanges.length > 0
                          ? "var(--accent)"
                          : "#ffffff",
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        borderLeft: `3px solid ${card.border}`,
                        background: "#111111",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: 700,
                          color: card.numColor,
                          lineHeight: 1.1,
                          marginBottom: "6px",
                        }}
                      >
                        {card.value}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          lineHeight: 1.35,
                        }}
                      >
                        {card.label}
                      </div>
                      {card.sub ? (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            color: "var(--text)",
                            opacity: 0.85,
                          }}
                        >
                          {card.sub}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {activeSourceName === "snowflake" ? (
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
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-h)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span>
                        <span style={{ color: "var(--text)" }}>Source: </span>
                        Snowflake demo
                        <span
                          style={{ margin: "0 8px", color: "var(--border)" }}
                        >
                          ·
                        </span>
                        <span style={{ color: "var(--text)" }}>Table: </span>
                        {snowflakeWarehouseTableDisplay ?? "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("current");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "12px",
                        }}
                      >
                        📊 Show data
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("diff");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "8px",
                        }}
                      >
                        🔀 Show diff
                      </button>
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
                        {snowflakeWarehouseTableDisplay ?? "—"}
                      </div>
                    </div>
                  </div>
                ) : activeSourceName === "databricks" ? (
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
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-h)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span>
                        <span style={{ color: "var(--text)" }}>Source: </span>
                        Databricks demo
                        <span
                          style={{ margin: "0 8px", color: "var(--border)" }}
                        >
                          ·
                        </span>
                        <span style={{ color: "var(--text)" }}>Table: </span>
                        {databricksWarehouseTableDisplay ?? "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("current");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "12px",
                        }}
                      >
                        📊 Show data
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("diff");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "8px",
                        }}
                      >
                        🔀 Show diff
                      </button>
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
                        {databricksWarehouseTableDisplay ?? "—"}
                      </div>
                    </div>
                  </div>
                ) : activeSourceName === "csv" ? (
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
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-h)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span>
                        <span style={{ color: "var(--text)" }}>Source: </span>
                        CSV upload
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("current");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "12px",
                        }}
                      >
                        📊 Show data
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDataExplorer(true);
                          setExplorerTab("diff");
                        }}
                        style={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          color: "#888",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          marginLeft: "8px",
                        }}
                      >
                        🔀 Show diff
                      </button>
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

                {schemaChanges.length > 0 ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 16px",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      borderLeft: "4px solid var(--accent)",
                      background: "var(--social-bg)",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--text-h)",
                        marginBottom: "10px",
                      }}
                    >
                      ⚡ Schema changes detected
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontSize: "13px",
                        fontFamily: "var(--mono, ui-monospace, monospace)",
                        marginBottom: "10px",
                      }}
                    >
                      {schemaChanges.map((ch, idx) => {
                        if (ch.type === "added") {
                          return (
                            <div
                              key={`sch-${idx}`}
                              style={{ color: "#4ade80" }}
                            >
                              + {ch.column} added
                            </div>
                          );
                        }
                        if (ch.type === "dropped") {
                          return (
                            <div
                              key={`sch-${idx}`}
                              style={{ color: "#f87171" }}
                            >
                              - {ch.column} dropped
                            </div>
                          );
                        }
                        if (ch.type === "type_change") {
                          return (
                            <div
                              key={`sch-${idx}`}
                              style={{ color: "#fbbf24" }}
                            >
                              ~ {ch.column}: {ch.previousType} → {ch.newType}
                            </div>
                          );
                        }
                        if (ch.type === "nullability_change") {
                          return (
                            <div
                              key={`sch-${idx}`}
                              style={{ color: "#fbbf24" }}
                            >
                              ~ {ch.column}: nullable{" "}
                              {ch.previousNullable ? "true" : "false"} →{" "}
                              {ch.newNullable ? "true" : "false"}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    {schemaChanges.some((c) => c.type === "dropped") ? (
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: "12px",
                          lineHeight: 1.45,
                          color: "var(--risk-high)",
                        }}
                      >
                        ⚠️ Dropped columns may break downstream queries and
                        dashboards
                      </p>
                    ) : null}
                    {schemaChanges.some((c) => c.type === "type_change") ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          lineHeight: 1.45,
                          color: "var(--risk-high)",
                        }}
                      >
                        🚨 Type changes can break joins and aggregations
                        immediately
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!overviewTrustBannerDismissed ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(34, 197, 94, 0.2)",
                      background: "rgba(34, 197, 94, 0.04)",
                      boxSizing: "border-box",
                    }}
                  >
                    <p
                      style={{
                        flex: 1,
                        margin: 0,
                        fontSize: "12px",
                        lineHeight: 1.45,
                        color: "rgba(167, 243, 208, 0.88)",
                        textAlign: "left",
                      }}
                    >
                      🔒 Raw data stays in your warehouse — Claude sees
                      statistics only · Read-only connection · No data stored by
                      Unlockdb
                    </p>
                    <button
                      type="button"
                      aria-label="Dismiss trust notice"
                      onClick={() => setOverviewTrustBannerDismissed(true)}
                      style={{
                        flexShrink: 0,
                        margin: 0,
                        padding: "0 4px",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontSize: "16px",
                        lineHeight: 1,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                {overviewHasData ? (
                  <>
                    <div
                      id="overview-row-diff-summary"
                      style={{
                        maxWidth: "44rem",
                        margin: "0 auto 16px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        className="app-ghost-btn"
                        onClick={() =>
                          document
                            .getElementById("overview-row-new")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                        }
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "999px",
                          border: "1px solid rgba(34, 197, 94, 0.35)",
                          background: "rgba(34, 197, 94, 0.08)",
                          color: "#86efac",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ➕ {rowLevelDiff.newRows.count} new
                      </button>
                      <button
                        type="button"
                        className="app-ghost-btn"
                        onClick={() =>
                          document
                            .getElementById("overview-row-removed")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                        }
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "999px",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          background: "rgba(245, 158, 11, 0.08)",
                          color: "#fcd34d",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ➖ {rowLevelDiff.removedRows.count} removed
                      </button>
                      <button
                        type="button"
                        className="app-ghost-btn"
                        onClick={() =>
                          document
                            .getElementById("overview-row-changed")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                        }
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "999px",
                          border: "1px solid rgba(59, 130, 246, 0.4)",
                          background: "rgba(59, 130, 246, 0.1)",
                          color: "#93c5fd",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ✏️ {rowLevelDiff.changedValues.count} changed
                      </button>
                      <button
                        type="button"
                        className="app-ghost-btn"
                        onClick={() =>
                          document
                            .getElementById("overview-data-quality")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                        }
                        style={{
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: "999px",
                          border: `1px solid ${
                            dataQualityIssues.some((q) => q.severity === "high")
                              ? "rgba(239, 68, 68, 0.45)"
                              : dataQualityIssues.length
                                ? "rgba(245, 158, 11, 0.4)"
                                : "var(--border)"
                          }`,
                          background: dataQualityIssues.some(
                            (q) => q.severity === "high"
                          )
                            ? "rgba(239, 68, 68, 0.08)"
                            : dataQualityIssues.length
                              ? "rgba(245, 158, 11, 0.08)"
                              : "var(--social-bg)",
                          color: dataQualityIssues.some(
                            (q) => q.severity === "high"
                          )
                            ? "#fca5a5"
                            : dataQualityIssues.length
                              ? "#fcd34d"
                              : "var(--text-muted)",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ⚠️ {dataQualityIssues.length} quality issue
                        {dataQualityIssues.length === 1 ? "" : "s"}
                      </button>
                    </div>

                    <div
                      style={{
                        maxWidth: "44rem",
                        margin: "0 auto 24px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <h2
                        id="overview-row-new"
                        style={{
                          ...governanceH2Style,
                          fontSize: "17px",
                          margin: "0 0 10px",
                          scrollMarginTop: "72px",
                        }}
                      >
                        ➕ New rows
                      </h2>
                      {rowLevelDiff.newRows.count > 0 ? (
                        <div
                          style={{
                            ...insightCardStyle,
                            marginBottom: "16px",
                            borderLeft: "3px solid #22c55e",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 8px",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--text-h)",
                            }}
                          >
                            ➕ {rowLevelDiff.newRows.count} new row
                            {rowLevelDiff.newRows.count === 1 ? "" : "s"} added
                          </p>
                          <RowDiffMiniTable
                            rows={rowLevelDiff.newRows.examples}
                            columns={columns}
                          />
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: "0 0 20px",
                            fontSize: "13px",
                            color: "var(--text-muted)",
                          }}
                        >
                          No new rows
                        </p>
                      )}

                      <h2
                        id="overview-row-removed"
                        style={{
                          ...governanceH2Style,
                          fontSize: "17px",
                          margin: "20px 0 10px",
                          scrollMarginTop: "72px",
                        }}
                      >
                        ➖ Removed rows
                      </h2>
                      {rowLevelDiff.removedRows.count > 0 ? (
                        <div
                          style={{
                            ...insightCardStyle,
                            marginBottom: "12px",
                            borderLeft: "3px solid #f59e0b",
                            background: "rgba(245, 158, 11, 0.06)",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 8px",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#fcd34d",
                            }}
                          >
                            ➖ {rowLevelDiff.removedRows.count} row
                            {rowLevelDiff.removedRows.count === 1
                              ? ""
                              : "s"}{" "}
                            removed
                          </p>
                          <RowDiffMiniTable
                            rows={rowLevelDiff.removedRows.examples}
                            columns={columns}
                          />
                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "12px",
                              lineHeight: 1.45,
                              color: "var(--text-muted)",
                            }}
                          >
                            Note: Row removal may be intentional (e.g. archived
                            records). Review before flagging as risk.
                          </p>
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: "0 0 20px",
                            fontSize: "13px",
                            color: "var(--text-muted)",
                          }}
                        >
                          No removed rows
                        </p>
                      )}

                      <h2
                        id="overview-row-changed"
                        style={{
                          ...governanceH2Style,
                          fontSize: "17px",
                          margin: "20px 0 10px",
                          scrollMarginTop: "72px",
                        }}
                      >
                        ✏️ Changed values
                      </h2>
                      {rowLevelDiff.changedValues.count > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            marginBottom: "12px",
                          }}
                        >
                          {Object.entries(
                            rowLevelDiff.changedValues.byColumn
                          )
                            .filter(([, info]) => info?.count > 0)
                            .map(([colKey, info]) => {
                            const label =
                              columns.find((c) => c.key === colKey)?.label ??
                              colKey;
                            return (
                              <div
                                key={colKey}
                                style={{
                                  ...insightCardStyle,
                                  margin: 0,
                                  borderLeft: "3px solid #3b82f6",
                                }}
                              >
                                <p
                                  style={{
                                    margin: "0 0 10px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "var(--text-h)",
                                  }}
                                >
                                  ✏️ {label}: {info.count} value
                                  {info.count === 1 ? "" : "s"} changed
                                </p>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text)",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {(info.examples ?? []).map((ex, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        marginBottom: "6px",
                                        padding: "8px 10px",
                                        borderRadius: "6px",
                                        background: "var(--code-bg)",
                                        border: "1px solid var(--border)",
                                      }}
                                    >
                                      Before:{" "}
                                      <code
                                        style={{
                                          fontSize: "11px",
                                          color: "#fca5a5",
                                        }}
                                      >
                                        {String(ex.before)}
                                      </code>
                                      {"  →  "}
                                      After:{" "}
                                      <code
                                        style={{
                                          fontSize: "11px",
                                          color: "#86efac",
                                        }}
                                      >
                                        {String(ex.after)}
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: "0 0 20px",
                            fontSize: "13px",
                            color: "var(--text-muted)",
                          }}
                        >
                          No value changes detected
                        </p>
                      )}
                      <p
                        style={{
                          margin: "0 0 24px",
                          fontSize: "12px",
                          lineHeight: 1.45,
                          color: "var(--text-muted)",
                        }}
                      >
                        Note: Value changes may reflect normal business updates.{" "}
                        {"Mark as 'known' if expected."}
                      </p>

                      <h2
                        id="overview-data-quality"
                        style={{
                          ...governanceH2Style,
                          fontSize: "17px",
                          margin: "0 0 10px",
                          scrollMarginTop: "72px",
                        }}
                      >
                        🔍 Data quality issues
                      </h2>
                      {dataQualityIssues.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            marginBottom: "8px",
                          }}
                        >
                          {dataQualityIssues.map((issue) => (
                            <div
                              key={issue.id}
                              style={{
                                ...insightCardStyle,
                                margin: 0,
                                borderLeft:
                                  issue.severity === "high"
                                    ? "3px solid #ef4444"
                                    : "3px solid #f59e0b",
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: "var(--text)",
                                  lineHeight: 1.45,
                                }}
                              >
                                ⚠️ {issue.message}
                              </p>
                              {issue.examples?.length ? (
                                <ul
                                  style={{
                                    margin: "8px 0 0",
                                    paddingLeft: "1.1rem",
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {issue.examples.map((ex) => (
                                    <li key={ex}>{ex}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p
                          style={{
                            margin: "0 0 8px",
                            fontSize: "13px",
                            color: "var(--text-muted)",
                          }}
                        >
                          No automatic quality issues flagged.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}

                {contracts.length > 0 && overviewHasData ? (
                  <div
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 22px",
                    }}
                  >
                    <h2
                      style={{
                        ...governanceH2Style,
                        fontSize: "17px",
                        margin: "0 0 12px",
                        color: "var(--text-h)",
                      }}
                    >
                      📋 Contract violations
                    </h2>
                    {contractViolationList.length === 0 ? (
                      <div
                        style={{
                          padding: "16px 18px",
                          borderRadius: "10px",
                          border: "1px solid rgba(34, 197, 94, 0.35)",
                          background: "rgba(34, 197, 94, 0.06)",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#86efac",
                            marginBottom: "6px",
                          }}
                        >
                          ✅ All contracts passed
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            lineHeight: 1.45,
                            color: "var(--text)",
                          }}
                        >
                          Your data meets all defined expectations.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {contractViolationList.map((v, idx) => {
                          const sev = String(v.severity).toLowerCase();
                          const title =
                            contracts.find((c) => c.id === v.contractId)
                              ?.label ?? v.column;
                          const border =
                            sev === "critical"
                              ? "1px solid var(--risk-high-border)"
                              : sev === "warning"
                                ? "1px solid rgba(245, 158, 11, 0.45)"
                                : "1px solid rgba(59, 130, 246, 0.45)";
                          const bg =
                            sev === "critical"
                              ? "var(--risk-high-bg)"
                              : sev === "warning"
                                ? "rgba(245, 158, 11, 0.08)"
                                : "rgba(59, 130, 246, 0.1)";
                          const tag =
                            sev === "critical"
                              ? "🚨 CRITICAL"
                              : sev === "warning"
                                ? "⚠️ WARNING"
                                : "ℹ️ INFO";
                          return (
                            <div
                              key={`${v.contractId}-${v.column}-${idx}`}
                              style={{
                                padding: "14px 16px",
                                borderRadius: "10px",
                                border,
                                background: bg,
                                boxSizing: "border-box",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  letterSpacing: "0.06em",
                                  color:
                                    sev === "critical"
                                      ? "var(--risk-high)"
                                      : sev === "warning"
                                        ? "#fcd34d"
                                        : "#93c5fd",
                                  marginBottom: "8px",
                                }}
                              >
                                {tag}
                              </div>
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "var(--text-h)",
                                  marginBottom: "6px",
                                  lineHeight: 1.35,
                                }}
                              >
                                &ldquo;{title}&rdquo;
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  lineHeight: 1.45,
                                  color: "var(--text)",
                                }}
                              >
                                {v.affectedRows} row
                                {v.affectedRows === 1 ? "" : "s"} — {v.message}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

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
                {markKnownMessage ? (
                  <p
                    style={{
                      maxWidth: "44rem",
                      margin: "0 auto 12px",
                      fontSize: "13px",
                      lineHeight: 1.45,
                      color: "var(--accent)",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                  >
                    {markKnownMessage}
                  </p>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    maxWidth: "44rem",
                    margin: "0 auto 28px",
                  }}
                >
                  {autoAnalysis && statChanges.length > 0 ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        padding: "16px 18px",
                        border: "1px solid var(--accent-border)",
                        background: "var(--accent-bg)",
                        boxShadow: "0 0 12px rgba(124, 58, 237, 0.12)",
                        overflow: "visible",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "10px",
                          overflow: "visible",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--accent)",
                          }}
                        >
                          🤖 AI Analysis
                        </div>
                        <span
                          role="img"
                          aria-label="Privacy information"
                          tabIndex={0}
                          onMouseEnter={() =>
                            setAiAnalysisPrivacyTipVisible(true)
                          }
                          onMouseLeave={() =>
                            setAiAnalysisPrivacyTipVisible(false)
                          }
                          onFocus={() => setAiAnalysisPrivacyTipVisible(true)}
                          onBlur={() => setAiAnalysisPrivacyTipVisible(false)}
                          style={{
                            fontSize: "14px",
                            lineHeight: 1,
                            cursor: "help",
                            userSelect: "none",
                          }}
                        >
                          ℹ️
                        </span>
                        {aiAnalysisPrivacyTipVisible ? (
                          <div
                            role="tooltip"
                            style={{
                              position: "absolute",
                              left: 0,
                              bottom: "100%",
                              marginBottom: "8px",
                              maxWidth: "280px",
                              padding: "8px 10px",
                              fontSize: "12px",
                              lineHeight: 1.45,
                              fontWeight: 500,
                              letterSpacing: "normal",
                              textTransform: "none",
                              color: "#ffffff",
                              background: "#141414",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                              zIndex: 50,
                              textAlign: "left",
                            }}
                          >
                            Claude receives only statistical summaries — null
                            rates, row counts, and change descriptions. No raw
                            data values are transmitted.
                          </div>
                        ) : null}
                      </div>
                      {typeof autoAnalysis === "string" ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "var(--text)",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {autoAnalysis}
                        </p>
                      ) : (
                        <>
                          <div style={{ marginBottom: "14px" }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              What changed
                            </strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "var(--text)",
                                lineHeight: 1.5,
                              }}
                            >
                              {autoAnalysis.whatChanged}
                            </p>
                          </div>
                          <div style={{ marginBottom: "14px" }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Impact
                            </strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "var(--text)",
                                lineHeight: 1.5,
                              }}
                            >
                              {autoAnalysis.impact}
                            </p>
                          </div>
                          <div style={{ marginBottom: "14px" }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Likely cause
                            </strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "var(--text)",
                                lineHeight: 1.5,
                              }}
                            >
                              {autoAnalysis.likelyCause}
                            </p>
                          </div>
                          <div style={{ marginBottom: 0 }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "var(--text-h)",
                                marginBottom: "6px",
                              }}
                            >
                              Suggested action
                            </strong>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "var(--text)",
                                lineHeight: 1.5,
                              }}
                            >
                              {autoAnalysis.suggestedAction}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                  {statChanges.length === 0 ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        fontSize: "15px",
                        color: "var(--text)",
                        padding: "18px 20px",
                      }}
                    >
                      {diffSummaryParagraph.trim() ||
                        "No change rows yet — add a baseline in Sources."}
                    </div>
                  ) : displayStatChangesForFeed.length === 0 &&
                    changeFeedFilter === "high-risk" ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        fontSize: "15px",
                        color: "var(--text)",
                        padding: "18px 20px",
                      }}
                    >
                      No HIGH risk changes match this filter. Try{" "}
                      <strong>show all changes</strong> in the AI assistant bar.
                    </div>
                  ) : displayStatChangesForFeed.length === 0 ? (
                    <div
                      style={{
                        ...insightCardStyle,
                        margin: 0,
                        fontSize: "15px",
                        color: "var(--text)",
                        padding: "18px 20px",
                      }}
                    >
                      No changes to show here — they may be acknowledged (see
                      Settings), muted for this table&apos;s sensitivity, or
                      downgraded after applying your thresholds. Try{" "}
                      <strong>show all changes</strong> if a filter is active.
                    </div>
                  ) : (
                    displayStatChangesForFeed.map((sc) => {
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
                          ? "#0f0808"
                          : sc.tier === "MEDIUM"
                            ? "#0f0e08"
                            : "#111111";
                      const tierLeftBorder =
                        sc.tier === "HIGH"
                          ? "#ef4444"
                          : sc.tier === "MEDIUM"
                            ? "#f59e0b"
                            : "#333333";
                      const primaryImpact = sc.impactLines[0];
                      const isSelected = selectedChange?.id === sc.id;
                      const isHovered = feedCardHoverId === sc.id;
                      return (
                        <div
                          key={sc.id}
                          onMouseEnter={() => setFeedCardHoverId(sc.id)}
                          onMouseLeave={() => setFeedCardHoverId(null)}
                          style={{
                            margin: 0,
                            borderRadius: "10px",
                            border: "1px solid #1f1f1f",
                            borderLeftWidth: "3px",
                            borderLeftStyle: "solid",
                            borderLeftColor: isSelected
                              ? "var(--accent)"
                              : tierLeftBorder,
                            background: cardBg,
                            boxShadow:
                              sc.tier === "HIGH"
                                ? isSelected
                                  ? "0 0 12px rgba(239, 68, 68, 0.1), 0 0 0 2px rgba(124, 58, 237, 0.35)"
                                  : "0 0 12px rgba(239, 68, 68, 0.1)"
                                : isSelected
                                  ? "0 0 0 2px rgba(124, 58, 237, 0.35)"
                                  : "none",
                            boxSizing: "border-box",
                            overflow: "visible",
                            filter: isHovered ? "brightness(1.04)" : undefined,
                            transition:
                              "filter 0.15s ease, border-color 0.12s ease, box-shadow 0.12s ease",
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
                              padding: "18px 20px 12px",
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
                                  marginBottom: "10px",
                                }}
                              >
                                → {primaryImpact}
                              </div>
                            ) : null}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                marginTop: primaryImpact ? 0 : "4px",
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--accent)",
                              }}
                            >
                              View details →
                            </div>
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
                              onClick={() => handleOpenAiExplainPanel(sc)}
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
                            <button
                              type="button"
                              onClick={() => handleGetInvestigationSql(sc)}
                              disabled={sqlInvestigateLoadingId === sc.id}
                              className="app-ghost-btn"
                              style={{
                                padding: "8px 14px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--social-bg)",
                                color: "var(--text-h)",
                                fontWeight: 600,
                                fontSize: "13px",
                                fontFamily: "inherit",
                                cursor:
                                  sqlInvestigateLoadingId === sc.id
                                    ? "wait"
                                    : "pointer",
                                opacity:
                                  sqlInvestigateLoadingId === sc.id ? 0.75 : 1,
                              }}
                            >
                              {sqlInvestigateLoadingId === sc.id
                                ? "…"
                                : "📋 Get SQL"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkChangeAsKnown(sc)}
                              className="app-ghost-btn"
                              style={{
                                padding: "8px 14px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--social-bg)",
                                color: "var(--text-h)",
                                fontWeight: 600,
                                fontSize: "13px",
                                fontFamily: "inherit",
                                cursor: "pointer",
                              }}
                            >
                              Mark as known
                            </button>
                          </div>
                          {sqlInvestigateLoadingId === sc.id ||
                          sqlInvestigateById[sc.id] ? (
                            <div
                              style={{
                                padding: "0 16px 16px",
                                boxSizing: "border-box",
                              }}
                            >
                              {sqlInvestigateLoadingId === sc.id &&
                              !sqlInvestigateById[sc.id] ? (
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: "13px",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  Generating SQL…
                                </p>
                              ) : null}
                              {sqlInvestigateById[sc.id] ? (
                                <div
                                  style={{
                                    position: "relative",
                                    background: "#0a0a0a",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                    padding: "36px 14px 12px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyInvestigationSql(
                                        sc.id,
                                        sqlInvestigateById[sc.id]
                                      )
                                    }
                                    className="app-ghost-btn"
                                    style={{
                                      position: "absolute",
                                      top: "8px",
                                      right: "8px",
                                      padding: "4px 10px",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {sqlCopiedChangeId === sc.id
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                  <pre
                                    style={{
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      fontSize: "12px",
                                      lineHeight: 1.5,
                                      fontFamily:
                                        "ui-monospace, Consolas, monospace",
                                      color: "#e5e5e5",
                                    }}
                                  >
                                    {highlightSqlForDisplay(
                                      sqlInvestigateById[sc.id]
                                    ).map((p, pi) => (
                                      <span
                                        key={pi}
                                        style={{
                                          color:
                                            p.k === "kw"
                                              ? "var(--accent)"
                                              : "#e5e5e5",
                                        }}
                                      >
                                        {p.t}
                                      </span>
                                    ))}
                                  </pre>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
                {statChanges.length > 0 ? (
                  <p
                    style={{
                      maxWidth: "44rem",
                      margin: "-12px auto 28px",
                      fontSize: "12px",
                      lineHeight: 1.45,
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    Showing changes above your configured thresholds. Adjust in{" "}
                    <button
                      type="button"
                      className="app-ghost-btn"
                      onClick={() => navigateToTab("settings")}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: "none",
                        background: "transparent",
                        color: "var(--accent)",
                        fontWeight: 600,
                        fontSize: "inherit",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textDecoration: "underline",
                        verticalAlign: "baseline",
                      }}
                    >
                      Settings
                    </button>
                    .
                  </p>
                ) : null}

                {explainStatChange && explainBasePayload ? (
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
                        background: "rgba(0, 0, 0, 0.55)",
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
                        background: "#0d0d0d",
                        borderLeft: "1px solid #1f1f1f",
                        boxShadow: "-8px 0 32px rgba(0,0,0,0.45)",
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
                            {explainBasePayload.title}
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

                      {explainClaudeLoading && !explainMergedPayload ? (
                        <p
                          style={{
                            margin: "0 0 20px",
                            fontSize: "14px",
                            color: "var(--text)",
                            lineHeight: 1.5,
                          }}
                        >
                          <span style={loadingDotStyle} aria-hidden>
                            ●
                          </span>{" "}
                          Analyzing with Claude...
                        </p>
                      ) : (
                        <>
                          {(() => {
                            const ep =
                              explainMergedPayload ?? explainBasePayload;
                            return (
                              <>
                                <div style={{ marginBottom: "14px" }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "var(--accent)",
                                      letterSpacing: "0.05em",
                                      textTransform: "uppercase",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    What changed
                                  </strong>
                                  <p style={aiExplainSectionBodyStyle}>
                                    {String(ep.whatChanged ?? "")}
                                  </p>
                                </div>
                                <div style={{ marginBottom: "14px" }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "var(--accent)",
                                      letterSpacing: "0.05em",
                                      textTransform: "uppercase",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    Impact
                                  </strong>
                                  <p style={aiExplainSectionBodyStyle}>
                                    {String(ep.impact ?? "")}
                                  </p>
                                </div>
                                <div style={{ marginBottom: "14px" }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "var(--accent)",
                                      letterSpacing: "0.05em",
                                      textTransform: "uppercase",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    Likely cause
                                  </strong>
                                  <p style={aiExplainSectionBodyStyle}>
                                    {String(ep.likelyCause ?? "")}
                                  </p>
                                </div>
                                <div style={{ marginBottom: 0 }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "var(--accent)",
                                      letterSpacing: "0.05em",
                                      textTransform: "uppercase",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    Suggested action
                                  </strong>
                                  <p
                                    style={{
                                      ...aiExplainSectionBodyStyle,
                                      marginBottom: 0,
                                    }}
                                  >
                                    {String(ep.suggestedAction ?? "")}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}
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
                            borderRadius: "10px",
                            background: "var(--code-bg)",
                          }}
                        >
                          <table
                            className="unlockdb-data-grid"
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
                                    r.value === "" ? (
                                      <span className="unlockdb-cell-null">
                                        —
                                      </span>
                                    ) : (
                                      String(r.value)
                                    )}
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
                              className="unlockdb-field"
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                fontSize: "14px",
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
                              className="unlockdb-field"
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                fontSize: "14px",
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
                        <table className="unlockdb-data-grid">
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
                                        row[col.key] === "" ? (
                                          <span className="unlockdb-cell-null">
                                            —
                                          </span>
                                        ) : (
                                          String(row[col.key])
                                        )}
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
                              background: "rgba(0, 0, 0, 0.55)",
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
                              background: "#0d0d0d",
                              borderLeft: "1px solid #1f1f1f",
                              boxShadow: "-8px 0 32px rgba(0,0,0,0.45)",
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
                                  marginTop: "10px",
                                  paddingTop: "8px",
                                  borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--text-muted)",
                                    marginBottom: "2px",
                                  }}
                                >
                                  7-day trend
                                </div>
                                <div
                                  style={{ width: "80px", height: "30px" }}
                                >
                                  <ResponsiveContainer width={80} height={30}>
                                    <LineChart
                                      data={insightSparklineSeries(
                                        insight.key,
                                        riskFindings
                                      )}
                                      margin={{
                                        top: 2,
                                        right: 0,
                                        left: 0,
                                        bottom: 2,
                                      }}
                                      style={{ background: "transparent" }}
                                    >
                                      <Line
                                        type="monotone"
                                        dataKey="v"
                                        stroke={insightSparklineColor(
                                          insight.key,
                                          riskFindings
                                        )}
                                        strokeWidth={1.5}
                                        dot={false}
                                        isAnimationActive={false}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
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
                    onClick={() => navigateToTab("sources")}
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
                  bottom <strong>AI assistant</strong> bar to filter, explain, and
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
          </section>
        )}

        {activeTab === "about" && (
          <section
            style={{
              maxWidth: "700px",
              margin: "0 auto",
              textAlign: "left",
              paddingBottom: "160px",
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
                <li>AI Assistant</li>
              </ul>
            </div>
          </section>
        )}

        {activeTab === "sources" && (
          <section
            style={{
              maxWidth: "42rem",
              margin: "0 auto",
              paddingBottom: "160px",
            }}
          >
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
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "6px",
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
                  {(previousData.length > 0 || currentData.length > 0) && (
                    <button
                      type="button"
                      className="app-ghost-btn"
                      onClick={handleResetCsvFiles}
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
                      ↺ Load new files
                    </button>
                  )}
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
              <>
                <SourcesWarehouseSecurityChecklistCard />
                <form
                  onSubmit={handleSnowflakeDemoConnect}
                  style={{
                    padding: "18px 20px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--social-bg)",
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
              </>
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
                    margin: "0 0 10px",
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
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    color: "var(--text-muted)",
                  }}
                >
                  🔒 Read-only · No data stored · Statistics only sent to AI
                </p>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text)",
                    marginBottom: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    Snowflake demo
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--border)" }}>
                    ›
                  </span>
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    analytics
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--border)" }}>
                    ›
                  </span>
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    public
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={tableBrowserViewMode === "list"}
                    onClick={() => setTableBrowserViewMode("list")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        tableBrowserViewMode === "list"
                          ? "var(--accent-border)"
                          : "var(--border)"
                      }`,
                      background:
                        tableBrowserViewMode === "list"
                          ? "var(--accent-bg)"
                          : "transparent",
                      color: "var(--text-h)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    [List]
                  </button>
                  <button
                    type="button"
                    aria-pressed={tableBrowserViewMode === "heatmap"}
                    onClick={() => setTableBrowserViewMode("heatmap")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        tableBrowserViewMode === "heatmap"
                          ? "var(--accent-border)"
                          : "var(--border)"
                      }`,
                      background:
                        tableBrowserViewMode === "heatmap"
                          ? "var(--accent-bg)"
                          : "transparent",
                      color: "var(--text-h)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    [Heatmap]
                  </button>
                </div>

                <input
                  type="search"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Search tables..."
                  aria-label="Search tables"
                  className="unlockdb-field"
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />

                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "13px",
                    color: "var(--text)",
                  }}
                >
                  {tableBrowserSummary.total} tables ·{" "}
                  {tableBrowserSummary.withChanges} with changes ·{" "}
                  {tableBrowserSummary.highRisk} high risk
                </p>

                {tableBrowserViewMode === "heatmap" ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(4, minmax(0, 1fr))",
                        gap: "8px",
                        maxWidth: "100%",
                        marginBottom: "10px",
                      }}
                    >
                      {tableBrowserFiltered.map((tbl) => (
                        <button
                          key={tbl.name}
                          type="button"
                          onClick={() =>
                            loadDemoForWarehouseTable(tbl.name, "snowflake")
                          }
                          style={{
                            minHeight: "80px",
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: heatmapCellBackground(tbl),
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "6px",
                            boxSizing: "border-box",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#ffffff",
                              lineHeight: 1.25,
                              wordBreak: "break-word",
                            }}
                          >
                            {tbl.name}
                          </div>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              lineHeight: 1.2,
                            }}
                          >
                            {tbl.schema}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                              justifyContent: "flex-start",
                            }}
                          >
                            {tbl.riskLevel === "high" ||
                            tbl.riskLevel === "medium" ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)",
                                  background:
                                    tbl.riskLevel === "high"
                                      ? "var(--risk-high-bg)"
                                      : "var(--code-bg)",
                                  color:
                                    tbl.riskLevel === "high"
                                      ? "var(--risk-high)"
                                      : "var(--text-h)",
                                }}
                              >
                                {tbl.riskLevel === "high"
                                  ? "High"
                                  : "Medium"}
                              </span>
                            ) : null}
                            {tbl.changeCount > 0 ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--risk-high-bg)",
                                  color: "var(--risk-high)",
                                  border: "1px solid var(--risk-high-border)",
                                }}
                              >
                                {tbl.changeCount} chg
                              </span>
                            ) : null}
                            {renderContractTableBadge(tbl.name)}
                          </div>
                        </button>
                      ))}
                    </div>
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        textAlign: "left",
                      }}
                    >
                      🔴 High risk · 🟡 Changes · 🟢 OK · ⚫ Not monitored
                    </p>
                  </>
                ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {tableBrowserFiltered.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "var(--text)",
                      }}
                    >
                      No tables match your search.
                    </p>
                  ) : (
                    tableBrowserFiltered.map((tbl) => {
                      const rowKey = `snowflake:${tbl.name}`;
                      const isActive =
                        activeSourceName === "snowflake" &&
                        snowflakeWarehouseTableDisplay === tbl.name;
                      const isHover =
                        tableBrowserRowHoverKey === rowKey && !isActive;
                      return (
                        <div
                          key={tbl.name}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              loadDemoForWarehouseTable(tbl.name, "snowflake");
                            }
                          }}
                          onMouseEnter={() =>
                            setTableBrowserRowHoverKey(rowKey)
                          }
                          onMouseLeave={() =>
                            setTableBrowserRowHoverKey(null)
                          }
                          onClick={() =>
                            loadDemoForWarehouseTable(tbl.name, "snowflake")
                          }
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "12px",
                            width: "100%",
                            boxSizing: "border-box",
                            textAlign: "left",
                            padding: "14px 16px",
                            borderRadius: "10px",
                            border: `1px solid ${
                              isActive
                                ? "var(--accent-border)"
                                : "var(--border)"
                            }`,
                            borderLeftWidth: isActive ? 4 : 1,
                            borderLeftColor: isActive
                              ? "var(--accent)"
                              : "var(--border)",
                            background: isHover
                              ? "#1a1a1a"
                              : "var(--social-bg)",
                            boxShadow: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition:
                              "background 0.15s ease, border-color 0.15s ease",
                            outline: "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              flex: "1 1 220px",
                              minWidth: 0,
                            }}
                          >
                            <div
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                marginTop: "5px",
                                borderRadius: "999px",
                                flexShrink: 0,
                                background: demoTableBrowserStatusDotColor(
                                  tbl.status
                                ),
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 700,
                                  color: "var(--text-h)",
                                  marginBottom: "4px",
                                }}
                              >
                                {tbl.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text)",
                                  opacity: 0.85,
                                  marginBottom: "4px",
                                }}
                              >
                                {tbl.schema}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text)",
                                  lineHeight: 1.45,
                                  opacity: 0.9,
                                }}
                              >
                                {tbl.columns} columns ·{" "}
                                {Number(tbl.rows).toLocaleString()} rows
                              </div>
                              {tbl.aiNameSuggestion ? (
                                <div style={{ marginTop: "8px" }}>
                                  <button
                                    type="button"
                                    className="app-ghost-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTableBrowserAiNameTipId((cur) =>
                                        cur === tbl.name ? null : tbl.name
                                      );
                                    }}
                                    style={{
                                      padding: "2px 8px",
                                      margin: 0,
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      borderRadius: "6px",
                                      border: "1px solid var(--accent-border)",
                                      background: "var(--accent-bg)",
                                      color: "var(--accent)",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    💡 {tbl.aiNameSuggestion}
                                  </button>
                                  {tableBrowserAiNameTipId === tbl.name ? (
                                    <p
                                      style={{
                                        margin: "6px 0 0",
                                        fontSize: "12px",
                                        lineHeight: 1.45,
                                        color: "var(--text)",
                                        maxWidth: "28rem",
                                      }}
                                    >
                                      {`AI suggests renaming to '${tbl.aiNameSuggestion}' based on the table's content and structure.`}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "8px",
                              flexShrink: 0,
                              maxWidth: "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                opacity: 0.9,
                              }}
                            >
                              {tbl.lastSync}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                                gap: "6px",
                              }}
                            >
                              {tbl.riskLevel === "high" ||
                              tbl.riskLevel === "medium" ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background:
                                      tbl.riskLevel === "high"
                                        ? "var(--risk-high-bg)"
                                        : "var(--code-bg)",
                                    color:
                                      tbl.riskLevel === "high"
                                        ? "var(--risk-high)"
                                        : "var(--text-h)",
                                  }}
                                >
                                  {tbl.riskLevel === "high"
                                    ? "High risk"
                                    : "Medium risk"}
                                </span>
                              ) : null}
                              {tbl.changeCount > 0 ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: "var(--risk-high-bg)",
                                    color: "var(--risk-high)",
                                    border:
                                      "1px solid var(--risk-high-border)",
                                  }}
                                >
                                  ⚠️ {tbl.changeCount} changes
                                </span>
                              ) : null}
                              {renderContractTableBadge(tbl.name)}
                            </div>
                          </div>
                          <div
                            style={{
                              flexBasis: "100%",
                              width: "100%",
                              marginTop: "4px",
                              paddingTop: "8px",
                              borderTop: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                                marginBottom: "2px",
                              }}
                            >
                              7-day trend
                            </div>
                            <div style={{ width: "80px", height: "30px" }}>
                              <ResponsiveContainer width={80} height={30}>
                                <LineChart
                                  data={tableBrowserSparklineSeries(tbl)}
                                  margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
                                  style={{ background: "transparent" }}
                                >
                                  <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke={tableBrowserSparklineColor(tbl)}
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                )}
              </div>
            ) : null}

            {selectedSource === "databricks" && !databricksDemoConnected ? (
              <>
                <SourcesWarehouseSecurityChecklistCard />
                <form
                  onSubmit={handleDatabricksDemoConnect}
                  style={{
                    padding: "18px 20px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--social-bg)",
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
              </>
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
                    margin: "0 0 10px",
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
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    color: "var(--text-muted)",
                  }}
                >
                  🔒 Read-only · No data stored · Statistics only sent to AI
                </p>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text)",
                    marginBottom: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    Databricks demo
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--border)" }}>
                    ›
                  </span>
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    main
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--border)" }}>
                    ›
                  </span>
                  <span style={{ color: "var(--text-h)", fontWeight: 600 }}>
                    analytics
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={tableBrowserViewMode === "list"}
                    onClick={() => setTableBrowserViewMode("list")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        tableBrowserViewMode === "list"
                          ? "var(--accent-border)"
                          : "var(--border)"
                      }`,
                      background:
                        tableBrowserViewMode === "list"
                          ? "var(--accent-bg)"
                          : "transparent",
                      color: "var(--text-h)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    [List]
                  </button>
                  <button
                    type="button"
                    aria-pressed={tableBrowserViewMode === "heatmap"}
                    onClick={() => setTableBrowserViewMode("heatmap")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        tableBrowserViewMode === "heatmap"
                          ? "var(--accent-border)"
                          : "var(--border)"
                      }`,
                      background:
                        tableBrowserViewMode === "heatmap"
                          ? "var(--accent-bg)"
                          : "transparent",
                      color: "var(--text-h)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    [Heatmap]
                  </button>
                </div>

                <input
                  type="search"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Search tables..."
                  aria-label="Search tables"
                  className="unlockdb-field"
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />

                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: "13px",
                    color: "var(--text)",
                  }}
                >
                  {tableBrowserSummary.total} tables ·{" "}
                  {tableBrowserSummary.withChanges} with changes ·{" "}
                  {tableBrowserSummary.highRisk} high risk
                </p>

                {tableBrowserViewMode === "heatmap" ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(4, minmax(0, 1fr))",
                        gap: "8px",
                        maxWidth: "100%",
                        marginBottom: "10px",
                      }}
                    >
                      {tableBrowserFiltered.map((tbl) => (
                        <button
                          key={`db-hm-${tbl.name}`}
                          type="button"
                          onClick={() =>
                            loadDemoForWarehouseTable(tbl.name, "databricks")
                          }
                          style={{
                            minHeight: "80px",
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: heatmapCellBackground(tbl),
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "6px",
                            boxSizing: "border-box",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#ffffff",
                              lineHeight: 1.25,
                              wordBreak: "break-word",
                            }}
                          >
                            {tbl.name}
                          </div>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              lineHeight: 1.2,
                            }}
                          >
                            {tbl.schema}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                              justifyContent: "flex-start",
                            }}
                          >
                            {tbl.riskLevel === "high" ||
                            tbl.riskLevel === "medium" ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)",
                                  background:
                                    tbl.riskLevel === "high"
                                      ? "var(--risk-high-bg)"
                                      : "var(--code-bg)",
                                  color:
                                    tbl.riskLevel === "high"
                                      ? "var(--risk-high)"
                                      : "var(--text-h)",
                                }}
                              >
                                {tbl.riskLevel === "high"
                                  ? "High"
                                  : "Medium"}
                              </span>
                            ) : null}
                            {tbl.changeCount > 0 ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--risk-high-bg)",
                                  color: "var(--risk-high)",
                                  border: "1px solid var(--risk-high-border)",
                                }}
                              >
                                {tbl.changeCount} chg
                              </span>
                            ) : null}
                            {renderContractTableBadge(tbl.name)}
                          </div>
                        </button>
                      ))}
                    </div>
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        textAlign: "left",
                      }}
                    >
                      🔴 High risk · 🟡 Changes · 🟢 OK · ⚫ Not monitored
                    </p>
                  </>
                ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {tableBrowserFiltered.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "var(--text)",
                      }}
                    >
                      No tables match your search.
                    </p>
                  ) : (
                    tableBrowserFiltered.map((tbl) => {
                      const rowKey = `databricks:${tbl.name}`;
                      const isActive =
                        activeSourceName === "databricks" &&
                        databricksWarehouseTableDisplay === tbl.name;
                      const isHover =
                        tableBrowserRowHoverKey === rowKey && !isActive;
                      return (
                        <div
                          key={tbl.name}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              loadDemoForWarehouseTable(tbl.name, "databricks");
                            }
                          }}
                          onMouseEnter={() =>
                            setTableBrowserRowHoverKey(rowKey)
                          }
                          onMouseLeave={() =>
                            setTableBrowserRowHoverKey(null)
                          }
                          onClick={() =>
                            loadDemoForWarehouseTable(tbl.name, "databricks")
                          }
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "12px",
                            width: "100%",
                            boxSizing: "border-box",
                            textAlign: "left",
                            padding: "14px 16px",
                            borderRadius: "10px",
                            border: `1px solid ${
                              isActive
                                ? "var(--accent-border)"
                                : "var(--border)"
                            }`,
                            borderLeftWidth: isActive ? 4 : 1,
                            borderLeftColor: isActive
                              ? "var(--accent)"
                              : "var(--border)",
                            background: isHover
                              ? "#1a1a1a"
                              : "var(--social-bg)",
                            boxShadow: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition:
                              "background 0.15s ease, border-color 0.15s ease",
                            outline: "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "12px",
                              flex: "1 1 220px",
                              minWidth: 0,
                            }}
                          >
                            <div
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                marginTop: "5px",
                                borderRadius: "999px",
                                flexShrink: 0,
                                background: demoTableBrowserStatusDotColor(
                                  tbl.status
                                ),
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 700,
                                  color: "var(--text-h)",
                                  marginBottom: "4px",
                                }}
                              >
                                {tbl.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text)",
                                  opacity: 0.85,
                                  marginBottom: "4px",
                                }}
                              >
                                {tbl.schema}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text)",
                                  lineHeight: 1.45,
                                  opacity: 0.9,
                                }}
                              >
                                {tbl.columns} columns ·{" "}
                                {Number(tbl.rows).toLocaleString()} rows
                              </div>
                              {tbl.aiNameSuggestion ? (
                                <div style={{ marginTop: "8px" }}>
                                  <button
                                    type="button"
                                    className="app-ghost-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTableBrowserAiNameTipId((cur) =>
                                        cur === tbl.name ? null : tbl.name
                                      );
                                    }}
                                    style={{
                                      padding: "2px 8px",
                                      margin: 0,
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      borderRadius: "6px",
                                      border: "1px solid var(--accent-border)",
                                      background: "var(--accent-bg)",
                                      color: "var(--accent)",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    💡 {tbl.aiNameSuggestion}
                                  </button>
                                  {tableBrowserAiNameTipId === tbl.name ? (
                                    <p
                                      style={{
                                        margin: "6px 0 0",
                                        fontSize: "12px",
                                        lineHeight: 1.45,
                                        color: "var(--text)",
                                        maxWidth: "28rem",
                                      }}
                                    >
                                      {`AI suggests renaming to '${tbl.aiNameSuggestion}' based on the table's content and structure.`}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "8px",
                              flexShrink: 0,
                              maxWidth: "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                opacity: 0.9,
                              }}
                            >
                              {tbl.lastSync}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                                gap: "6px",
                              }}
                            >
                              {tbl.riskLevel === "high" ||
                              tbl.riskLevel === "medium" ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background:
                                      tbl.riskLevel === "high"
                                        ? "var(--risk-high-bg)"
                                        : "var(--code-bg)",
                                    color:
                                      tbl.riskLevel === "high"
                                        ? "var(--risk-high)"
                                        : "var(--text-h)",
                                  }}
                                >
                                  {tbl.riskLevel === "high"
                                    ? "High risk"
                                    : "Medium risk"}
                                </span>
                              ) : null}
                              {tbl.changeCount > 0 ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: "var(--risk-high-bg)",
                                    color: "var(--risk-high)",
                                    border:
                                      "1px solid var(--risk-high-border)",
                                  }}
                                >
                                  ⚠️ {tbl.changeCount} changes
                                </span>
                              ) : null}
                              {renderContractTableBadge(tbl.name)}
                            </div>
                          </div>
                          <div
                            style={{
                              flexBasis: "100%",
                              width: "100%",
                              marginTop: "4px",
                              paddingTop: "8px",
                              borderTop: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                                marginBottom: "2px",
                              }}
                            >
                              7-day trend
                            </div>
                            <div style={{ width: "80px", height: "30px" }}>
                              <ResponsiveContainer width={80} height={30}>
                                <LineChart
                                  data={tableBrowserSparklineSeries(tbl)}
                                  margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
                                  style={{ background: "transparent" }}
                                >
                                  <Line
                                    type="monotone"
                                    dataKey="v"
                                    stroke={tableBrowserSparklineColor(tbl)}
                                    strokeWidth={1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                )}
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
                    className="unlockdb-field"
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
          <section style={governanceSectionStyle}>
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
                    boxShadow: "none",
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

        {activeTab === "security" && (
          <section style={securityPageWrapStyle}>
            <h1
              style={{
                fontSize: "clamp(26px, 4vw, 32px)",
                fontWeight: 700,
                color: "var(--text-h)",
                margin: "0 0 8px",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Security &amp; Privacy
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "var(--text)",
                margin: "0 0 28px",
                lineHeight: 1.5,
              }}
            >
              How Unlockdb handles your data
            </p>

            <div style={securitySectionCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <span style={{ fontSize: "24px", lineHeight: 1.2 }} aria-hidden>
                  🔒
                </span>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Your data stays in your warehouse
                </h2>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: "0 0 18px",
                }}
              >
                Unlockdb connects to your Snowflake or Databricks environment in
                read-only mode. Your raw data never leaves your warehouse. We
                only read metadata and statistical summaries — never the actual
                row values.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px 14px",
                  padding: "16px 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--code-bg)",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-hover)",
                    background: "var(--bg-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    textAlign: "center",
                    minWidth: "min(140px, 100%)",
                    flex: "1 1 120px",
                  }}
                >
                  Your Snowflake
                </div>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "20px",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  →
                </span>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--accent)",
                    textAlign: "center",
                    minWidth: "min(180px, 100%)",
                    flex: "1 1 160px",
                  }}
                >
                  Unlockdb reads stats only
                </div>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "20px",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  →
                </span>
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-hover)",
                    background: "var(--bg-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    textAlign: "center",
                    minWidth: "min(140px, 100%)",
                    flex: "1 1 120px",
                  }}
                >
                  AI Analysis
                </div>
              </div>
            </div>

            <div style={securitySectionCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "24px", lineHeight: 1.2 }} aria-hidden>
                  🤖
                </span>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  What Claude AI sees
                </h2>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "10px",
                    border: "1px solid rgba(34, 197, 94, 0.35)",
                    background: "var(--code-bg)",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#4ade80",
                      margin: "0 0 12px",
                    }}
                  >
                    What Claude sees
                  </h3>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 0,
                      fontSize: "13px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                      listStyle: "none",
                    }}
                  >
                    <li style={{ marginBottom: "8px" }}>
                      ✅ Null percentage per column (e.g. &quot;20%&quot;)
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ✅ Distinct value counts (e.g. &quot;4 unique values&quot;)
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ✅ Row counts (e.g. &quot;12,847 rows&quot;)
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ✅ Change summaries (e.g. &quot;null rate increased&quot;)
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ✅ Column names and data types
                    </li>
                    <li>✅ Statistical distributions</li>
                  </ul>
                </div>
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: "10px",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    background: "var(--code-bg)",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#f87171",
                      margin: "0 0 12px",
                    }}
                  >
                    What Claude never sees
                  </h3>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 0,
                      fontSize: "13px",
                      lineHeight: 1.55,
                      color: "var(--text)",
                      listStyle: "none",
                    }}
                  >
                    <li style={{ marginBottom: "8px" }}>
                      ❌ Actual row values or cell contents
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ❌ Customer names, emails, or IDs
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ❌ Financial figures or transaction data
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ❌ Any personally identifiable information
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      ❌ Business-sensitive data
                    </li>
                    <li>❌ Raw query results</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style={securitySectionCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "24px", lineHeight: 1.2 }} aria-hidden>
                  🛡️
                </span>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  AI &amp; data training
                </h2>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: "0 0 14px",
                }}
              >
                Anthropic (the company behind Claude) does not use API calls to
                train their AI models. Your statistical summaries sent through
                Unlockdb are never used for model training. This is documented in
                Anthropic&apos;s API data privacy policy.
              </p>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid var(--border-hover)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-h)",
                }}
              >
                Verified: Anthropic API Data Policy
              </span>
            </div>

            <div style={securitySectionCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <span style={{ fontSize: "24px", lineHeight: 1.2 }} aria-hidden>
                  🔐
                </span>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  How we protect your connection
                </h2>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 0,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--text)",
                  listStyle: "none",
                }}
              >
                <li style={{ marginBottom: "10px" }}>
                  ✅ All connections use TLS encryption in transit
                </li>
                <li style={{ marginBottom: "10px" }}>
                  ✅ Snowflake/Databricks credentials are never stored by Unlockdb
                </li>
                <li style={{ marginBottom: "10px" }}>
                  ✅ API keys are stored in secure environment variables only
                </li>
                <li style={{ marginBottom: "10px" }}>
                  ✅ Read-only access — Unlockdb cannot modify your data
                </li>
                <li style={{ marginBottom: "10px" }}>
                  ✅ No data is cached or stored on Unlockdb servers
                </li>
                <li>✅ Each session is isolated</li>
              </ul>
            </div>

            <div style={securitySectionCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "24px", lineHeight: 1.2 }} aria-hidden>
                  🇪🇺
                </span>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "var(--text-h)",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  GDPR &amp; Compliance
                </h2>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: "0 0 14px",
                }}
              >
                Unlockdb is designed with GDPR compliance in mind:
              </p>
              <ul
                style={{
                  margin: "0 0 16px",
                  paddingLeft: "1.15rem",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--text)",
                }}
              >
                <li style={{ marginBottom: "8px" }}>
                  We process only statistical metadata, not personal data
                </li>
                <li style={{ marginBottom: "8px" }}>
                  No personal data is transmitted to AI systems
                </li>
                <li style={{ marginBottom: "8px" }}>
                  Data minimization by design — we only read what is needed for
                  analysis
                </li>
                <li>
                  You can disconnect your data source at any time
                </li>
              </ul>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                Enterprise customers: Data Processing Agreements (DPA) available
                on request.
              </p>
            </div>

            <div
              style={{
                ...securitySectionCardStyle,
                marginBottom: 0,
              }}
            >
              <h2
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--text-h)",
                  margin: "0 0 12px",
                  letterSpacing: "-0.02em",
                }}
              >
                Questions?
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: "0 0 16px",
                }}
              >
                Have security questions or need a Data Processing Agreement?
              </p>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--text)",
                  margin: "0 0 16px",
                }}
              >
                Contact us:{" "}
                <a
                  href="mailto:security@unlockdb.com"
                  style={{ color: "var(--accent)", fontWeight: 600 }}
                >
                  security@unlockdb.com
                </a>
              </p>
              <button
                type="button"
                className="app-ghost-btn"
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Request DPA →
              </button>
            </div>
          </section>
        )}

        {activeTab === "contracts" && (
          <section
            style={{
              maxWidth: "42rem",
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                color: "var(--text-h)",
                fontSize: "28px",
                fontWeight: 700,
              }}
            >
              Data Contracts
            </h2>
            <p style={{ color: "var(--text)", marginBottom: "24px" }}>
              Define what your data should look like. Get alerted when
              expectations are violated.
            </p>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--code-bg)",
                marginBottom: "12px",
                borderLeft: "4px solid var(--risk-high)",
              }}
            >
              <div
                style={{
                  color: "var(--risk-high)",
                  fontWeight: 700,
                  fontSize: "12px",
                  marginBottom: "6px",
                }}
              >
                🚨 CRITICAL
              </div>
              <div style={{ color: "var(--text-h)", fontWeight: 600 }}>
                Email must not be null
              </div>
              <div style={{ color: "var(--text)", fontSize: "13px" }}>
                column: email → rule: not null
              </div>
            </div>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--code-bg)",
                marginBottom: "12px",
                borderLeft: "4px solid var(--risk-medium)",
              }}
            >
              <div
                style={{
                  color: "var(--risk-medium)",
                  fontWeight: 700,
                  fontSize: "12px",
                  marginBottom: "6px",
                }}
              >
                ⚠️ WARNING
              </div>
              <div style={{ color: "var(--text-h)", fontWeight: 600 }}>
                Country must be one of: FI, SE, NO, DK
              </div>
              <div style={{ color: "var(--text)", fontSize: "13px" }}>
                column: country → rule: one of allowed values
              </div>
            </div>
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--code-bg)",
                borderLeft: "4px solid var(--risk-high)",
              }}
            >
              <div
                style={{
                  color: "var(--risk-high)",
                  fontWeight: 700,
                  fontSize: "12px",
                  marginBottom: "6px",
                }}
              >
                🚨 CRITICAL
              </div>
              <div style={{ color: "var(--text-h)", fontWeight: 600 }}>
                Row count must not drop by more than 10%
              </div>
              <div style={{ color: "var(--text)", fontSize: "13px" }}>
                table: all → rule: max 10% row count decrease
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section style={governanceSectionStyle}>
            <h2 style={governanceH2Style}>Alert &amp; monitoring settings</h2>
            <p style={governanceMutedStyle}>
              Configure when Unlockdb flags changes as risks. Reducing noise
              helps you focus on what actually matters.
            </p>

            <div style={settingsPageSectionCardStyle}>
              <h3 style={{ ...governanceH3Style, marginTop: 0 }}>
                Global thresholds
              </h3>
              <p
                style={{
                  ...governanceMutedStyle,
                  marginTop: "-8px",
                  marginBottom: "16px",
                }}
              >
                Changes below these thresholds are ignored.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "14px",
                    color: "var(--text-h)",
                    fontWeight: 600,
                  }}
                >
                  Flag as HIGH RISK when null % increases by more than:
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={nullRateIncreaseThreshold}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value);
                        setNullRateIncreaseThreshold(
                          Number.isFinite(v)
                            ? Math.min(100, Math.max(0, v))
                            : 0
                        );
                      }}
                      className="unlockdb-field"
                      style={settingsPageNumberInputStyle}
                      aria-label="Null rate increase threshold percent"
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      %
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text)",
                      lineHeight: 1.45,
                    }}
                  >
                    Example: if email nulls go from 2% to 8%, that&apos;s a 6%
                    increase — flagged.
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "14px",
                    color: "var(--text-h)",
                    fontWeight: 600,
                  }}
                >
                  Flag as MEDIUM when distinct count changes by more than:
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={distinctValueChangeThreshold}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value);
                        setDistinctValueChangeThreshold(
                          Number.isFinite(v)
                            ? Math.min(100, Math.max(0, v))
                            : 0
                        );
                      }}
                      className="unlockdb-field"
                      style={settingsPageNumberInputStyle}
                      aria-label="Distinct value change threshold percent"
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      %
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text)",
                      lineHeight: 1.45,
                    }}
                  >
                    Catches new categories or dropped values.
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "14px",
                    color: "var(--text-h)",
                    fontWeight: 600,
                  }}
                >
                  Flag when total row count changes by more than:
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={rowCountChangeThreshold}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value);
                        setRowCountChangeThreshold(
                          Number.isFinite(v)
                            ? Math.min(100, Math.max(0, v))
                            : 0
                        );
                      }}
                      className="unlockdb-field"
                      style={settingsPageNumberInputStyle}
                      aria-label="Row count change threshold percent"
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      %
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text)",
                      lineHeight: 1.45,
                    }}
                  >
                    Large row count drops can indicate data loss.
                  </span>
                </label>
              </div>
            </div>

            <div style={settingsPageSectionCardStyle}>
              <h3 style={{ ...governanceH3Style, marginTop: 0 }}>
                Table-level sensitivity
              </h3>
              <p
                style={{
                  ...governanceMutedStyle,
                  marginTop: "-8px",
                  marginBottom: "14px",
                }}
              >
                Override global settings for specific tables.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {SETTINGS_ALERT_DEMO_TABLE_IDS.map((tableId) => {
                  const mode =
                    settingsTableSensitivity[tableId] ?? "normal";
                  const badge = settingsAlertSensitivityBadgeStyle(mode);
                  return (
                    <div
                      key={tableId}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "12px 14px",
                        padding: "12px 0",
                        borderTop:
                          tableId === SETTINGS_ALERT_DEMO_TABLE_IDS[0]
                            ? "none"
                            : "1px solid var(--border)",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "15px",
                          color: "var(--text-h)",
                          minWidth: "140px",
                        }}
                      >
                        {tableId}
                      </span>
                      <label
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--text-h)",
                        }}
                      >
                        Sensitivity
                        <select
                          value={mode}
                          onChange={(e) =>
                            setSettingsTableSensitivity((prev) => ({
                              ...prev,
                              [tableId]: e.target.value,
                            }))
                          }
                          className="unlockdb-field"
                          style={settingsPageSelectStyle}
                          aria-label={`Sensitivity for ${tableId}`}
                        >
                          <option value="high">
                            High (alert on small changes)
                          </option>
                          <option value="normal">
                            Normal (use global settings)
                          </option>
                          <option value="low">
                            Low (only alert on large changes)
                          </option>
                          <option value="muted">Muted (no alerts)</option>
                        </select>
                      </label>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: badge.background,
                          color: badge.color,
                          border: badge.border,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={settingsPageSectionCardStyle}>
              <h3 style={{ ...governanceH3Style, marginTop: 0 }}>
                Acknowledged changes
              </h3>
              <p
                style={{
                  ...governanceMutedStyle,
                  marginTop: "-8px",
                  marginBottom: "14px",
                }}
              >
                Changes you have marked as known or expected.
              </p>
              {acknowledgedChangeEntries.length === 0 ? (
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    color: "var(--text)",
                  }}
                >
                  No acknowledged changes yet. When you mark a change as
                  &apos;known&apos;, it appears here and won&apos;t trigger
                  alerts.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {acknowledgedChangeEntries.map((entry) => (
                    <li
                      key={entry.id}
                      style={{
                        fontSize: "13px",
                        lineHeight: 1.45,
                        color: "var(--text)",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--code-bg)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-h)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {entry.at}
                      </span>
                      {entry.changeText}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="app-ghost-btn"
                disabled={acknowledgedChangeEntries.length === 0}
                onClick={handleClearAllAcknowledgedChanges}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background:
                    acknowledgedChangeEntries.length === 0
                      ? "var(--code-bg)"
                      : "var(--bg)",
                  color:
                    acknowledgedChangeEntries.length === 0
                      ? "var(--text)"
                      : "var(--text-h)",
                  fontWeight: 600,
                  fontSize: "13px",
                  fontFamily: "inherit",
                  cursor:
                    acknowledgedChangeEntries.length === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity: acknowledgedChangeEntries.length === 0 ? 0.55 : 1,
                }}
              >
                Clear all acknowledged
              </button>
            </div>

            <div style={{ marginTop: "8px", marginBottom: "32px" }}>
              <button
                type="button"
                className="app-primary-btn"
                onClick={handleSaveAlertSettings}
                style={{
                  padding: "10px 22px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Save settings
              </button>
              {settingsSavedMessageVisible ? (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--accent)",
                  }}
                >
                  Settings saved.
                </p>
              ) : null}
            </div>
          </section>
        )}

        {activeTab === "audit" && (
          <section style={governanceSectionStyle}>
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
                boxShadow: "none",
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

        {activeTab === "account" &&
          (demoLoggedIn ? (
            <section
              style={{
                maxWidth: "28rem",
                margin: "0 auto",
                paddingBottom: "160px",
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
                  boxShadow: "none",
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
            <section
              style={{
                maxWidth: "420px",
                margin: "0 auto",
                paddingBottom: "160px",
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
                  boxShadow: "none",
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
                        className="unlockdb-field"
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
                        className="unlockdb-field"
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
                        className="unlockdb-field"
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
                        className="unlockdb-field"
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
                        className="unlockdb-field"
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

      {createPortal(
        <footer
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 35,
            borderTop: "1px solid #1f1f1f",
            background: "#0a0a0a",
            boxShadow: "none",
            pointerEvents: "auto",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
        <div
          style={{
            maxWidth: "1126px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 20px 14px",
            pointerEvents: "auto",
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
                messages.map((m, i) => (
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
                      {m.role === "user" ? "You:" : "AI Assistant:"}
                    </span>
                    {m.analyzing ? (
                      <span>
                        <span style={loadingDotStyle} aria-hidden>
                          ●
                        </span>{" "}
                        Analyzing...
                      </span>
                    ) : (
                      m.text
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndStickyRef} />
            </div>
          ) : null}

          <form
            onSubmit={handleCopilotSend}
            noValidate
            style={{
              width: "100%",
              position: "relative",
              zIndex: 1,
              pointerEvents: "auto",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
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
                title="Show or hide AI Assistant message history"
                aria-expanded={copilotHistoryExpanded}
              >
                {copilotHistoryExpanded ? "Hide" : "History"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "10px",
                position: "relative",
                zIndex: 1,
                pointerEvents: "auto",
              }}
            >
              {CHAT_SUGGESTION_ROWS.map((row) => (
                <div
                  key={row.map((s) => s.id).join("-")}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {row.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="ai-assistant-bar-chip"
                      onClick={() => sendChatMessage(s.prompt)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "stretch",
                width: "100%",
              }}
            >
              <input
                type="text"
                name="unlockdb-ai-assistant-command"
                autoComplete="off"
                spellCheck={false}
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  if (e.nativeEvent?.isComposing) return;
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  if (form && typeof form.requestSubmit === "function") {
                    form.requestSubmit();
                  } else {
                    handleCopilotSend(null);
                  }
                }}
                placeholder="Ask AI Assistant — e.g. what changed?, show risks, what should I fix first?"
                aria-label="AI Assistant command"
                className="unlockdb-field"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: 1,
                }}
              />
              <button
                type="submit"
                className="app-primary-btn"
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                Run
              </button>
            </div>
          </form>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "11px",
              lineHeight: 1.45,
              color: "var(--text-muted)",
              opacity: 0.9,
            }}
          >
            🔒 Only data statistics are shared with AI — never raw values
            <span style={{ color: "var(--text)" }}>
              {" "}
              · Feed:{" "}
              {changeFeedFilter === "high-risk" ? (
                <strong>HIGH risk only</strong>
              ) : (
                <strong>all</strong>
              )}
              {selectedColumn ? (
                <>
                  {" "}
                  · Column:{" "}
                  <strong>
                    {columns.find((c) => c.key === selectedColumn)?.label ??
                      selectedColumn}
                  </strong>
                </>
              ) : null}
            </span>
          </p>
        </div>
        </footer>,
        document.getElementById("root") ?? document.body
      )}
    </div>
  );
}

export default App;
