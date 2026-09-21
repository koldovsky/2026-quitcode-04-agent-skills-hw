"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { debounce } from "lodash";

type SearchRow = {
  id: string;
  fullName: string;
  company: string;
  email: string;
  status: string;
};

export function LeadSearch() {
  const [leads, setLeads] = useState<SearchRow[]>([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<SearchRow[]>([]);

  useEffect(() => {
    fetch("/api/leads")
      .then((response) => response.json())
      .then((data: { leads: SearchRow[] }) => setLeads(data.leads));
  }, []);

  const applyFilter = useMemo(
    () =>
      debounce((value: string, rows: SearchRow[]) => {
        const needle = value.trim().toLowerCase();
        setFiltered(
          needle
            ? rows.filter((row) =>
                [row.fullName, row.company, row.email].some((field) =>
                  field.toLowerCase().includes(needle),
                ),
              )
            : [],
        );
      }, 250),
    [],
  );

  useEffect(() => {
    applyFilter(query, leads);
  }, [query, leads, applyFilter]);

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
      {filtered.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {filtered.slice(0, 8).map((row) => (
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
