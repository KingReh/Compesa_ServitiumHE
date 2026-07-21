/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee } from "../types";

/**
 * Extracts Google Spreadsheet ID from a URL or returns the input if it looks like an ID
 */
export function extractSheetId(urlOrId: string): string | null {
  const clean = urlOrId.trim();
  if (!clean) return null;

  // Regular expression to match standard Google Sheet URLs
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // If it's a 44-character alphanumeric string (typical for google sheet id)
  if (/^[a-zA-Z0-9-_]{40,}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Parses a simple CSV string into rows of strings
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Double quote inside quotes means literal quote
        currentValue += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip newline after carriage return
      }
      row.push(currentValue.trim());
      if (row.length > 0 && row.some(cell => cell !== "")) {
        result.push(row);
      }
      row = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  // Handle last cell/row
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(cell => cell !== "")) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Normalizes strings to match headers case-insensitively and without accents
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "");     // remove special chars
}

/**
 * Fetches and parses a public Google Sheet as an Employee array
 */
export async function fetchEmployeesFromSheet(sheetId: string): Promise<Employee[]> {
  // Use gviz/tq endpoint which is highly reliable for public sheets
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao acessar planilha. Certifique-se de que ela está pública (Qualquer pessoa com o link pode ler).`);
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error("A planilha lida está vazia ou não possui cabeçalho.");
  }

  const headers = rows[0].map(normalizeHeader);
  
  // Find indices for each expected column
  // Expected: Nome, Matrícula, CPF, Especialidade, Habilitação
  const nomeIdx = headers.findIndex(h => h.includes("nome") || h.includes("colaborador") || h.includes("profissional") || h.includes("funcionario"));
  const matriculaIdx = headers.findIndex(h => h.includes("matricula") || h.includes("registro") || h.includes("id"));
  const cpfIdx = headers.findIndex(h => h.includes("cpf") || h.includes("documento"));
  const especialidadeIdx = headers.findIndex(h => h.includes("especialidade") || h.includes("cargo") || h.includes("funcao"));
  const habilitacaoIdx = headers.findIndex(h => h.includes("habilitacao") || h.includes("cnh") || h.includes("treinamento") || h.includes("cursos"));
  
  // Extra columns from user's sheet structure
  const vtIdx = headers.findIndex(h => h.includes("valetransporte") || h.includes("transporte"));
  const vaIdx = headers.findIndex(h => h.includes("valealimentacao") || h.includes("alimentacao"));
  const condutorIdx = headers.findIndex(h => h.includes("condutor"));
  const periculosidadeIdx = headers.findIndex(h => h.includes("periculosidade"));
  const insalubridadeIdx = headers.findIndex(h => h.includes("insalubridade"));

  // If we can't find columns by headers, fallback to mapping index 0=nome, 1=matricula, 2=cpf, 3=especialidade, 4=habilitacao
  const employees: Employee[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || !row[0]) continue;

    const nome = nomeIdx !== -1 ? row[nomeIdx] : row[0];
    const matricula = matriculaIdx !== -1 ? row[matriculaIdx] : row[1] || `SRV-${String(r).padStart(3, '0')}`;
    const cpf = cpfIdx !== -1 ? row[cpfIdx] : row[2] || "000.000.000-00";
    const especialidade = especialidadeIdx !== -1 ? row[especialidadeIdx] : row[3] || "Operacional";
    const habilitacao = habilitacaoIdx !== -1 ? row[habilitacaoIdx] : row[4] || "";

    const parseCheckbox = (val: string | undefined): boolean => {
      if (!val) return false;
      const clean = val.toUpperCase().trim();
      return (
        clean === "X" ||
        clean === "TRUE" ||
        clean === "VERDADEIRO" ||
        clean === "SIM" ||
        clean === "S" ||
        clean === "1"
      );
    };

    const recebeValeTransporte = vtIdx !== -1 ? row[vtIdx] : undefined;
    const recebeValeAlimentacao = vaIdx !== -1 ? row[vaIdx] : undefined;
    const adicionalCondutor = condutorIdx !== -1 ? parseCheckbox(row[condutorIdx]) : false;
    const periculosidade = periculosidadeIdx !== -1 ? parseCheckbox(row[periculosidadeIdx]) : false;
    const insalubridade = insalubridadeIdx !== -1 ? parseCheckbox(row[insalubridadeIdx]) : false;

    if (!nome) continue;

    employees.push({
      id: matricula || cpf || nome,
      nome,
      matricula,
      cpf,
      especialidade,
      habilitacao: habilitacao || undefined,
      recebeValeTransporte,
      recebeValeAlimentacao,
      adicionalCondutor,
      periculosidade,
      insalubridade
    });
  }

  return employees;
}
