"use client";

import { useState } from "react";

// Shared call-center password. Set NEXT_PUBLIC_CC_PASSWORD in your env to change it.
const PASSWORD = process.env.NEXT_PUBLIC_CC_PASSWORD || "callcenter";

/**
 * Call-center login. On success it flags the browser into "cc_mode" so the
 * sidebar shows only Abandoned Carts, Create Order and Sample Inquiries.
 * Does NOT affect the normal admin dashboard (which has no login).
 */
export default function TeamLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) {
      localStorage.setItem("cc_mode", "1");
      // full reload so the shell picks up the restricted mode immediately
      window.location.href = "/abandoned";
    } else {
      setErr("Wrong password. Try again.");
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-1 text-center text-2xl">🛒</div>
        <h1 className="mb-1 text-center text-xl font-bold text-gray-900">Call Center Login</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Sign in to manage abandoned carts and create orders.
        </p>
        <label className="mb-1 block text-xs font-medium text-gray-500">Password</label>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="Enter password"
        />
        {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
