// SDK usage breakdown — most used, least used, and top orgs per SDK.
// Runs inside the canvas iframe. Available globals: React, useState, useEffect,
// useCallback, useMemo, useRef, api, useApi, Chart, Chartjs, Line, Bar, Pie,
// Doughnut, Radar, PolarArea, Bubble, Scatter.

// biome-ignore lint/correctness/noUnusedVariables: consumed as raw text by the canvas iframe runtime
function App() {
  const usage = useApi(
    "query",
    [
      "SELECT properties.$lib AS sdk, count() AS events, count(DISTINCT person_id) AS users " +
        "FROM events " +
        "WHERE timestamp >= now() - INTERVAL 7 DAY " +
        "  AND properties.$lib IS NOT NULL AND properties.$lib != '' " +
        "GROUP BY sdk ORDER BY events DESC LIMIT 20",
    ],
    [],
  );

  const topOrgs = useApi(
    "query",
    [
      "SELECT properties.$lib AS sdk, properties.$groups.organization AS org, count() AS events " +
        "FROM events " +
        "WHERE timestamp >= now() - INTERVAL 7 DAY " +
        "  AND properties.$lib IS NOT NULL AND properties.$lib != '' " +
        "  AND properties.$groups.organization IS NOT NULL " +
        "GROUP BY sdk, org ORDER BY events DESC LIMIT 200",
    ],
    [],
  );

  const orgNames = useApi(
    "query",
    [
      "SELECT key, properties.name AS name FROM groups " +
        "WHERE index = 0 AND properties.name IS NOT NULL LIMIT 500",
    ],
    [],
  );

  const [copiedOrg, setCopiedOrg] = useState(null);
  const copyOrg = (org) => {
    if (!navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(org).then(() => {
      setCopiedOrg(org);
      setTimeout(() => setCopiedOrg(null), 1200);
    });
  };

  const loading = usage.loading || topOrgs.loading;
  const anyError = usage.error || topOrgs.error;

  if (anyError) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <h2 style={S.title}>SDK usage — last 7 days</h2>
          <button
            type="button"
            onClick={() => {
              usage.refetch();
              topOrgs.refetch();
            }}
            style={S.btn}
          >
            Retry
          </button>
        </header>
        <pre style={S.error}>{String(anyError?.message || anyError)}</pre>
      </div>
    );
  }

  const rows = (usage.data?.results || []).map((r) => ({
    sdk: String(r[0]),
    events: Number(r[1]) || 0,
    users: Number(r[2]) || 0,
  }));
  const ordered = [...rows].sort((a, b) => b.events - a.events);
  const mostUsed = ordered[0];
  const leastUsed = ordered.length ? ordered[ordered.length - 1] : null;
  const totalEvents = rows.reduce((s, r) => s + r.events, 0);

  const orgRows = (topOrgs.data?.results || []).map((r) => ({
    sdk: String(r[0]),
    org: String(r[1]),
    events: Number(r[2]) || 0,
  }));

  const orgNameMap = new Map(
    (orgNames.data?.results || []).map((r) => [String(r[0]), String(r[1])]),
  );

  // Build SDK × org matrix.
  const orgTotals = new Map();
  const sdkTotals = new Map();
  for (const r of orgRows) {
    orgTotals.set(r.org, (orgTotals.get(r.org) || 0) + r.events);
    sdkTotals.set(r.sdk, (sdkTotals.get(r.sdk) || 0) + r.events);
  }
  const heatmapOrgs = [...orgTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([org]) => org);
  const heatmapSdks = [...sdkTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([sdk]) => sdk);
  const cellMap = new Map();
  for (const r of orgRows) cellMap.set(`${r.org}|${r.sdk}`, r.events);
  const maxCell = Math.max(1, ...orgRows.map((r) => r.events));
  const logMax = Math.log10(maxCell + 1);
  const cellIntensity = (v) =>
    v <= 0 ? 0 : Math.max(0.06, Math.log10(v + 1) / logMax);
  // PostHog brand orange: #f54d00 → rgb(245, 77, 0)
  const cellBg = (v) =>
    v <= 0 ? "#f2f3ee" : `rgba(245, 77, 0, ${cellIntensity(v).toFixed(3)})`;
  const cellText = (v) => (cellIntensity(v) > 0.55 ? "#fff" : "#3a4036");
  const truncId = (s) =>
    s.length > 13 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  const labelForOrg = (org) => orgNameMap.get(org) || truncId(org);

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <h2 style={S.title}>SDK usage — last 7 days</h2>
          <p style={S.subtitle}>
            Events grouped by <code style={S.code}>properties.$lib</code> · live
            HogQL
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            usage.refetch();
            topOrgs.refetch();
          }}
          style={S.btn}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section style={S.kpiRow}>
        <Kpi
          label="Most used SDK"
          value={mostUsed?.sdk || "—"}
          hint={
            mostUsed
              ? `${fmtInt(mostUsed.events)} events · ${fmtInt(mostUsed.users)} users`
              : "no data"
          }
          valueColor="#f54d00"
        />
        <Kpi
          label="Least used SDK"
          value={leastUsed?.sdk || "—"}
          hint={
            leastUsed
              ? `${fmtInt(leastUsed.events)} events · ${fmtInt(leastUsed.users)} users`
              : "no data"
          }
          valueColor="#3a4036"
        />
        <Kpi
          label="Total events"
          value={fmtInt(totalEvents)}
          hint={`${rows.length} distinct SDKs`}
        />
      </section>

      <section style={S.card}>
        <h3 style={S.cardTitle}>Events per SDK (log scale)</h3>
        <div style={{ height: 280 }}>
          {ordered.length === 0 ? (
            <p style={S.empty}>No SDK events captured in this window.</p>
          ) : (
            <Bar
              data={{
                labels: ordered.map((r) => r.sdk),
                datasets: [
                  {
                    label: "Events",
                    data: ordered.map((r) => r.events),
                    backgroundColor: ordered.map(
                      (_, i, arr) =>
                        // PostHog orange, fading along rank — top bar gets full brand
                        `rgba(245, 77, 0, ${(0.95 - (i / Math.max(1, arr.length - 1)) * 0.65).toFixed(2)})`,
                    ),
                  },
                ],
              }}
              options={{
                ...chartOpts(),
                indexAxis: "y",
                scales: {
                  x: {
                    type: "logarithmic",
                    grid: { color: "rgba(58, 64, 54, 0.08)" },
                    ticks: {
                      font: { size: 10 },
                      callback: (v) => fmtInt(Number(v)),
                    },
                  },
                  y: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } },
                  },
                },
              }}
            />
          )}
        </div>
      </section>

      <section style={S.card}>
        <h3 style={S.cardTitle}>
          SDK × organization (top 12 orgs, top 7 SDKs)
        </h3>
        {heatmapOrgs.length === 0 ? (
          <p style={S.empty}>No organization-attributed events.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `120px repeat(${heatmapSdks.length}, 1fr)`,
              gap: 2,
              fontSize: 11,
            }}
          >
            <div style={S.hmCorner} />
            {heatmapSdks.map((sdk) => (
              <div key={`h-${sdk}`} style={S.hmColHeader} title={sdk}>
                {sdk}
              </div>
            ))}
            {heatmapOrgs.map((org) => (
              <React.Fragment key={`row-${org}`}>
                <button
                  type="button"
                  onClick={() => copyOrg(org)}
                  style={{
                    ...S.hmRowHeader,
                    ...(copiedOrg === org ? S.hmRowHeaderCopied : null),
                  }}
                  title={`${orgNameMap.get(org) ? `${orgNameMap.get(org)} · ` : ""}${org}\nClick to copy organization id`}
                >
                  {copiedOrg === org ? "Copied" : labelForOrg(org)}
                </button>
                {heatmapSdks.map((sdk) => {
                  const v = cellMap.get(`${org}|${sdk}`) || 0;
                  return (
                    <div
                      key={`c-${org}-${sdk}`}
                      style={{
                        ...S.hmCell,
                        background: cellBg(v),
                        color: cellText(v),
                      }}
                      title={`${labelForOrg(org)} · ${sdk}\n${v.toLocaleString()} events`}
                    >
                      {v > 0 ? fmtInt(v) : ""}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
        <div style={S.hmLegend}>
          <span>Less</span>
          <div style={S.hmRamp}>
            {[0.08, 0.2, 0.35, 0.55, 0.8, 1.0].map((a) => (
              <span
                key={a}
                style={{
                  ...S.hmRampStop,
                  background: `rgba(245, 77, 0, ${a})`,
                }}
              />
            ))}
          </div>
          <span>More (log-scaled)</span>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, valueColor }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color: valueColor || "#0d0d0d" }}>
        {value}
      </div>
      <div style={S.kpiHint}>{hint}</div>
    </div>
  );
}

function fmtInt(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };
}

// PostHog palette — sampled from app globals.css (light theme).
// gray-1 #f2f3ee · gray-3 #e4e5de · gray-5 #cbd0c3 · gray-9 #6b7165
// gray-10 #5a6054 · gray-11 #3a4036 · gray-12 #0d0d0d
// orange-1 #fff5f0 · orange-3 #ffd0b8 · orange-9 #f54d00 · orange-11 #a33300
const S = {
  page: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    padding: 16,
    color: "#3a4036",
    background: "#f2f3ee",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: "#0d0d0d" },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "#6b7165" },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    background: "#e4e5de",
    color: "#3a4036",
    padding: "1px 4px",
    borderRadius: 3,
  },
  btn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #cbd0c3",
    background: "#fff",
    color: "#3a4036",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  kpi: {
    border: "1px solid #e4e5de",
    borderRadius: 8,
    padding: 12,
    background: "#fff",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#6b7165",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  kpiValue: { fontSize: 20, fontWeight: 600, marginTop: 4 },
  kpiHint: { fontSize: 11, color: "#93998a", marginTop: 2 },
  card: {
    border: "1px solid #e4e5de",
    borderRadius: 8,
    padding: 12,
    background: "#fff",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: 13,
    fontWeight: 600,
    color: "#0d0d0d",
  },
  empty: { color: "#93998a", fontSize: 13, margin: 0 },
  error: {
    color: "#a33300",
    padding: 12,
    background: "#fff5f0",
    border: "1px solid #ffd0b8",
    borderRadius: 6,
    fontSize: 12,
    whiteSpace: "pre-wrap",
  },
  hmCorner: { background: "transparent" },
  hmColHeader: {
    padding: "4px 6px",
    fontSize: 10,
    fontWeight: 600,
    color: "#3a4036",
    background: "#f2f3ee",
    borderRadius: 4,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  hmRowHeader: {
    padding: "4px 6px",
    fontSize: 10,
    fontWeight: 500,
    color: "#3a4036",
    background: "#f2f3ee",
    borderRadius: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
    border: "1px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  hmRowHeaderCopied: {
    background: "#fff5f0",
    color: "#a33300",
    borderColor: "#ffd0b8",
  },
  hmCell: {
    padding: "6px 4px",
    fontSize: 10,
    fontWeight: 500,
    textAlign: "center",
    borderRadius: 3,
    cursor: "default",
  },
  hmLegend: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    color: "#6b7165",
  },
  hmRamp: { display: "flex", gap: 2 },
  hmRampStop: {
    width: 18,
    height: 10,
    borderRadius: 2,
    display: "inline-block",
  },
};
