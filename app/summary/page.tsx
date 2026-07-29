"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui";
import { fmtNum } from "@/lib/format";

type Cell = { orders: number; value: number };
type Block = Record<string, Cell>;
interface SummaryResp {
  ok: boolean;
  error?: string;
  channels: { label: string; type: "Branches" | "Online" }[];
  period: Block;
  mtd: Block;
  lastMonth: Block;
  meta: { from: string; to: string; single: boolean };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
const money = (n: number) => fmtNum(Math.round(n));

export default function SummaryPage() {
  const [mode, setMode] = useState<"day" | "range">("day");
  const [day, setDay] = useState(yesterdayStr());
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<SummaryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => (mode === "day" ? `day=${day}` : `from=${from}&to=${to}`),
    [mode, day, from, to]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/summary?${query}`)
      .then((r) => r.json())
      .then((j: SummaryResp) => {
        if (!alive) return;
        if (j.ok) setData(j);
        else setError(j.error || "Failed to load summary");
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  const cols = data ? [...data.channels.map((c) => c.label), "Total"] : [];
  const periodLabel = data
    ? data.meta.single
      ? data.meta.from
      : `${data.meta.from} → ${data.meta.to}`
    : "";

  // Average order value (MTD) per column = value / orders.
  const aov: Block = useMemo(() => {
    const out: Block = {};
    if (data) for (const c of cols) {
      const m = data.mtd[c];
      out[c] = { orders: 0, value: m && m.orders ? m.value / m.orders : 0 };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div>
      <PageHeader title="Summary" description="Orders & value by channel — branches vs online — for a day or a range." />

      {/* Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
          <button
            onClick={() => setMode("day")}
            className={`px-3 py-1.5 font-medium ${mode === "day" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Single day
          </button>
          <button
            onClick={() => setMode("range")}
            className={`px-3 py-1.5 font-medium ${mode === "range" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Range
          </button>
        </div>

        {mode === "day" ? (
          <>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button onClick={() => setDay(yesterdayStr())} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Yesterday</button>
            <button onClick={() => setDay(todayStr())} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Today</button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5" />
            <span className="text-gray-400">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5" />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error === "Invalid token"
            ? "Odoo rejected the API key (Invalid token) — update ODOO_API_TOKEN in Vercel to the production token and redeploy."
            : error}
        </div>
      )}

      {!data || cols.length === 0 ? (
        <EmptyState loading={loading} label="No data for this selection." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-orange-300/70 shadow-sm ring-1 ring-black/5">
          <table className="w-full table-fixed border-collapse text-center text-[11px] leading-tight sm:text-sm">
            <colgroup>
              <col className="w-[26%] sm:w-[24%]" />
            </colgroup>
            <tbody>
              <HeaderRow
                label="Channel"
                cols={cols}
                top
                render={(c) => (c === "Total" ? "Total" : data.channels.find((x) => x.label === c)?.type ?? "")}
              />
              <HeaderRow
                label="Location"
                cols={cols}
                render={(c) => (c === "Total" ? String(data.channels.length) : c)}
                strong
              />
              <DataRow label={<>Orders <span className="opacity-70">{periodLabel}</span></>} cols={cols} block={data.period} kind="orders" />
              <DataRow label={<>Value <span className="opacity-70">{periodLabel}</span></>} cols={cols} block={data.period} kind="value" />
              <DataRow label="MTD Orders" cols={cols} block={data.mtd} kind="orders" compareBlock={data.lastMonth} groupTop />
              <DataRow label="MTD Value" cols={cols} block={data.mtd} kind="value" compareBlock={data.lastMonth} />
              <DataRow label="Avg Order Value" cols={cols} block={aov} kind="value" accent />
              <DataRow label="Orders Last Month" cols={cols} block={data.lastMonth} kind="orders" groupTop muted />
              <DataRow label="Amount Last Month" cols={cols} block={data.lastMonth} kind="value" muted />
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {data && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" /> MTD above last month</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" /> MTD below last month</span>
          <span>· Avg Order Value = MTD value ÷ orders</span>
          {loading && <span className="text-gray-400">· Refreshing…</span>}
        </div>
      )}
    </div>
  );
}

function HeaderRow({
  label,
  cols,
  render,
  top,
  strong,
}: {
  label: string;
  cols: string[];
  render: (c: string) => string;
  top?: boolean;
  strong?: boolean;
}) {
  return (
    <tr>
      <th className={`border-b border-orange-300/50 bg-gradient-to-r from-orange-500 to-orange-400 px-2 py-2 text-left font-bold text-white sm:px-4 ${top ? "rounded-tl-2xl" : ""}`}>
        {label}
      </th>
      {cols.map((c, i) => (
        <th
          key={c}
          className={`border-b border-l border-gray-200 px-1 py-2 font-bold sm:px-3 ${
            c === "Total" ? "bg-slate-100 text-slate-700" : "bg-orange-50/40 text-gray-700"
          } ${strong ? "text-[13px] sm:text-base" : ""} ${top && i === cols.length - 1 ? "rounded-tr-2xl" : ""}`}
        >
          {render(c)}
        </th>
      ))}
    </tr>
  );
}

function DataRow({
  label,
  cols,
  block,
  kind,
  compareBlock,
  accent,
  muted,
  groupTop,
}: {
  label: React.ReactNode;
  cols: string[];
  block: Block;
  kind: "orders" | "value";
  compareBlock?: Block; // when set: green if cell > compare, red if less (vs last month)
  accent?: boolean; // subtle highlight row (e.g. Avg Order Value)
  muted?: boolean; // dimmer rows (last month)
  groupTop?: boolean; // thicker top border to separate groups
}) {
  const sep = groupTop ? "border-t-2 border-t-orange-200" : "";
  return (
    <tr className={sep}>
      <th className={`bg-gradient-to-r from-orange-500 to-orange-400 px-2 py-2 text-left align-middle font-semibold text-white sm:px-4 ${accent ? "italic" : ""}`}>
        {label}
      </th>
      {cols.map((c) => {
        const cell = block[c];
        const v = cell ? (kind === "orders" ? cell.orders : cell.value) : 0;
        const isTotal = c === "Total";
        let cls = "";
        if (compareBlock) {
          const cc = compareBlock[c];
          const cv = cc ? (kind === "orders" ? cc.orders : cc.value) : 0;
          if (v > cv) cls = isTotal ? "bg-emerald-500 font-bold text-white" : "bg-emerald-50 font-semibold text-emerald-700";
          else if (v < cv) cls = isTotal ? "bg-rose-500 font-bold text-white" : "bg-rose-50 font-semibold text-rose-700";
          else cls = isTotal ? "bg-slate-100 font-bold" : "";
        } else {
          cls = isTotal ? "bg-slate-100 font-bold" : accent ? "bg-amber-50/60 text-amber-800" : muted ? "text-gray-500" : "";
          if (v < 0) cls += " text-rose-600";
        }
        return (
          <td key={c} className={`border-l border-t border-gray-100 px-1 py-2 font-medium tabular-nums sm:px-3 ${cls}`}>
            {kind === "orders" ? fmtNum(v) : money(v)}
          </td>
        );
      })}
    </tr>
  );
}
