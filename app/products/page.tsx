"use client";

import { useMemo, useState } from "react";
import { useDash } from "@/components/DataProvider";
import { Card, PageHeader, Kpi, EmptyState, Badge } from "@/components/ui";
import { fmtMoney, fmtNum } from "@/lib/format";

type SortKey = "units_sold" | "revenue" | "title";

export default function ProductsPage() {
  const { bestSellers, loading } = useDash();
  const [sort, setSort] = useState<SortKey>("units_sold");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    let r = bestSellers.filter((b) => b.title.toLowerCase().includes(q.toLowerCase()));
    r = [...r].sort((a, b) => {
      let cmp = 0;
      if (sort === "title") cmp = a.title.localeCompare(b.title);
      else cmp = Number(a[sort]) - Number(b[sort]);
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [bestSellers, sort, dir, q]);

  const totalUnits = bestSellers.reduce((s, b) => s + Number(b.units_sold), 0);
  const totalRevenue = bestSellers.reduce((s, b) => s + Number(b.revenue), 0);
  const maxUnits = Math.max(...bestSellers.map((b) => Number(b.units_sold)), 1);

  const toggle = (key: SortKey) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir("desc");
    }
  };
  const arrow = (key: SortKey) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <PageHeader title="Products" description="Best-selling products for the selected month." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Distinct Products" value={fmtNum(bestSellers.length)} icon="🛍️" accent="indigo" />
        <Kpi label="Total Units Sold" value={fmtNum(totalUnits)} icon="📦" accent="amber" />
        <Kpi label="Product Revenue" value={fmtMoney(totalRevenue)} icon="💰" accent="emerald" />
      </div>

      <Card
        title="Best Sellers"
        action={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product…"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
        }
      >
        {bestSellers.length === 0 ? (
          <EmptyState loading={loading} label="No product sales this month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="cursor-pointer px-5 py-3 select-none" onClick={() => toggle("title")}>
                    Product{arrow("title")}
                  </th>
                  <th className="cursor-pointer px-5 py-3 text-right select-none" onClick={() => toggle("units_sold")}>
                    Units Sold{arrow("units_sold")}
                  </th>
                  <th className="px-5 py-3">Share</th>
                  <th className="cursor-pointer px-5 py-3 text-right select-none" onClick={() => toggle("revenue")}>
                    Revenue{arrow("revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => (
                  <tr key={`${b.product_id}-${i}`} className="border-t hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Badge color={i === 0 && sort === "units_sold" && dir === "desc" ? "amber" : "gray"}>
                        {i + 1}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{b.title}</td>
                    <td className="px-5 py-3 text-right font-semibold">{fmtNum(Number(b.units_sold))}</td>
                    <td className="px-5 py-3">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(Number(b.units_sold) / maxUnits) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmtMoney(Number(b.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
