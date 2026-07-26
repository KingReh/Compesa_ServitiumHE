/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { DailyEntry } from "../types";
import { getDaysInMonth, getDayOfWeekName, isWeekend, getHolidayName } from "../utils/dateUtils";
import { applyTimeMask, normalizeTimeOnBlur, isValidTime } from "../utils/hours";
import { Table, Keyboard, AlertCircle, Copy, CornerDownRight, Check, X, Sliders } from "lucide-react";

interface DailyLaunchTableProps {
  monthIndex: number;
  year: number;
  launches: DailyEntry[];
  onLaunchChange: (dateStr: string, field: "he50" | "he100" | "adNoturno50" | "adNoturno100", value: string) => void;
  onBulkFillColumn: (field: "he50" | "he100" | "adNoturno50" | "adNoturno100", value: string, onlyWeekdays: boolean) => void;
}

export default function DailyLaunchTable({
  monthIndex,
  year,
  launches,
  onLaunchChange,
  onBulkFillColumn
}: DailyLaunchTableProps) {
  const totalDays = getDaysInMonth(monthIndex, year);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple feedback when invalid format is typed
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: boolean }>({});

  // Custom bulk fill modal state
  const [bulkModal, setBulkModal] = useState<{
    field: "he50" | "he100" | "adNoturno50" | "adNoturno100" | null;
    onlyWeekdays: boolean;
    value: string;
    error: string | null;
  }>({
    field: null,
    onlyWeekdays: true,
    value: "",
    error: null
  });

  const handleInputChange = (
    dateStr: string,
    field: "he50" | "he100" | "adNoturno50" | "adNoturno100",
    value: string
  ) => {
    // Apply HH:MM mask
    const masked = applyTimeMask(value);
    onLaunchChange(dateStr, field, masked);
    
    // Clear validation error on active typing
    const errKey = `${dateStr}-${field}`;
    if (validationErrors[errKey]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  const handleInputBlur = (
    dateStr: string,
    field: "he50" | "he100" | "adNoturno50" | "adNoturno100",
    value: string
  ) => {
    const normalized = normalizeTimeOnBlur(value);
    onLaunchChange(dateStr, field, normalized === "00:00" && !value ? "" : normalized);

    const errKey = `${dateStr}-${field}`;
    const valid = isValidTime(normalized);
    
    if (!valid && value.trim() !== "") {
      setValidationErrors(prev => ({ ...prev, [errKey]: true }));
    } else {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
  };

  // Excel-style Keyboard Navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    dayNum: number,
    colIdx: number // 0: he50, 1: he100, 2: adNoturno50, 3: adNoturno100
  ) => {
    const fields = ["he50", "he100", "adNoturno50", "adNoturno100"];
    let targetDay = dayNum;
    let targetCol = colIdx;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      targetDay = dayNum - 1;
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      targetDay = dayNum + 1;
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      if (input.selectionStart === 0) {
        e.preventDefault();
        targetCol = colIdx - 1;
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      if (input.selectionEnd === input.value.length) {
        e.preventDefault();
        targetCol = colIdx + 1;
      }
    } else {
      return;
    }

    if (targetDay < 1) targetDay = 1;
    if (targetDay > totalDays) targetDay = totalDays;
    if (targetCol < 0) targetCol = 0;
    if (targetCol > 3) targetCol = 3;

    const targetId = `input-day-${targetDay}-${fields[targetCol]}`;
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      (targetElement as HTMLInputElement).focus();
      (targetElement as HTMLInputElement).select();
    }
  };

  const openBulkModal = (field: "he50" | "he100" | "adNoturno50" | "adNoturno100", onlyWeekdays: boolean) => {
    setBulkModal({
      field,
      onlyWeekdays,
      value: "",
      error: null
    });
  };

  const handleApplyBulkFill = () => {
    const { field, onlyWeekdays, value } = bulkModal;
    if (!field) return;

    let normalized = "00:00";
    if (value.trim() !== "") {
      normalized = normalizeTimeOnBlur(value);
      if (!isValidTime(normalized)) {
        setBulkModal(prev => ({ ...prev, error: "Formato de hora inválido. Use HH:MM" }));
        return;
      }
    } else {
      normalized = "";
    }

    onBulkFillColumn(field, normalized, onlyWeekdays);
    setBulkModal({ field: null, onlyWeekdays: true, value: "", error: null });
  };

  const getFieldNameLabel = (f: string) => {
    switch (f) {
      case "he50": return "Hora Extra 50%";
      case "he100": return "Hora Extra 100%";
      case "adNoturno50": return "Adicional Noturno 50%";
      case "adNoturno100": return "Adicional Noturno 100%";
      default: return "";
    }
  };

  return (
    <div id="card-tabela-lancamentos" className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-sm p-4 relative">
      {/* Header and tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1e2029] pb-2 mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-orange-500" />
          <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider font-sans">
            03 — Lançamentos Diários de Horas
          </h2>
        </div>
        

      </div>

      {/* Launch Table Scroll Container */}
      <div ref={containerRef} className="overflow-x-auto border border-[#1e2029] bg-[#0a0b0d] rounded-md max-h-[464px] overflow-y-auto hover:border-orange-500/20 focus-within:border-orange-500/30 transition-all duration-300 shadow-inner">
        <table className="w-full text-left border-collapse font-sans min-w-[700px]">
          <thead className="bg-[#181921] text-[9px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-30 shadow-sm border-b border-[#1e2029]">
            <tr>
              <th className="py-2 px-4 border-b border-[#1e2029] w-28 font-mono text-center">DATA</th>
              <th className="py-2 px-4 border-b border-[#1e2029] w-20 font-mono text-center">SEMANA</th>
              <th className="py-2 px-4 border-b border-[#1e2029] text-center w-36 font-mono">HE 50%</th>
              <th className="py-2 px-4 border-b border-[#1e2029] text-center w-36 font-mono">HE 100%</th>
              <th className="py-2 px-4 border-b border-[#1e2029] text-center w-36 font-mono">AD. NOTURNO 50%</th>
              <th className="py-2 px-4 border-b border-[#1e2029] text-center w-36 font-mono">AD. NOTURNO 100%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2029]/60">
            {Array.from({ length: totalDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayStr = String(dayNum).padStart(2, "0");
              const mStr = String(monthIndex + 1).padStart(2, "0");
              const dateStr = `${dayStr}/${mStr}/${year}`;
              
              const dayOfWeek = getDayOfWeekName(dayNum, monthIndex, year);
              const isWknd = isWeekend(dayNum, monthIndex, year);
              const holidayName = getHolidayName(dayNum, monthIndex, year);

              const entry = launches[idx] || {
                dateStr,
                dayOfWeek,
                he50: "",
                he100: "",
                adNoturno50: "",
                adNoturno100: ""
              };

              // Background row colors for high-density readability matching mockup
              let rowBg = "hover:bg-[#1c1d27]/70 transition-colors";
              if (holidayName) {
                rowBg = "bg-rose-950/15 hover:bg-[#1c1d27]/70 transition-colors";
              } else if (isWknd) {
                rowBg = "bg-zinc-950/40 hover:bg-[#1c1d27]/70 transition-colors";
              }

              return (
                <tr key={dateStr} className={rowBg}>
                  {/* Date Column */}
                  <td className="py-2 px-4 font-mono text-xs whitespace-nowrap border-r border-[#1e2029]/30 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="font-bold text-[#f8fafc]">{dateStr}</span>
                      {holidayName && (
                        <span className="text-[8px] text-rose-400 font-sans font-semibold mt-1 truncate max-w-[120px]" title={holidayName}>
                          {holidayName}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Day of Week Column */}
                  <td className="py-2 px-4 text-xs border-r border-[#1e2029]/30 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] font-bold font-mono uppercase ${
                      holidayName ? "bg-rose-950/50 border border-rose-900/60 text-rose-400" :
                      isWknd ? "bg-zinc-800/60 border border-zinc-700/60 text-slate-300" : "bg-[#181921] border border-[#262836] text-slate-400"
                    }`}>
                      {dayOfWeek}
                    </span>
                  </td>

                  {/* HE 50% Input */}
                  <td className="py-1 px-2">
                    <div className="relative group/cell">
                      <input
                        id={`input-day-${dayNum}-he50`}
                        type="text"
                        placeholder="—"
                        value={entry.he50}
                        onChange={(e) => handleInputChange(dateStr, "he50", e.target.value)}
                        onBlur={(e) => handleInputBlur(dateStr, "he50", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, dayNum, 0)}
                        className={`w-full bg-[#181921] border rounded py-2 px-6 text-xs text-center font-mono focus:outline-none transition-all ${
                          validationErrors[`${dateStr}-he50`]
                            ? "border-rose-500/80 bg-rose-950/25 text-rose-300 px-8"
                            : "border-[#262836] text-[#f8fafc] focus:border-orange-500 focus:bg-[#222430]"
                        }`}
                      />
                      {entry.he50 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange(dateStr, "he50", "");
                            handleInputBlur(dateStr, "he50", "");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-[#262836] transition-colors cursor-pointer opacity-0 group-hover/cell:opacity-100 focus:opacity-100 z-10"
                          title="Limpar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {validationErrors[`${dateStr}-he50`] && (
                        <AlertCircle className="w-3 h-3 text-rose-500 absolute right-6 top-1/2 -translate-y-1/2 animate-fadeIn" />
                      )}
                    </div>
                  </td>

                  {/* HE 100% Input */}
                  <td className="py-1 px-2">
                    <div className="relative group/cell">
                      <input
                        id={`input-day-${dayNum}-he100`}
                        type="text"
                        placeholder="—"
                        value={entry.he100}
                        onChange={(e) => handleInputChange(dateStr, "he100", e.target.value)}
                        onBlur={(e) => handleInputBlur(dateStr, "he100", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, dayNum, 1)}
                        className={`w-full bg-[#181921] border rounded py-2 px-6 text-xs text-center font-mono focus:outline-none transition-all ${
                          validationErrors[`${dateStr}-he100`]
                            ? "border-rose-500/80 bg-rose-950/25 text-rose-300 px-8"
                            : "border-[#262836] text-[#f8fafc] focus:border-orange-500 focus:bg-[#222430]"
                        }`}
                      />
                      {entry.he100 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange(dateStr, "he100", "");
                            handleInputBlur(dateStr, "he100", "");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-[#262836] transition-colors cursor-pointer opacity-0 group-hover/cell:opacity-100 focus:opacity-100 z-10"
                          title="Limpar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {validationErrors[`${dateStr}-he100`] && (
                        <AlertCircle className="w-3 h-3 text-rose-500 absolute right-6 top-1/2 -translate-y-1/2 animate-fadeIn" />
                      )}
                    </div>
                  </td>

                  {/* Ad. Noturno 50% Input */}
                  <td className="py-1 px-2">
                    <div className="relative group/cell">
                      <input
                        id={`input-day-${dayNum}-adNoturno50`}
                        type="text"
                        placeholder="—"
                        value={entry.adNoturno50}
                        onChange={(e) => handleInputChange(dateStr, "adNoturno50", e.target.value)}
                        onBlur={(e) => handleInputBlur(dateStr, "adNoturno50", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, dayNum, 2)}
                        className={`w-full bg-[#181921] border rounded py-2 px-6 text-xs text-center font-mono focus:outline-none transition-all ${
                          validationErrors[`${dateStr}-adNoturno50`]
                            ? "border-rose-500/80 bg-rose-950/25 text-rose-300 px-8"
                            : "border-[#262836] text-[#f8fafc] focus:border-orange-500 focus:bg-[#222430]"
                        }`}
                      />
                      {entry.adNoturno50 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange(dateStr, "adNoturno50", "");
                            handleInputBlur(dateStr, "adNoturno50", "");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-[#262836] transition-colors cursor-pointer opacity-0 group-hover/cell:opacity-100 focus:opacity-100 z-10"
                          title="Limpar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {validationErrors[`${dateStr}-adNoturno50`] && (
                        <AlertCircle className="w-3 h-3 text-rose-500 absolute right-6 top-1/2 -translate-y-1/2 animate-fadeIn" />
                      )}
                    </div>
                  </td>

                  {/* Ad. Noturno 100% Input */}
                  <td className="py-1 px-2">
                    <div className="relative group/cell">
                      <input
                        id={`input-day-${dayNum}-adNoturno100`}
                        type="text"
                        placeholder="—"
                        value={entry.adNoturno100}
                        onChange={(e) => handleInputChange(dateStr, "adNoturno100", e.target.value)}
                        onBlur={(e) => handleInputBlur(dateStr, "adNoturno100", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, dayNum, 3)}
                        className={`w-full bg-[#181921] border rounded py-2 px-6 text-xs text-center font-mono focus:outline-none transition-all ${
                          validationErrors[`${dateStr}-adNoturno100`]
                            ? "border-rose-500/80 bg-rose-950/25 text-rose-300 px-8"
                            : "border-[#262836] text-[#f8fafc] focus:border-orange-500 focus:bg-[#222430]"
                        }`}
                      />
                      {entry.adNoturno100 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleInputChange(dateStr, "adNoturno100", "");
                            handleInputBlur(dateStr, "adNoturno100", "");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-[#262836] transition-colors cursor-pointer opacity-0 group-hover/cell:opacity-100 focus:opacity-100 z-10"
                          title="Limpar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {validationErrors[`${dateStr}-adNoturno100`] && (
                        <AlertCircle className="w-3 h-3 text-rose-500 absolute right-6 top-1/2 -translate-y-1/2 animate-fadeIn" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
