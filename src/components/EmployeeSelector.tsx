/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Employee } from "../types";
import { Users, Search } from "lucide-react";

interface EmployeeSelectorProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onEmployeeSelect: (employee: Employee | null) => void;
}

export default function EmployeeSelector({
  employees,
  selectedEmployee,
  onEmployeeSelect
}: EmployeeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false); // Dropdown search list toggle

  // Filters employees by search term
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return employees;
    return employees.filter(
      emp =>
        emp.nome.toLowerCase().includes(term) ||
        emp.matricula.toLowerCase().includes(term) ||
        emp.cpf.includes(term)
    );
  }, [employees, searchTerm]);

  const handleSelectEmployee = (emp: Employee) => {
    onEmployeeSelect(emp);
    setSearchTerm(emp.nome);
    setIsOpen(false);
  };

  return (
    <div id="card-colaborador" className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e2029] pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-500" />
          <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider font-sans">
            02 — Colaborador
          </h2>
        </div>
      </div>

      {/* Main Selector & Readonly Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Search Input Dropdown */}
        <div className="lg:col-span-4 relative">
          <label htmlFor="search-funcionario" className="block text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">
            BUSCAR COLABORADOR
          </label>
          <div className="relative">
            <input
              id="search-funcionario"
              type="text"
              placeholder="Digite o nome para pesquisar..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
                if (!e.target.value) {
                  onEmployeeSelect(null);
                }
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full bg-[#181921] border border-[#262836] text-xs text-[#f8fafc] rounded-md pl-8 pr-8 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/35 hover:border-[#383a4f] hover:bg-[#1a1b26] transition-all duration-200 font-sans font-medium placeholder-slate-500 shadow-sm"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  onEmployeeSelect(null);
                  setIsOpen(true);
                }}
                className="text-[10px] text-slate-400 hover:text-[#f8fafc] absolute right-2 top-1/2 -translate-y-1/2 font-sans font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete List overlay */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-2 bg-[#181921] border border-[#262836] rounded shadow-xl max-h-48 overflow-y-auto divide-y divide-[#262836]">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 font-sans text-center">Nenhum funcionário encontrado</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[#262836] font-sans cursor-pointer ${
                      selectedEmployee?.id === emp.id ? "bg-[#2a2b36] hover:bg-[#343542]" : ""
                    }`}
                  >
                    <span className="font-bold text-[#f8fafc]">{emp.nome}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {/* Close click outside listener helper */}
          {isOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          )}
        </div>

        {/* Readonly Info Blocks (High-density dashboard look) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Matricula */}
          <div className="bg-[#0a0b0d] border border-[#1e2029] rounded px-2 py-2 flex flex-col justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">MATRÍCULA</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate mt-1">
              {selectedEmployee?.matricula || "—"}
            </span>
          </div>

          {/* CPF */}
          <div className="bg-[#0a0b0d] border border-[#1e2029] rounded px-2 py-2 flex flex-col justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">CPF</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate mt-1">
              {selectedEmployee?.cpf || "—"}
            </span>
          </div>

          {/* Especialidade */}
          <div className="bg-[#0a0b0d] border border-[#1e2029] rounded px-2 py-2 flex flex-col justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">ESPECIALIDADE</span>
            <span className="text-xs font-sans font-bold text-slate-200 truncate mt-1">
              {selectedEmployee?.especialidade || "—"}
            </span>
          </div>

          {/* Habilitação */}
          <div className="bg-[#0a0b0d] border border-[#1e2029] rounded px-2 py-2 flex flex-col justify-between">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">HABILITAÇÃO</span>
            <span className={`text-xs font-sans font-bold truncate mt-1 ${selectedEmployee?.habilitacao && selectedEmployee?.habilitacao !== "Nenhuma" ? "text-orange-500" : "text-slate-400"}`}>
              {selectedEmployee?.habilitacao || "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
