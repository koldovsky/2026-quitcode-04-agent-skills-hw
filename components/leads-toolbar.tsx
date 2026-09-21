"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { SourceCount } from "@/lib/types";

// recharts is only needed after "Показати графік": load it on demand (bundle-dynamic-imports).
// ssr: false is allowed here because this is a Client Component.
const SourcesChart = dynamic(() => import("./sources-chart").then((m) => m.SourcesChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded bg-slate-100" />,
});

type ExportRow = {
  id: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  createdAt: string;
};

export function LeadsToolbar({ sources }: { sources: SourceCount[] }) {
  const [showChart, setShowChart] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch("/api/leads");
      const { leads } = (await response.json()) as { leads: ExportRow[] };

      // exceljs (~900 KB) is only needed for the export itself (bundle-conditional).
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Leads");
      sheet.columns = [
        { header: "ID", key: "id", width: 12 },
        { header: "Контакт", key: "fullName", width: 28 },
        { header: "Компанія", key: "company", width: 24 },
        { header: "Email", key: "email", width: 34 },
        { header: "Телефон", key: "phone", width: 18 },
        { header: "Статус", key: "status", width: 14 },
        { header: "Джерело", key: "source", width: 16 },
        { header: "Створено", key: "createdAt", width: 22 },
      ];
      sheet.addRows(leads);
      sheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? "Готуємо файл…" : "Експорт в Excel"}
        </button>
        <button
          type="button"
          onClick={() => setShowChart(!showChart)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {showChart ? "Сховати графік" : "Показати графік джерел"}
        </button>
      </div>
      {showChart && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <SourcesChart data={sources} />
        </div>
      )}
    </div>
  );
}
