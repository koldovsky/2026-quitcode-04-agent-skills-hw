"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { SourceCount } from "@/lib/types";

// exceljs and recharts are large and only needed after a click, so they load on demand instead of
// with the dashboard; hover/focus starts the download early so the click itself rarely waits.
const SourcesChart = dynamic(() => import("./sources-chart").then((m) => m.SourcesChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full" />,
});

const preloadExcel = () => void import("exceljs");
const preloadChart = () => void import("./sources-chart");

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
      const [response, { default: ExcelJS }] = await Promise.all([
        fetch("/api/leads"),
        import("exceljs"),
      ]);
      const { leads } = (await response.json()) as { leads: ExportRow[] };

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
          onMouseEnter={preloadExcel}
          onFocus={preloadExcel}
          disabled={exporting}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? "Готуємо файл…" : "Експорт в Excel"}
        </button>
        <button
          type="button"
          onClick={() => setShowChart(!showChart)}
          onMouseEnter={preloadChart}
          onFocus={preloadChart}
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
