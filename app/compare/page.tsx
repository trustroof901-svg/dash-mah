"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, PageHeader, Delta } from "@/components/ui";
import { METRICS, fmtByKind, zeroMetric } from "@/lib/metrics";
import { toISODate } from "@/lib/format";
import type { DailyMetric } from "@/lib/types";

export default function ComparePage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const today = useMemo(() => new Date(), []);
  const [a, setA] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)));
  const [b, setB] = useState(toISODate(today));
  const [da, setDa] = useState<DailyMetric | null>(null);
  const [db, setDb] = useState<DailyMetric | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("daily_metrics").select("*").in("day", [a, b]);
      const arr = (data as DailyMetric[]) ?? [];
      setDa(arr.find((x) => x.day === a) ?? zeroMetric(a));
      setDb(arr.find((x) => x.day === b) ?? zeroMetric(b));
    } finally {
      setLoading(false);
    }
  }, [supabase, a, b]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Compare Days" description="Pick any two days and see how every metric changed." />

      <Card
        title="Day vs Day"
        action={
          <div className="flex items-center gap-2">
            <input type="date" value={a} onChange={(e) => setA(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
            <span className="text-gray-400">vs</span>
            <input type="date" value={b} onChange={(e) => setB(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Metric</th>
                <th className="px-5 py-3 text-right">{prettyDate(a)}</th>
                <th className="px-5 py-3 text-right">{prettyDate(b)}</th>
                <th className="px-5 py-3 text-right">Change</th>
                <th className="px-5 py-3 text-right">% Change</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((def) => {
                const av = da ? def.daily(da) : 0;
                const bv = db ? def.daily(db) : 0;
                const delta = bv - av;
                const pct = av !== 0 ? delta / av : 0;
                const up = delta > 0;
                const down = delta < 0;
                return (
                  <tr key={def.key} className="border-t">
                    <td className="px-5 py-3 font-medium text-gray-700">{def.label}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{fmtByKind(av, def.kind)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtByKind(bv, def.kind)}</td>
                    <td className={`px-5 py-3 text-right ${up ? "text-emerald-600" : down ? "text-rose-600" : "text-gray-400"}`}>
                      {delta === 0 ? "—" : `${up ? "+" : "−"}${fmtByKind(Math.abs(delta), def.kind)}`}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {def.kind === "pct" || av === 0 ? <span className="text-gray-400">—</span> : <Delta value={pct} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-5 py-2 text-xs text-gray-400">Loading…</div>}
      </Card>
    </div>
  );
}

function prettyDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
