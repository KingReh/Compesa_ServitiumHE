/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { Employee, DailyEntry, Totals, ConsolidatedRecord } from "./types";
import { PRELOADED_EMPLOYEES } from "./data/employees";
import { MONTHS, getDaysInMonth, getDayOfWeekName, isWeekend, getHolidayName } from "./utils/dateUtils";
import { timeToMinutes, minutesToTime } from "./utils/hours";
import { extractSheetId, fetchEmployeesFromSheet } from "./utils/googleSheets";

import PeriodSelector from "./components/PeriodSelector";
import EmployeeSelector from "./components/EmployeeSelector";
import DailyLaunchTable from "./components/DailyLaunchTable";
import TotalsCard from "./components/TotalsCard";
import ConsolidatedTable from "./components/ConsolidatedTable";
import PWAHandler from "./components/PWAHandler";

import { FileSpreadsheet, Clock, BarChart3, TrendingUp, AlertCircle, FileText, CheckCircle, LayoutDashboard, Sliders, ShieldCheck, Database, Menu, X as CloseIcon } from "lucide-react";

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1uI1Td022bYP-NTZd2VrjCjwVSz5XrMV1ib-z-13_YkE/edit?gid=0#gid=0";

export default function App() {
  // 1. Core States
  const [monthIndex, setMonthIndex] = useState<number>(6); // Default July (Index 6)
  const [year, setYear] = useState<number>(2026); // Default 2026
  const [employees, setEmployees] = useState<Employee[]>(PRELOADED_EMPLOYEES);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Consolidated Records State
  const [consolidatedRecords, setConsolidatedRecords] = useState<ConsolidatedRecord[]>([]);

  // Launches State for active month & active employee
  const [launches, setLaunches] = useState<DailyEntry[]>([]);

  // Toast / Status Message notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Mobile sidebar navigation open/close
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Connection state for header badge tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Initialize from LocalStorage and Auto-sync Sheets
  useEffect(() => {
    // Load consolidated list
    const savedConsolidated = localStorage.getItem("servitium-consolidated");
    if (savedConsolidated) {
      try {
        setConsolidatedRecords(JSON.parse(savedConsolidated));
      } catch (e) {
        setConsolidatedRecords([]);
      }
    }

    // Load cached employees first to render instantly
    const savedEmployees = localStorage.getItem("servitium-employees");
    if (savedEmployees) {
      try {
        setEmployees(JSON.parse(savedEmployees));
      } catch (e) {
        setEmployees(PRELOADED_EMPLOYEES);
      }
    }

    // Dynamic background auto-sync from the fixed Google Sheet URL
    const autoSyncFromSheet = async () => {
      const sheetId = extractSheetId(DEFAULT_SHEET_URL);
      if (sheetId) {
        try {
          const data = await fetchEmployeesFromSheet(sheetId);
          if (data && data.length > 0) {
            setEmployees(data);
            localStorage.setItem("servitium-employees", JSON.stringify(data));
            console.log("Employees auto-synced successfully from Google Sheets.");
          }
        } catch (err) {
          console.warn("Failed to background auto-sync from Google Sheets, using fallback", err);
        }
      }
    };
    autoSyncFromSheet();
  }, []);

  // Helper to get active period text
  const periodName = useMemo(() => {
    return `${MONTHS[monthIndex]} / ${year}`;
  }, [monthIndex, year]);

  // 3. Recreate clean/pristine launches when employee or period changes (not preserved across employee switches)
  useEffect(() => {
    if (!selectedEmployee) {
      setLaunches([]);
      return;
    }

    const daysCount = getDaysInMonth(monthIndex, year);
    const template: DailyEntry[] = [];
    for (let d = 1; d <= daysCount; d++) {
      const dStr = String(d).padStart(2, "0");
      const mStr = String(monthIndex + 1).padStart(2, "0");
      template.push({
        dateStr: `${dStr}/${mStr}/${year}`,
        dayOfWeek: getDayOfWeekName(d, monthIndex, year),
        he50: "",
        he100: "",
        adNoturno50: "",
        adNoturno100: ""
      });
    }
    setLaunches(template);
  }, [monthIndex, year, selectedEmployee]);

  // 4. State updates handlers
  const handlePeriodChange = (newMonth: number, newYear: number) => {
    setMonthIndex(newMonth);
    setYear(newYear);
    showToast(`Período alterado para ${MONTHS[newMonth]} de ${newYear}`, "info");
  };

  const handleLaunchChange = (
    dateStr: string,
    field: "he50" | "he100" | "adNoturno50" | "adNoturno100",
    value: string
  ) => {
    setLaunches(prev => {
      const next = prev.map(item => {
        if (item.dateStr === dateStr) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return next;
    });
  };

  // Bulk replicates values to columns for high productivity
  const handleBulkFillColumn = (
    field: "he50" | "he100" | "adNoturno50" | "adNoturno100",
    value: string,
    onlyWeekdays: boolean
  ) => {
    setLaunches(prev => {
      const next = prev.map((item, idx) => {
        const dayNum = idx + 1;
        const isWk = isWeekend(dayNum, monthIndex, year);
        const hol = getHolidayName(dayNum, monthIndex, year);

        if (onlyWeekdays) {
          // Weekdays only: exclude Saturdays, Sundays, and Holidays
          if (!isWk && !hol) {
            return { ...item, [field]: value };
          }
        } else {
          // All days of the month
          return { ...item, [field]: value };
        }
        return item;
      });
      return next;
    });

    showToast(
      value 
        ? `Coluna preenchida com ${value} em lote!` 
        : `Lançamentos da coluna limpos em lote!`, 
      "info"
    );
  };

  const handleClearLaunches = () => {
    setLaunches(prev => {
      const cleared = prev.map(item => ({
        ...item,
        he50: "",
        he100: "",
        adNoturno50: "",
        adNoturno100: ""
      }));
      return cleared;
    });
    showToast("Tabela de lançamentos diários limpa.", "info");
  };

  // Live total calculations
  const computedTotals = useMemo<Totals>(() => {
    let totHe50 = 0;
    let totHe100 = 0;
    let totAdNoturno50 = 0;
    let totAdNoturno100 = 0;

    launches.forEach(item => {
      totHe50 += timeToMinutes(item.he50);
      totHe100 += timeToMinutes(item.he100);
      totAdNoturno50 += timeToMinutes(item.adNoturno50);
      totAdNoturno100 += timeToMinutes(item.adNoturno100);
    });

    return {
      he50: minutesToTime(totHe50),
      he100: minutesToTime(totHe100),
      adNoturno50: minutesToTime(totAdNoturno50),
      adNoturno100: minutesToTime(totAdNoturno100)
    };
  }, [launches]);

  // Transfer live totals to consolidated database
  const handleTransferToConsolidated = () => {
    if (!selectedEmployee) return;

    const newRecord: ConsolidatedRecord = {
      nome: selectedEmployee.nome,
      matricula: selectedEmployee.matricula,
      cpf: selectedEmployee.cpf,
      especialidade: selectedEmployee.especialidade,
      habilitacao: selectedEmployee.habilitacao || "Nenhuma",
      he50: computedTotals.he50,
      he100: computedTotals.he100,
      heNoturna100: "00:00", // Start default, editable later
      adNoturno50: computedTotals.adNoturno50,
      adNoturno100: computedTotals.adNoturno100,
      periodo: periodName,
      recebeValeTransporte: selectedEmployee.recebeValeTransporte,
      recebeValeAlimentacao: selectedEmployee.recebeValeAlimentacao,
      adicionalCondutor: selectedEmployee.adicionalCondutor,
      periculosidade: selectedEmployee.periculosidade,
      insalubridade: selectedEmployee.insalubridade
    };

    setConsolidatedRecords(prev => {
      // Find if employee exists
      const existingIdx = prev.findIndex(r => r.matricula === selectedEmployee.matricula);
      let next: ConsolidatedRecord[];

      if (existingIdx !== -1) {
        next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          he50: newRecord.he50,
          he100: newRecord.he100,
          adNoturno50: newRecord.adNoturno50,
          adNoturno100: newRecord.adNoturno100,
          periodo: newRecord.periodo,
          recebeValeTransporte: newRecord.recebeValeTransporte,
          recebeValeAlimentacao: newRecord.recebeValeAlimentacao,
          adicionalCondutor: newRecord.adicionalCondutor,
          periculosidade: newRecord.periculosidade,
          insalubridade: newRecord.insalubridade
        };
        showToast(`Registro de ${selectedEmployee.nome} atualizado no consolidado!`, "success");
      } else {
        next = [...prev, newRecord];
        showToast(`Lançamentos de ${selectedEmployee.nome} transferidos com sucesso!`, "success");
      }

      localStorage.setItem("servitium-consolidated", JSON.stringify(next));
      return next;
    });
  };

  // Actions in consolidated table
  const handleRemoveConsolidated = (matricula: string) => {
    setConsolidatedRecords(prev => {
      const next = prev.filter(r => r.matricula !== matricula);
      localStorage.setItem("servitium-consolidated", JSON.stringify(next));
      return next;
    });
    showToast("Registro excluído do fechamento consolidado.", "info");
  };

  const handleUpdateConsolidated = (matricula: string, updatedFields: Partial<ConsolidatedRecord>) => {
    setConsolidatedRecords(prev => {
      const next = prev.map(rec => {
        if (rec.matricula === matricula) {
          return { ...rec, ...updatedFields };
        }
        return rec;
      });
      localStorage.setItem("servitium-consolidated", JSON.stringify(next));
      return next;
    });
    showToast("Dados do consolidado atualizados com sucesso.", "success");
  };

  const handleUpdateAllConsolidated = (nextRecords: ConsolidatedRecord[], toastMsg?: string) => {
    setConsolidatedRecords(nextRecords);
    localStorage.setItem("servitium-consolidated", JSON.stringify(nextRecords));
    if (toastMsg) {
      showToast(toastMsg, "success");
    }
  };

  // Simple clean toast manager
  const showToast = (message: string, type: "success" | "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-[#f8fafc] flex flex-col font-sans overflow-x-hidden selection:bg-orange-500 selection:text-white">
      
      {/* 2. Main Content Frame */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#090a0f]">
        
        {/* Sticky Header */}
        <header className="bg-[#111217] border-b border-[#1e2029] sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">

            {/* Header Title Section */}
            <div className="flex items-center gap-4">
              <div className="bg-orange-500/10 text-orange-500 rounded-md p-2 flex items-center justify-center border border-orange-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-widest text-[#f8fafc] font-sans">CONTROLE DE APURAÇÃO</span>
                  {isOnline ? (
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-sm font-mono active-pulse-glow">
                      ONLINE
                    </span>
                  ) : (
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[8px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-sm font-mono">
                      OFFLINE
                    </span>
                  )}
                </div>
                <h1 className="text-[10px] sm:text-xs text-slate-400 font-semibold font-sans">
                  Gestão integrada de horas extras, adicionais noturnos e fechamento industrial
                </h1>
              </div>
            </div>

            {/* Quick Metadata Info */}
            <div className="flex items-center gap-4 shrink-0 bg-[#181921] border border-[#262836] px-4 py-2 rounded-md text-right">
              <div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Período de Referência</div>
                <div className="text-xs font-bold text-orange-400 font-mono">{periodName}</div>
              </div>
              <div className="border-l border-[#262836] pl-4">
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Fechamentos</div>
                <div className="text-xs font-bold text-[#f8fafc] font-mono">
                  {consolidatedRecords.length} colab.
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
          
          {/* Row 1: Period and Employee selectors */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 lg:col-span-4">
              <PeriodSelector
                monthIndex={monthIndex}
                year={year}
                onPeriodChange={handlePeriodChange}
              />
            </div>
            <div id="employees-selector-container" className="md:col-span-7 lg:col-span-8">
              <EmployeeSelector
                employees={employees}
                selectedEmployee={selectedEmployee}
                onEmployeeSelect={setSelectedEmployee}
              />
            </div>
          </div>

          {/* Row 2: Daily Launch table & live calculations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main Daily table */}
            <div className="lg:col-span-8 xl:col-span-9">
              {selectedEmployee ? (
                <DailyLaunchTable
                  monthIndex={monthIndex}
                  year={year}
                  launches={launches}
                  onLaunchChange={handleLaunchChange}
                  onBulkFillColumn={handleBulkFillColumn}
                />
              ) : (
                <div className="bg-[#111217] border border-[#1e2029] rounded-lg p-10 text-center flex flex-col items-center justify-center h-[352px]">
                  <div className="bg-[#181921] border border-[#262836] p-4 rounded-full mb-4 text-orange-500">
                    <BarChart3 className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-[#f8fafc]">Nenhum Colaborador Alocado</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
                    Utilize o seletor acima para buscar ou escolher um funcionário e registrar os lançamentos diários de adicionais e horas extras.
                  </p>
                </div>
              )}
            </div>

            {/* Totals KPI Panel */}
            <div className="lg:col-span-4 xl:col-span-3">
              <TotalsCard
                totals={computedTotals}
                selectedEmployee={selectedEmployee}
                onClear={handleClearLaunches}
                onTransfer={handleTransferToConsolidated}
                periodName={periodName}
              />
            </div>
          </div>

          {/* Row 3: Consolidated Table */}
          <div className="pt-2">
            <ConsolidatedTable
              records={consolidatedRecords}
              onRemoveRecord={handleRemoveConsolidated}
              onUpdateRecord={handleUpdateConsolidated}
              onUpdateAllRecords={handleUpdateAllConsolidated}
              periodName={periodName}
            />
          </div>
        </main>

        {/* Modern floating toast notification */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border shadow-lg bg-[#111217] border-orange-500/40 text-white text-xs animate-slideUp font-sans font-semibold">
            {toast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-orange-400" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Professional Footer */}
        <footer className="bg-[#111217] border-t border-[#1e2029] py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-500 font-mono gap-2">
            <span>© 2026 SERVITIUM INDUSTRIAL S.A. • CONTROLADORIA ADMINISTRATIVA</span>
            <span>SISTEMA DE USO EXCLUSIVO INTERNO • MEMÓRIA LOCAL PROTEGIDA</span>
          </div>
        </footer>

        {/* PWA Lifetime Handler */}
        <PWAHandler />
      </div>
    </div>
  );
}
