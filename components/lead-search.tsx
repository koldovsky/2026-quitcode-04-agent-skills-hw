"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import type { LeadListItem } from "@/lib/types";

type SearchRow = Pick<LeadListItem, "id" | "fullName" | "company" | "email">;

const MAX_RESULTS = 8;

// The rows come from the server page (the same list the table shows): no second
// request to /api/leads from an effect, no empty state while it loads.
export function LeadSearch({ rows }: { rows: SearchRow[] }) {
  const [query, setQuery] = useState("");
  // Matches are derived during render; useDeferredValue keeps typing responsive
  // instead of a debounced setState in an effect.
  const deferredQuery = useDeferredValue(query);
  const needle = deferredQuery.trim().toLowerCase();
  const matches = needle
    ? rows
        .filter((row) => [row.fullName, row.company, row.email].some((field) => field.toLowerCase().includes(needle)))
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="block text-sm font-medium">
        Пошук лідів
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ім'я, компанія або email"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      {matches.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {matches.map((row) => (
            <li key={row.id} className="py-2">
              <Link href={`/dashboard/leads/${row.id}`} className="font-medium hover:underline">
                {row.fullName}
              </Link>
              <span className="text-slate-500">
                {" "}
                · {row.company} · {row.email}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
