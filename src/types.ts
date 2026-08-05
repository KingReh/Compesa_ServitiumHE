/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  id: string; // Matrícula or CPF used as ID
  nome: string;
  matricula: string;
  cpf: string;
  especialidade: string;
  habilitacao?: string;
  recebeValeTransporte?: string;
  recebeValeAlimentacao?: string;
  adicionalCondutor?: boolean;
  periculosidade?: boolean;
  insalubridade?: boolean;
}

export interface DailyEntry {
  dateStr: string; // dd/mm/yyyy
  dayOfWeek: string; // Seg, Ter, Qua, etc.
  he50: string; // hh:mm
  he100: string; // hh:mm
  adNoturno50: string; // hh:mm
  adNoturno100: string; // hh:mm
}

export interface Totals {
  he50: string; // hh:mm
  he100: string; // hh:mm
  adNoturno50: string; // hh:mm
  adNoturno100: string; // hh:mm
}

export interface ConsolidatedRecord {
  nome: string;
  matricula: string;
  cpf: string;
  especialidade: string;
  habilitacao: string;
  he50: string; // HH:MM
  he100: string; // HH:MM
  adNoturno50: string; // HH:MM
  adNoturno100: string; // HH:MM
  periodo: string; // Mês/Ano e.g. "Maio 2026"
  recebeValeTransporte?: string;
  recebeValeAlimentacao?: string;
  adicionalCondutor?: boolean;
  periculosidade?: boolean;
  insalubridade?: boolean;
}
