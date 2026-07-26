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

  return (
    <div>
      <PageHeader title="Summary" description="Orders & value by channel — branches vs online — for a day or a range." />

      {/* Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
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
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5" />
            <span className="text-gray-400">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5" />
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
        <div className="overflow-x-auto rounded-2xl border-2 border-orange-300 shadow-sm">
          <table className="w-full border-collapse text-center text-sm">
            <tbody>
              <HeaderRow label="Channel" cols={cols} render={(c) => (c === "Total" ? "Total" : data.channels.find((x) => x.label === c)?.type ?? "")} />
              <HeaderRow label="Location" cols={cols} render={(c) => (c === "Total" ? String(data.channels.length) : c)} />
              <DataRow label={`Orders (${periodLabel})`} cols={cols} block={data.period} kind="orders" />
              <DataRow label={`Value (${periodLabel})`} cols={cols} block={data.period} kind="value" />
              <DataRow label="MTD Orders" cols={cols} block={data.mtd} kind="orders" compareBlock={data.lastMonth} />
              <DataRow label="MTD Value" cols={cols} block={data.mtd} kind="value" compareBlock={data.lastMonth} />
              <DataRow label="Orders Last Month" cols={cols} block={data.lastMonth} kind="orders" />
              <DataRow label="Amount Last Month" cols={cols} block={data.lastMonth} kind="value" />
            </tbody>
          </table>
        </div>
      )}

      {loading && data && <p className="mt-2 text-xs text-gray-400">Refreshing…</p>}
    </div>
  );
}

function HeaderRow({ label, cols, render }: { label: string; cols: string[]; render: (c: string) => string }) {
  return (
    <tr>
      <th className="border border-orange-200 bg-orange-400 px-4 py-2.5 text-left font-bold text-white">{label}</th>
      {cols.map((c) => (
        <th key={c} className={`border border-gray-200 px-4 py-2.5 font-bold ${c === "Total" ? "bg-gray-100" : "bg-white"}`}>
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
  highlight,
  compareBlock,
}: {
  label: string;
  cols: string[];
  block: Block;
  kind: "orders" | "value";
  highlight?: boolean;
  compareBlock?: Block; // when set: green if cell > compare, red if less (vs last month)
}) {
  return (
    <tr>
      <th className="border border-orange-200 bg-orange-400 px-4 py-2.5 text-left font-semibold text-white">{label}</th>
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
          else cls = isTotal ? "bg-gray-100 font-bold" : "";
        } else {
          cls = isTotal ? (highlight ? "bg-emerald-500 font-bold text-white" : "bg-gray-100 font-bold") : "";
          if (v < 0 && !(isTotal && highlight)) cls += " text-rose-600";
        }
        return (
          <td key={c} className={`border border-gray-200 px-4 py-2.5 font-medium ${cls}`}>
            {kind === "orders" ? fmtNum(v) : money(v)}
          </td>
        );
      })}
    </tr>
  );
}
