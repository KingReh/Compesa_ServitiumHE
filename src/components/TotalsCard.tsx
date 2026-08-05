/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Totals, Employee } from "../types";
import { Calculator, Trash2, ArrowRightLeft, Sparkles, Clock, X } from "lucide-react";

interface TotalsCardProps {
  totals: Totals;
  selectedEmployee: Employee | null;
  onClear: () => void;
  onTransfer: () => void;
  periodName: string;
}

export default function TotalsCard({
  totals,
  selectedEmployee,
  onClear,
  onTransfer,
  periodName
}: TotalsCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  
  const handleClearClick = () => {
    setIsConfirming(true);
  };

  const handleConfirmClear = () => {
    onClear();
    setIsConfirming(false);
  };

  const handleCancelClear = () => {
    setIsConfirming(false);
  };

  const hasAnyHours = 
    totals.he50 !== "00:00" || 
    totals.he100 !== "00:00" || 
    totals.adNoturno50 !== "00:00" || 
    totals.adNoturno100 !== "00:00";

  return (
    <div id="card-totais" className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-sm p-4 h-full flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2029] pb-2 mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider font-sans">
              03 — Totais Calculados
            </h2>
          </div>
          <span className="flex items-center gap-2 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-1 rounded font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            LIVE
          </span>
        </div>

        {/* Display Density KPIs */}
        <div className="space-y-2">
          {/* HE 50% */}
          <div className="bg-[#181921] border border-[#262836] rounded-md py-2 px-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">HE 50%</div>
              <div className="text-[9px] text-slate-400 font-medium font-sans">Segunda a Sábado</div>
            </div>
            <div className="text-lg font-mono font-black text-sky-400 tracking-tight">
              {totals.he50}
            </div>
          </div>

          {/* HE 100% */}
          <div className="bg-[#181921] border border-[#262836] rounded-md py-2 px-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">HE 100%</div>
              <div className="text-[9px] text-slate-400 font-medium font-sans">Domingos e Feriados</div>
            </div>
            <div className="text-lg font-mono font-black text-amber-400 tracking-tight">
              {totals.he100}
            </div>
          </div>

          {/* Adicional Noturno 50% */}
          <div className="bg-[#181921] border border-[#262836] rounded-md py-2 px-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Adic. Noturno 50%</div>
              <div className="text-[9px] text-slate-400 font-medium font-sans">Adicional Noturno Semanal</div>
            </div>
            <div className="text-lg font-mono font-black text-indigo-400 tracking-tight">
              {totals.adNoturno50}
            </div>
          </div>

          {/* Adicional Noturno 100% */}
          <div className="bg-[#181921] border border-[#262836] rounded-md py-2 px-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Adic. Noturno 100%</div>
              <div className="text-[9px] text-slate-400 font-medium font-sans">Adicional Noturno Finais de Semana</div>
            </div>
            <div className="text-lg font-mono font-black text-rose-400 tracking-tight">
              {totals.adNoturno100}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons & Actions */}
      <div className="mt-4 pt-4 border-t border-[#1e2029] space-y-2">
        {selectedEmployee ? (
          <div className="bg-[#181921]/60 border border-[#262836] rounded p-2 text-center text-[10px] text-slate-400 leading-normal font-sans">
            Alocado para: <strong className="text-orange-400">{selectedEmployee.nome}</strong> <br />
            Competência: <strong className="text-[#f8fafc] font-mono">{periodName}</strong>
          </div>
        ) : (
          <div className="bg-amber-950/20 border border-amber-900/60 rounded p-2 text-center text-[10px] text-amber-400 font-bold font-sans">
            Selecione um colaborador acima para liberar a transferência dos valores.
          </div>
        )}

        {isConfirming ? (
          <div className="grid grid-cols-2 gap-2 animate-fadeIn">
            {/* Confirm button */}
            <button
              type="button"
              onClick={handleConfirmClear}
              className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded text-xs cursor-pointer transition-colors shadow-sm"
              title="Confirmar exclusão de todas as horas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Confirmar?
            </button>
            {/* Cancel button */}
            <button
              type="button"
              onClick={handleCancelClear}
              className="flex items-center justify-center gap-2 bg-[#181921] hover:bg-[#262836] text-slate-300 border border-[#262836] py-2 rounded text-xs font-bold cursor-pointer transition-colors"
              title="Cancelar exclusão"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* Limpar Button */}
            <button
              type="button"
              onClick={handleClearClick}
              disabled={!hasAnyHours}
              className="flex items-center justify-center gap-2 bg-[#181921] hover:bg-[#262836] disabled:opacity-40 disabled:hover:bg-[#181921] text-slate-300 border border-[#262836] hover:text-rose-400 py-2 rounded text-xs font-bold cursor-pointer transition-colors"
              title="Limpar todos os campos da tabela"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar
            </button>

            {/* Transferir Button */}
            <button
              type="button"
              onClick={onTransfer}
              disabled={!selectedEmployee}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:bg-zinc-800 disabled:border-[#262836] disabled:text-zinc-500 text-white font-bold border border-orange-600 py-2 rounded text-xs cursor-pointer transition-colors shadow-sm"
              title="Transferir totais para a tabela consolidada de fechamento"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Transferir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
