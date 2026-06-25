"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useDash } from "@/components/DataProvider";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { fmtMoney, fmtNum } from "@/lib/format";

interface AbItem {
  title: string;
  variant_title: string | null;
  quantity: number;
  price: number;
  product_id: number | null;
  url: string | null;
}
interface AbCheckout {
  id: number;
  checkout_number: string;
  created_at: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  currency: string;
  total_price: number;
  recovery_url: string;
  customer_name: string | null;
  items: AbItem[];
}

// Call-center survey — 3 dropdown questions (Arabic).
const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  {
    key: "q1",
    label: "ما الذي منعك من استكمال عملية الشراء؟",
    options: [
      "السعر",
      "تكلفة الشحن",
      "ما زلت أقارن بين المنتجات",
      "لم أجد المقاس/اللون المناسب",
      "سبب آخر",
    ],
  },
  {
    key: "q2",
    label: "هل كانت معلومات الموقع كافية لاتخاذ قرار الشراء؟",
    options: ["نعم", "لا، أحتاج معلومات أكثر عن المنتج"],
  },
  {
    key: "q3",
    label: "إذا قدمنا لك عرضًا مناسبًا، هل تنوي إتمام الشراء خلال الأسبوع الحالي؟",
    options: ["نعم", "لا", "ما زلت أفكر"],
  },
];

const CALL_STATUSES = [
  { key: "not_called", label: "Not called yet" },
  { key: "no_answer", label: "Called — no answer" },
  { key: "will_buy", label: "Called — will buy" },
  { key: "refused", label: "Called — refused" },
  { key: "recovered", label: "Recovered ✓" },
];

interface Followup {
  answers: Record<string, string>; // { q1, q2, q3 }
  call_status: string;
  note: string;
}
const emptyFollowup = (): Followup => ({ answers: {}, call_status: "not_called", note: "" });

export default function AbandonedPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const { rangeLabel, range } = useDash();
  const [showAll, setShowAll] = useState(false);
  const [allCheckouts, setAllCheckouts] = useState<AbCheckout[]>([]);
  const [followups, setFollowups] = useState<Record<string, Followup>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, fRes] = await Promise.all([
        fetch("/api/abandoned"),
        supabase.from("abandoned_followups").select("*"),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setAllCheckouts(json.checkouts ?? []);

      const map: Record<string, Followup> = {};
      for (const f of fRes.data ?? []) {
        // `reasons` jsonb now holds the survey answers object { q1, q2, q3 }.
        const answers =
          f.reasons && !Array.isArray(f.reasons) && typeof f.reasons === "object" ? f.reasons : {};
        map[f.checkout_id] = {
          answers,
          call_status: f.call_status ?? "not_called",
          note: f.note ?? "",
        };
      }
      setFollowups(map);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const fu = (id: number) => followups[String(id)] ?? emptyFollowup();

  const update = (id: number, patch: Partial<Followup>) => {
    const key = String(id);
    setFollowups((f) => ({ ...f, [key]: { ...(f[key] ?? emptyFollowup()), ...patch } }));
    setSaved((s) => ({ ...s, [key]: false }));
  };

  const setAnswer = (id: number, qKey: string, value: string) => {
    update(id, { answers: { ...fu(id).answers, [qKey]: value } });
  };

  const save = async (id: number) => {
    const key = String(id);
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const f = fu(id);
      const { error: e } = await supabase.from("abandoned_followups").upsert(
        {
          checkout_id: key,
          reasons: f.answers, // jsonb object { q1, q2, q3 }
          call_status: f.call_status,
          note: f.note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "checkout_id" }
      );
      if (e) throw e;
      setSaved((s) => ({ ...s, [key]: true }));
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  // Default to the selected month (matches the Overview's count); toggle for all.
  const checkouts = showAll
    ? allCheckouts
    : allCheckouts.filter((c) => {
        const d = (c.created_at || "").slice(0, 10);
        return d >= range.start && d <= range.end;
      });

  const totalValue = checkouts.reduce((s, c) => s + c.total_price, 0);
  const pending = checkouts.filter((c) => (fu(c.id).call_status ?? "not_called") === "not_called").length;

  return (
    <div>
      <PageHeader
        title="Abandoned Carts"
        description="Customers who reached checkout but didn't buy — call them, log the reason, recover the sale."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to Overview</Link>

        {/* scope toggle — matches the Overview when set to the month */}
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
          <button
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 font-medium ${!showAll ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {rangeLabel}
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 font-medium ${showAll ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            All ({allCheckouts.length})
          </button>
        </div>

        <button
          onClick={load}
          className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Abandoned Carts" value={fmtNum(checkouts.length)} />
        <SummaryCard label="Potential Value" value={fmtMoney(totalValue)} />
        <SummaryCard label="Not Called Yet" value={fmtNum(pending)} />
        <SummaryCard
          label="Items Left Behind"
          value={fmtNum(checkouts.reduce((s, c) => s + c.items.reduce((a, i) => a + i.quantity, 0), 0))}
        />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <div className="mt-1 text-xs text-rose-500">
            Did you run <code>migration_v6.sql</code> for the follow-ups table?
          </div>
        </div>
      )}

      <Card title={`${checkouts.length} Abandoned Checkouts`}>
        {checkouts.length === 0 ? (
          <EmptyState loading={loading} label="No abandoned carts right now." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {checkouts.map((c) => {
              const isOpen = open[c.id];
              const f = fu(c.id);
              const status = CALL_STATUSES.find((s) => s.key === f.call_status);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800">
                        {c.customer_name || c.email || c.phone || "Unknown customer"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {c.checkout_number} · {new Date(c.created_at).toLocaleString()} · {c.items.length} item(s)
                        {c.phone ? ` · ${c.phone}` : ""}
                      </div>
                    </div>
                    <Badge color={f.call_status === "recovered" ? "emerald" : f.call_status === "not_called" ? "amber" : "sky"}>
                      {status?.label ?? "Not called yet"}
                    </Badge>
                    <span className="w-28 text-right text-sm font-semibold text-gray-900">
                      {fmtMoney(c.total_price, c.currency)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid gap-5 bg-gray-50 px-5 pb-5 pt-2 lg:grid-cols-2">
                      {/* LEFT: customer + items */}
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Customer</h3>
                        <div className="mb-4 space-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                          <Row label="Checkout #" value={c.checkout_number} copyable />
                          <Row label="Name" value={c.customer_name || "—"} />
                          <Row label="Phone" value={c.phone || "—"} copyable />
                          <Row label="Email" value={c.email || "—"} copyable />
                          <Row label="City" value={c.city || "—"} />
                          <Row label="Address" value={c.address || "—"} copyable />
                        </div>

                        <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                          Products (click to open)
                        </h3>
                        <table className="w-full text-sm">
                          <tbody>
                            {c.items.map((it, idx) => (
                              <tr key={idx} className="border-t border-gray-200">
                                <td className="py-2">
                                  {it.url ? (
                                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">
                                      {it.title}{it.variant_title ? ` — ${it.variant_title}` : ""} ↗
                                    </a>
                                  ) : (
                                    <span className="text-gray-700">{it.title}</span>
                                  )}
                                </td>
                                <td className="py-2 text-right text-gray-500">×{it.quantity}</td>
                                <td className="py-2 text-right">{fmtMoney(it.price, c.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* RIGHT: call-center follow-up */}
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                          استبيان الكول سنتر · Call-center survey
                        </h3>
                        <div className="mb-3 space-y-3" dir="rtl">
                          {QUESTIONS.map((q) => (
                            <div key={q.key}>
                              <label className="mb-1 block text-sm font-medium text-gray-700">{q.label}</label>
                              <select
                                value={f.answers[q.key] ?? ""}
                                onChange={(e) => setAnswer(c.id, q.key, e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                              >
                                <option value="">— اختر —</option>
                                {q.options.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>

                        <label className="mb-1 block text-xs font-medium text-gray-500">Call status</label>
                        <select
                          value={f.call_status}
                          onChange={(e) => update(c.id, { call_status: e.target.value })}
                          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          {CALL_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>

                        <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
                        <textarea
                          value={f.note}
                          onChange={(e) => update(c.id, { note: e.target.value })}
                          rows={2}
                          placeholder="What did the customer say?"
                          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => save(c.id)}
                            disabled={saving[String(c.id)]}
                            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving[String(c.id)] ? "Saving…" : "Save"}
                          </button>
                          {saved[String(c.id)] && <span className="text-xs text-emerald-600">Saved ✓</span>}
                          {c.recovery_url && (
                            <a href={c.recovery_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-medium text-indigo-600 hover:underline">
                              Open recovery checkout ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className="flex items-center gap-2 font-medium text-gray-800">
        {value}
        {copyable && value !== "—" && (
          <button
            onClick={() => navigator.clipboard?.writeText(value)}
            className="text-xs text-indigo-500 hover:underline"
            title="Copy"
          >
            copy
          </button>
        )}
      </span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
