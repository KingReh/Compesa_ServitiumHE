/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { MONTHS, YEARS } from "../utils/dateUtils";
import { Calendar } from "lucide-react";

interface PeriodSelectorProps {
  monthIndex: number;
  year: number;
  onPeriodChange: (monthIndex: number, year: number) => void;
}

export default function PeriodSelector({ monthIndex, year, onPeriodChange }: PeriodSelectorProps) {
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPeriodChange(parseInt(e.target.value, 10), year);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPeriodChange(monthIndex, parseInt(e.target.value, 10));
  };

  return (
    <div id="card-periodo" className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between border-b border-[#1e2029] pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500" />
          <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider font-sans">
            01 — Período de Apuração
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full active-pulse-glow"></span>
          <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase">EM APURAÇÃO</span>
        </div>
      </div>

      {/* Dropdowns */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="select-mes" className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">MÊS</label>
          <select
            id="select-mes"
            value={monthIndex}
            onChange={handleMonthChange}
            className="w-full bg-[#181921] border border-[#262836] text-xs text-[#f8fafc] rounded px-2 py-2 focus:outline-none focus:border-orange-500 font-sans font-medium"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx} className="bg-[#181921]">{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="select-ano" className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">ANO</label>
          <select
            id="select-ano"
            value={year}
            onChange={handleYearChange}
            className="w-full bg-[#181921] border border-[#262836] text-xs text-[#f8fafc] rounded px-2 py-2 focus:outline-none focus:border-orange-500 font-sans font-medium"
          >
            {YEARS.map(y => (
              <option key={y} value={parseInt(y, 10)} className="bg-[#181921]">{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
