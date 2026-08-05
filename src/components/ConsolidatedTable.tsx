/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { ConsolidatedRecord } from "../types";
import { FileDown, Search, ArrowUpDown, Trash2, Edit2, Check, X, FileSpreadsheet, FileText, Eye, Printer, Clock } from "lucide-react";
import { applyTimeMask, normalizeTimeOnBlur, isValidTime, timeToMinutes, minutesToTime, roundTo30MinCriterion } from "../utils/hours";

// SheetJS and jsPDF
// @ts-ignore
import XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SERVITIUM_LOGO_BASE64 } from "../assets/logoConstant";

interface ConsolidatedTableProps {
  records: ConsolidatedRecord[];
  onRemoveRecord: (matricula: string) => void;
  onUpdateRecord: (matricula: string, updatedFields: Partial<ConsolidatedRecord>) => void;
  onUpdateAllRecords: (records: ConsolidatedRecord[], toastMsg?: string) => void;
  periodName: string;
}

export default function ConsolidatedTable({
  records,
  onRemoveRecord,
  onUpdateRecord,
  onUpdateAllRecords,
  periodName
}: ConsolidatedTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [editingMatricula, setEditingMatricula] = useState<string | null>(null);
  const [confirmDeleteMatricula, setConfirmDeleteMatricula] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Buffer state for row being edited
  const [editBuffer, setEditBuffer] = useState<Partial<ConsolidatedRecord>>({});

  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleApplyRounding = () => {
    let adjustedCount = 0;
    
    const updatedRecords = records.map(rec => {
      let isChanged = false;
      
      const newHe50 = roundTo30MinCriterion(rec.he50);
      const newHe100 = roundTo30MinCriterion(rec.he100);
      const newAdNot50 = roundTo30MinCriterion(rec.adNoturno50);
      const newAdNot100 = roundTo30MinCriterion(rec.adNoturno100);
      
      if (
        newHe50 !== rec.he50 ||
        newHe100 !== rec.he100 ||
        newAdNot50 !== rec.adNoturno50 ||
        newAdNot100 !== rec.adNoturno100
      ) {
        isChanged = true;
      }
      
      if (isChanged) {
        adjustedCount++;
      }
      
      return {
        ...rec,
        he50: newHe50,
        he100: newHe100,
        adNoturno50: newAdNot50,
        adNoturno100: newAdNot100
      };
    });

    if (adjustedCount > 0) {
      onUpdateAllRecords(updatedRecords, `Critério dos 30 minutos aplicado! ${adjustedCount} colaborador(es) teve(ram) as horas ajustadas.`);
    } else {
      onUpdateAllRecords(updatedRecords, "Nenhum ajuste necessário: todos os valores já estão arredondados segundo o critério de 30 minutos.");
    }
    
    setShowRoundConfirm(false);
  };

  // Calculate aggregated overtime hours
  const stats = useMemo(() => {
    let totalHE50Mins = 0;
    let totalHE100Mins = 0;
    let totalAdNot50Mins = 0;
    let totalAdNot100Mins = 0;

    records.forEach(rec => {
      totalHE50Mins += timeToMinutes(rec.he50);
      totalHE100Mins += timeToMinutes(rec.he100);
      totalAdNot50Mins += timeToMinutes(rec.adNoturno50);
      totalAdNot100Mins += timeToMinutes(rec.adNoturno100);
    });

    const totalOvertimeMins = totalHE50Mins + totalHE100Mins + totalAdNot50Mins + totalAdNot100Mins;

    return {
      he50: minutesToTime(totalHE50Mins),
      he100: minutesToTime(totalHE100Mins),
      adNot50: minutesToTime(totalAdNot50Mins),
      adNot100: minutesToTime(totalAdNot100Mins),
      totalOvertime: minutesToTime(totalOvertimeMins),
    };
  }, [records]);

  // Filter and sort records
  const processedRecords = useMemo(() => {
    let result = [...records];

    // 1. Search filter
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        rec =>
          rec.nome.toLowerCase().includes(term) ||
          rec.matricula.toLowerCase().includes(term) ||
          rec.cpf.includes(term)
      );
    }

    // 2. Sort by name
    result.sort((a, b) => {
      const nameA = a.nome.localeCompare(b.nome);
      return sortAsc ? nameA : -nameA;
    });

    return result;
  }, [records, searchTerm, sortAsc]);

  // Edit actions
  const startEditing = (rec: ConsolidatedRecord) => {
    setEditingMatricula(rec.matricula);
    setEditBuffer({ ...rec });
  };

  const cancelEditing = () => {
    setEditingMatricula(null);
    setEditBuffer({});
  };

  const saveEditing = (matricula: string) => {
    // Validate all time fields in buffer are valid HH:MM
    const timeFields: Array<keyof ConsolidatedRecord> = [
      "he50",
      "he100",
      "adNoturno50",
      "adNoturno100"
    ];

    const updated: Partial<ConsolidatedRecord> = {};
    
    for (const field of timeFields) {
      const val = editBuffer[field] as string || "00:00";
      const normalized = normalizeTimeOnBlur(val);
      if (!isValidTime(normalized)) {
        alert(`Formato inválido no campo ${field}. Use o formato HH:MM (ex: 02:30).`);
        return;
      }
      (updated as any)[field] = normalized;
    }

    onUpdateRecord(matricula, updated);
    setEditingMatricula(null);
    setEditBuffer({});
  };

  const handleBufferTimeChange = (field: keyof ConsolidatedRecord, value: string) => {
    const masked = applyTimeMask(value);
    setEditBuffer(prev => ({ ...prev, [field]: masked }));
  };

  // EXPORTS
  const exportToExcel = () => {
    if (records.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }

    // Helper to convert indices (row, col) to standard cell reference (e.g. A1, C12, AA5)
    const getCellRef = (r: number, c: number): string => {
      let colName = "";
      let temp = c;
      while (temp >= 0) {
        colName = String.fromCharCode((temp % 26) + 65) + colName;
        temp = Math.floor(temp / 26) - 1;
      }
      return `${colName}${r + 1}`;
    };

    // Format hours similarly to PDF: show integer hours if rounded, keep full string if minutes exist
    const formatExcelHours = (timeStr: string) => {
      if (!timeStr || timeStr === "00:00") return "";
      const parts = timeStr.split(":");
      if (parts.length === 2) {
        const hours = parseInt(parts[0], 10);
        const mins = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(mins)) return timeStr;
        if (hours === 0 && mins === 0) return "";
        if (mins === 0) return hours; // Exactly XX:00 -> show just the integer hour number
        return timeStr; // Keep full HH:MM
      }
      return timeStr;
    };

    // Setup style definitions matching the corporate design tokens
    const thinBorder = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    };

    const headerBgColor = { rgb: "F8FAFC" }; // slate-50

    const excelStyles = {
      logo: {
        font: { name: "Arial", sz: 12, bold: true, color: { rgb: "0B3C83" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder
      },
      headerCenterBoldBlue: {
        font: { name: "Arial", sz: 9.5, bold: true, color: { rgb: "0B3C83" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      headerCenterBoldDark: {
        font: { name: "Arial", sz: 8.5, bold: true, color: { rgb: "334155" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      headerCenterRegular: {
        font: { name: "Arial", sz: 7.5, color: { rgb: "475569" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      headerCenterBoldGray: {
        font: { name: "Arial", sz: 8, bold: true, color: { rgb: "475569" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      periodBox: {
        font: { name: "Arial", sz: 14, bold: true, color: { rgb: "0B3C83" } },
        fill: { fgColor: headerBgColor },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder
      },
      tableHeader: {
        font: { name: "Arial", sz: 8.5, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0B3C83" } }, // Corporate Blue
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder
      },
      specialtyCell: {
        font: { name: "Arial", sz: 8.5, bold: true, color: { rgb: "0B3C83" } },
        fill: { fgColor: { rgb: "F8FAFC" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder
      },
      nameCell: {
        font: { name: "Arial", sz: 9.5, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      centerCell: {
        font: { name: "Arial", sz: 9, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      leftCell: {
        font: { name: "Arial", sz: 9, color: { rgb: "000000" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      },
      skyHourCell: {
        font: { name: "Arial", sz: 9.5, bold: true, color: { rgb: "0284C7" } }, // Sky Blue Text
        fill: { fgColor: { rgb: "F0F9FF" } }, // sky-50 background
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      roseHourCell: {
        font: { name: "Arial", sz: 9.5, bold: true, color: { rgb: "E11D48" } }, // Rose Text
        fill: { fgColor: { rgb: "FFF1F2" } }, // rose-50 background
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      simCell: {
        font: { name: "Arial", sz: 9, bold: true, color: { rgb: "047857" } }, // Emerald Green
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      naoCell: {
        font: { name: "Arial", sz: 9, bold: true, color: { rgb: "94A3B8" } }, // Slate Gray
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      checkedCheckboxCell: {
        font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, // White text
        fill: { fgColor: { rgb: "0B3C83" } }, // Header dark blue background
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      uncheckedCheckboxCell: {
        font: { name: "Arial", sz: 9, color: { rgb: "000000" } }, // Plain black text (won't be shown since cell is empty)
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder
      },
      footerSummary: {
        font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0B3C83" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder
      }
    };

    // Initialize blank worksheet object and merges array
    const ws: any = {};
    const merges: any[] = [];

    // Helper to safely write cell value + type + style
    const writeCell = (r: number, c: number, value: any, cellStyle?: any, type: string = "s") => {
      const ref = getCellRef(r, c);
      ws[ref] = {
        v: value,
        t: type,
        s: cellStyle || {}
      };
    };

    // Initialize all cells in the Corporate Header region (5 rows x 17 columns) with a white background and borders
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 17; c++) {
        writeCell(r, c, "", { fill: { fgColor: headerBgColor }, border: thinBorder });
      }
    }

    // --- Row 1 to 5: Corporate Header ---
    // Column A-B: Logo section (A1:B5 merged)
    merges.push({ s: { r: 0, c: 0 }, e: { r: 4, c: 1 } });
    writeCell(0, 0, "SERVITIUM\n\nCMA SUL", excelStyles.logo);

    // Column C-N: Center Details rows
    const centerLines = [
      { text: "COMPESA – COMPANHIA PERNAMBUCANA DE SANEAMENTO", style: excelStyles.headerCenterBoldBlue },
      { text: "SETOR: GERÊNCIA DE PRODUÇÃO METROPOLITANA- GPM/CMA SUL", style: excelStyles.headerCenterBoldDark },
      { text: "CGC 09.769.035/0001-64 – IE 18.1.001.0014398-6", style: excelStyles.headerCenterRegular },
      { text: "ETA PIRAPAMA - BR Sul KM 100, SN - Pirapama, Cabo de Santo Agostinho - PE", style: excelStyles.headerCenterBoldGray },
      { text: "EMPRESA: SERVITIUM EIRELI LTDA | CONTRATO: CT.PS.22.4.417", style: excelStyles.headerCenterBoldGray }
    ];

    centerLines.forEach((line, idx) => {
      merges.push({ s: { r: idx, c: 2 }, e: { r: idx, c: 13 } });
      writeCell(idx, 2, line.text, line.style);
    });

    // Column O-Q: Period box (O1:Q5 merged)
    merges.push({ s: { r: 0, c: 14 }, e: { r: 4, c: 16 } });
    const formattedPeriod = periodName.replace(/[\s\/]+/g, "-");
    writeCell(0, 14, `PERÍODO\n\n${formattedPeriod}`, excelStyles.periodBox);

    // --- Row 6: Empty Spacing Row ---
    for (let c = 0; c < 17; c++) {
      writeCell(5, c, "");
    }

    // --- Row 7 and 8: Main Table Headers (Double-row setup) ---
    // Initialize full header region with tableHeader styles
    for (let r = 6; r <= 7; r++) {
      for (let c = 0; c < 17; c++) {
        writeCell(r, c, "", excelStyles.tableHeader);
      }
    }

    // A7:A8 merged (Col 0) -> Specialty
    merges.push({ s: { r: 6, c: 0 }, e: { r: 7, c: 0 } });
    writeCell(6, 0, "EQUIPE/DESCRIÇÃO", excelStyles.tableHeader);

    // B7:B8 merged (Col 1) -> Name
    merges.push({ s: { r: 6, c: 1 }, e: { r: 7, c: 1 } });
    writeCell(6, 1, "NOME DO PROFISSIONAL", excelStyles.tableHeader);

    // C7:C8 merged (Col 2) -> Mat
    merges.push({ s: { r: 6, c: 2 }, e: { r: 7, c: 2 } });
    writeCell(6, 2, "MAT", excelStyles.tableHeader);

    // D7:D8 merged (Col 3) -> CPF
    merges.push({ s: { r: 6, c: 3 }, e: { r: 7, c: 3 } });
    writeCell(6, 3, "CPF", excelStyles.tableHeader);

    // E7:E8 merged (Col 4) -> Habilitacao
    merges.push({ s: { r: 6, c: 4 }, e: { r: 7, c: 4 } });
    writeCell(6, 4, "HABILITAÇÃO", excelStyles.tableHeader);

    // F7:F8 merged (Col 5) -> HE 50%
    merges.push({ s: { r: 6, c: 5 }, e: { r: 7, c: 5 } });
    writeCell(6, 5, "HORA EXTRA\nSEGUNDA A\nSÁBADO 50%", excelStyles.tableHeader);

    // G7:G8 merged (Col 6) -> HE 100%
    merges.push({ s: { r: 6, c: 6 }, e: { r: 7, c: 6 } });
    writeCell(6, 6, "HORA EXTRA\nDOMINGOS E\nFERIADOS 100%", excelStyles.tableHeader);

    // H7:I7 merged (Cols 7 & 8) -> HE Noturna parent header
    merges.push({ s: { r: 6, c: 7 }, e: { r: 6, c: 8 } });
    writeCell(6, 7, "HORA EXTRA NOTURNA 50% DAS\n22:00 ÀS 05:00", excelStyles.tableHeader);

    // Sub-headers in Row 8 for HE Noturna
    writeCell(7, 7, "SEGUNDA A\nSÁBADO", excelStyles.tableHeader);
    writeCell(7, 8, "DOMINGOS E\nFERIADOS", excelStyles.tableHeader);

    // J7:J8 merged (Col 9) -> Faltas
    merges.push({ s: { r: 6, c: 9 }, e: { r: 7, c: 9 } });
    writeCell(6, 9, "DIAS DE\nFALTAS", excelStyles.tableHeader);

    // K7:K8 merged (Col 10) -> Férias 10
    merges.push({ s: { r: 6, c: 10 }, e: { r: 7, c: 10 } });
    writeCell(6, 10, "FÉRIAS\nTRABALHANDO\n10 DIAS", excelStyles.tableHeader);

    // L7:L8 merged (Col 11) -> Férias 30
    merges.push({ s: { r: 6, c: 11 }, e: { r: 7, c: 11 } });
    writeCell(6, 11, "FÉRIAS\nGOZANDO 30\nDIAS", excelStyles.tableHeader);

    // M7:M8 merged (Col 12) -> VT
    merges.push({ s: { r: 6, c: 12 }, e: { r: 7, c: 12 } });
    writeCell(6, 12, "RECEBE VALE\nTRANSPORTE", excelStyles.tableHeader);

    // N7:N8 merged (Col 13) -> VA
    merges.push({ s: { r: 6, c: 13 }, e: { r: 7, c: 13 } });
    writeCell(6, 13, "RECEBE VALE\nALIMENTAÇÃO", excelStyles.tableHeader);

    // O7:O8 merged (Col 14) -> Condutor
    merges.push({ s: { r: 6, c: 14 }, e: { r: 7, c: 14 } });
    writeCell(6, 14, "ADICIONAL DE\nCONDUTOR", excelStyles.tableHeader);

    // P7:P8 merged (Col 15) -> Periculosidade
    merges.push({ s: { r: 6, c: 15 }, e: { r: 7, c: 15 } });
    writeCell(6, 15, "PERICULOSIDADE", excelStyles.tableHeader);

    // Q7:Q8 merged (Col 16) -> Insalubridade
    merges.push({ s: { r: 6, c: 16 }, e: { r: 7, c: 16 } });
    writeCell(6, 16, "INSALUBRIDADE", excelStyles.tableHeader);

    // --- Row 9+: Data Rows & Group Merging ---
    // Sort records exactly like the PDF (by specialty, then by name)
    const sortedBySpecialty = [...processedRecords].sort((a, b) => {
      const specCompare = (a.especialidade || "").localeCompare(b.especialidade || "");
      if (specCompare !== 0) return specCompare;
      return (a.nome || "").localeCompare(b.nome || "");
    });

    const groups: { [key: string]: ConsolidatedRecord[] } = {};
    sortedBySpecialty.forEach(rec => {
      const spec = rec.especialidade || "Operacional";
      if (!groups[spec]) {
        groups[spec] = [];
      }
      groups[spec].push(rec);
    });

    let currentRow = 8;

    Object.keys(groups).forEach(spec => {
      const groupRows = groups[spec];
      const groupSize = groupRows.length;

      // Apply vertical merge on Column A (Specialty) for this group
      if (groupSize > 1) {
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + groupSize - 1, c: 0 } });
      }

      groupRows.forEach((rec, idx) => {
        // Specialty is written on the first cell of the group, styled for all rows
        writeCell(currentRow, 0, idx === 0 ? spec : "", excelStyles.specialtyCell);

        // Name
        writeCell(currentRow, 1, rec.nome, excelStyles.nameCell);
        // Matricula
        writeCell(currentRow, 2, rec.matricula, excelStyles.centerCell);
        // CPF
        writeCell(currentRow, 3, rec.cpf, excelStyles.centerCell);
        // Habilitação
        writeCell(currentRow, 4, rec.habilitacao || "Nenhuma", excelStyles.leftCell);

        // Overtime Hour Columns (with highlighted backgrounds matching PDF)
        writeCell(currentRow, 5, formatExcelHours(rec.he50), excelStyles.skyHourCell);
        writeCell(currentRow, 6, formatExcelHours(rec.he100), excelStyles.roseHourCell);
        writeCell(currentRow, 7, formatExcelHours(rec.adNoturno50), excelStyles.skyHourCell);
        writeCell(currentRow, 8, formatExcelHours(rec.adNoturno100), excelStyles.roseHourCell);

        // Empty physical blank columns (Faltas, Férias)
        writeCell(currentRow, 9, "", excelStyles.centerCell);
        writeCell(currentRow, 10, "", excelStyles.centerCell);
        writeCell(currentRow, 11, "", excelStyles.centerCell);

        // VT & VA (with conditional colors)
        const vt = rec.recebeValeTransporte ? rec.recebeValeTransporte.toUpperCase().trim() : "NÃO";
        const va = rec.recebeValeAlimentacao ? rec.recebeValeAlimentacao.toUpperCase().trim() : "SIM";
        writeCell(currentRow, 12, vt, vt === "SIM" ? excelStyles.simCell : excelStyles.naoCell);
        writeCell(currentRow, 13, va, va === "SIM" ? excelStyles.simCell : excelStyles.naoCell);

        // Checkboxes (Excel specific: marked cells are filled with blue header bg and contain "X" in white text; unmarked are blank)
        writeCell(currentRow, 14, rec.adicionalCondutor ? "X" : "", rec.adicionalCondutor ? excelStyles.checkedCheckboxCell : excelStyles.uncheckedCheckboxCell);
        writeCell(currentRow, 15, rec.periculosidade ? "X" : "", rec.periculosidade ? excelStyles.checkedCheckboxCell : excelStyles.uncheckedCheckboxCell);
        writeCell(currentRow, 16, rec.insalubridade ? "X" : "", rec.insalubridade ? excelStyles.checkedCheckboxCell : excelStyles.uncheckedCheckboxCell);

        currentRow++;
      });
    });

    // --- Footer Row: Totals Summary ---
    for (let c = 0; c < 17; c++) {
      writeCell(currentRow, c, "", excelStyles.footerSummary);
    }
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 16 } });
    writeCell(currentRow, 0, `Total de Funcionários Terceirizados na unidade = ${processedRecords.length}`, excelStyles.footerSummary);

    // Apply merges
    ws["!merges"] = merges;
    ws["!ref"] = `A1:Q${currentRow + 1}`;

    // Define column widths for a clean high-density layout
    const colWidths = [
      { wch: 22 }, // Col A: EQUIPE/DESCRIÇÃO
      { wch: 38 }, // Col B: NOME DO PROFISSIONAL
      { wch: 11 }, // Col C: MAT
      { wch: 16 }, // Col D: CPF
      { wch: 22 }, // Col E: HABILITAÇÃO
      { wch: 14 }, // Col F: HE 50%
      { wch: 14 }, // Col G: HE 100%
      { wch: 14 }, // Col H: AD NOT 50% (SEG-SÁB)
      { wch: 14 }, // Col I: AD NOT 100% (DOM-FER)
      { wch: 10 }, // Col J: Faltas
      { wch: 11 }, // Col K: Férias 10
      { wch: 11 }, // Col L: Férias 30
      { wch: 12 }, // Col M: VT
      { wch: 12 }, // Col N: VA
      { wch: 14 }, // Col O: CONDUTOR
      { wch: 15 }, // Col P: PERICULOSIDADE
      { wch: 15 }  // Col Q: INSALUBRIDADE
    ];
    ws["!cols"] = colWidths;

    // Define row heights
    const rowHeights: any[] = [];
    // Corporate Header (Rows 1-5) -> 20pt
    for (let i = 0; i < 5; i++) {
      rowHeights.push({ hpt: 20 });
    }
    // Spacing Row (Row 6) -> 12pt
    rowHeights.push({ hpt: 12 });
    // Headers Row 7 & 8 -> 26pt
    rowHeights.push({ hpt: 26 });
    rowHeights.push({ hpt: 26 });
    // Data Rows -> 20pt
    for (let i = 8; i < currentRow; i++) {
      rowHeights.push({ hpt: 20 });
    }
    // Footer Row -> 22pt
    rowHeights.push({ hpt: 22 });

    ws["!rows"] = rowHeights;

    // Create workbook and trigger download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Fechamento Servitium");

    // Generate Excel file buffer safely in client-side without calling Node fs.writeFileSync
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hora Extra CMA SUL Servitium - ${formattedPeriod}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (records.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // 1. Draw Corporate Header box
    // Enclosing rectangle
    doc.setDrawColor(11, 60, 131);
    doc.setLineWidth(0.3);
    doc.rect(8, 8, 281, 40); // Y=8 to 48, X=8 to 289

    // Columns separators
    doc.line(56, 8, 56, 48);  // Separator 1 (56 is a multiple of 8)
    doc.line(240, 8, 240, 48); // Separator 2 (240 is a multiple of 8)

    // Column 1: Logo & CMA SUL
    try {
      doc.addImage(SERVITIUM_LOGO_BASE64, "PNG", 16, 12, 32, 12);
    } catch (e) {
      console.warn("Could not insert base64 logo, using fallback", e);
      // Draw stylized S logo emblem
      doc.setFillColor(139, 0, 0); // Dark Red
      doc.rect(16, 12, 8, 8, "F");
      doc.setTextColor(255, 215, 0); // Gold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("S", 18, 18.5);

      doc.setTextColor(139, 0, 0); // Dark Red
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SERVITIUM", 26, 18.5);
    }

    doc.setTextColor(11, 60, 131); // Deep Blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("CMA SUL", 32, 38, { align: "center" });

    // Column 2: Center info details
    doc.setTextColor(11, 60, 131); // Deep Blue for company name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("COMPESA – COMPANHIA PERNAMBUCANA DE SANEAMENTO", 60, 14);

    doc.setTextColor(51, 65, 85); // Slate/Dark Gray
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("SETOR: GERÊNCIA DE PRODUÇÃO METROPOLITANA- GPM/CMA SUL", 60, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("CGC 09.769.035/0001-64 – IE 18.1.001.0014398-6", 60, 25);
    doc.setFont("helvetica", "bold");
    doc.text("ETA PIRAPAMA - BR Sul KM 100, SN - Pirapama, Cabo de Santo Agostinho - PE", 60, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("EMPRESA: SERVITIUM EIRELI LTDA", 60, 38);
    doc.text("CONTRATO: CT.PS.22.4.417 - MANUT DAS UNIDADES OPERACIONAIS", 60, 43);

    // Column 3: Month/Year formatted like Março-2026
    const formattedPeriod = periodName.replace(/[\s\/]+/g, "-");
    doc.setTextColor(11, 60, 131); // Deep Blue
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(formattedPeriod, 264.5, 28, { align: "center" });

    // 1.5. Draw Stats Cards Row
    const cardY = 52;
    const cardHeight = 12; // 12mm is a multiple of 4
    const cardWidth = 53;
    const gap = 4; // 4mm gap

    const cardsData = [
      {
        title: "ACUMULADO GERAL",
        value: stats.totalOvertime,
        label: "HE 50% + 100% + Not 50% + 100%",
        badge: "TOTAL HE",
        badgeColor: [0, 0, 0], // Black
        textColor: [249, 115, 22] // Orange #f97316
      },
      {
        title: "HORAS EXTRAS 50% (SEG-SÁB)",
        value: stats.he50,
        label: "Geral Acumulado 50%",
        badge: "HE 50%",
        badgeColor: [11, 60, 131], // Corporate Blue #0b3c83
        textColor: [11, 60, 131] // Corporate Blue
      },
      {
        title: "HORAS EXTRAS 100% (DOM-FER)",
        value: stats.he100,
        label: "Geral Acumulado 100%",
        badge: "HE 100%",
        badgeColor: [0, 0, 0], // Black
        textColor: [185, 28, 28] // Red #b91c1c
      },
      {
        title: "HORAS EXTRAS ADICIONAL NOTURNA 50%",
        value: stats.adNot50,
        label: "Geral Acumulado Not 50%",
        badge: "NOT 50%",
        badgeColor: [11, 60, 131], // Corporate Blue #0b3c83
        textColor: [11, 60, 131] // Corporate Blue
      },
      {
        title: "HORAS EXTRAS ADICIONAL NOTURNA 100%",
        value: stats.adNot100,
        label: "Geral Acumulado Not 100%",
        badge: "NOT 100%",
        badgeColor: [0, 0, 0], // Black
        textColor: [185, 28, 28] // Red #b91c1c
      }
    ];

    cardsData.forEach((card, index) => {
      const cardX = 8 + index * (cardWidth + gap);

      // Card Background with slight border matching corporate blue
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(11, 60, 131); // Corporate Blue #0b3c83
      doc.setLineWidth(0.2);
      doc.rect(cardX, cardY, cardWidth, cardHeight, "FD");

      // Title (top left)
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.text(card.title, cardX + 2.5, cardY + 3.5);

      // Large Value (bottom left)
      doc.setTextColor(card.textColor[0], card.textColor[1], card.textColor[2]);
      doc.setFont("helvetica", "bold");
      if (card.title === "ACUMULADO GERAL") {
        doc.setFontSize(13); // larger!
      } else {
        doc.setFontSize(9);
      }
      doc.text(card.value, cardX + 2.5, cardY + 9.5);

      // Label (bottom right / side of value)
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont("helvetica", "normal");
      doc.setFontSize(4.5);
      doc.text(card.label, cardX + cardWidth - 2.5, cardY + 9.5, { align: "right" });
    });

    // 2. Prep Nested Headers exactly matching image
    const headers: any = [
      [
        { content: "EQUIPE/DESCRIÇÃO", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "NOME DO PROFISSIONAL", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "MAT", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "CPF", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "HABILITAÇÃO", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "HORA EXTRA\nSEGUNDA A\nSÁBADO 50%", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "HORA EXTRA\nDOMINGOS E\nFERIADOS 100%", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "HORA EXTRA NOTURNA 50% DAS\n22:00 ÀS 05:00", colSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "DIAS DE\nFALTAS", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "FÉRIAS\nTRABALHANDO\n10 DIAS", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "FÉRIAS\nGOZANDO 30\nDIAS", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "RECEBE VALE\nTRANSPORTE", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "RECEBE VALE\nALIMENTAÇÃO", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "ADICIONAL DE\nCONDUTOR", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "PERICULOSIDADE", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "INSALUBRIDADE", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "SEGUNDA A\nSÁBADO", styles: { halign: "center", valign: "middle" } },
        { content: "DOMINGOS E\nFERIADOS", styles: { halign: "center", valign: "middle" } }
      ]
    ];

    // 3. Sort by specialty, then name to allow beautiful vertical merging
    const sortedBySpecialty = [...processedRecords].sort((a, b) => {
      const specCompare = (a.especialidade || "").localeCompare(b.especialidade || "");
      if (specCompare !== 0) return specCompare;
      return (a.nome || "").localeCompare(b.nome || "");
    });

    // 4. Construct body rows with grouping logic (rowSpan on specialty)
    const body: any[] = [];
    const groups: { [key: string]: typeof sortedBySpecialty } = {};
    sortedBySpecialty.forEach(rec => {
      const spec = rec.especialidade || "Operacional";
      if (!groups[spec]) {
        groups[spec] = [];
      }
      groups[spec].push(rec);
    });

    Object.keys(groups).forEach(spec => {
      const groupRows = groups[spec];
      groupRows.forEach((rec, idx) => {
        const rowCells: any[] = [];
        
        // 1. EQUIPE/DESCRIÇÃO
        if (idx === 0) {
          rowCells.push({ 
            content: spec, 
            rowSpan: groupRows.length,
            styles: { 
              halign: "center", 
              valign: "middle", 
              fontStyle: "bold",
              fillColor: undefined,
              textColor: [11, 60, 131]
            } 
          });
        }
        
        // 2. NOME
        rowCells.push({ content: rec.nome, styles: { fontStyle: "bold", textColor: [0, 0, 0] } });
        // 3. MATRICULA
        rowCells.push({ content: rec.matricula, styles: { halign: "center" } });
        // 4. CPF
        rowCells.push({ content: rec.cpf, styles: { halign: "center" } });
        // 5. HABILITAÇÃO
        rowCells.push({ content: rec.habilitacao || "Nenhuma" });

        // Hours helper
        const formatHours = (timeStr: string) => {
          if (!timeStr || timeStr === "00:00") return "";
          const [h] = timeStr.split(":");
          const hoursNum = parseInt(h, 10);
          return hoursNum > 0 ? String(hoursNum) : "";
        };

        // 6. HE 50%
        rowCells.push({ content: formatHours(rec.he50), styles: { halign: "center", fontStyle: "bold" } });
        // 7. HE 100%
        rowCells.push({ content: formatHours(rec.he100), styles: { halign: "center", fontStyle: "bold" } });
        // 8. AD NOT SEG-SAB
        rowCells.push({ content: formatHours(rec.adNoturno50), styles: { halign: "center", fontStyle: "bold" } });
        // 9. AD NOT DOM-FER
        rowCells.push({ content: formatHours(rec.adNoturno100), styles: { halign: "center", fontStyle: "bold" } });

        // 10. DIAS DE FALTAS
        rowCells.push({ content: "" });
        // 11. FÉRIAS 10
        rowCells.push({ content: "" });
        // 12. FÉRIAS 30
        rowCells.push({ content: "" });

        // 13. VT & 14. VA (with custom color green/gray)
        const vt = rec.recebeValeTransporte ? rec.recebeValeTransporte.toUpperCase().trim() : "NÃO";
        const va = rec.recebeValeAlimentacao ? rec.recebeValeAlimentacao.toUpperCase().trim() : "SIM";
        rowCells.push({ content: vt, styles: { halign: "center", fontStyle: "bold", textColor: vt === "SIM" ? [4, 120, 87] : [148, 163, 184] } });
        rowCells.push({ content: va, styles: { halign: "center", fontStyle: "bold", textColor: va === "SIM" ? [4, 120, 87] : [148, 163, 184] } });

        // 15. AD CONDUTOR, 16. PERICULOSIDADE, 17. INSALUBRIDADE
        rowCells.push({ content: "", styles: { halign: "center" } });
        rowCells.push({ content: "", styles: { halign: "center" } });
        rowCells.push({ content: "", styles: { halign: "center" } });

        body.push(rowCells);
      });
    });

    // 5. Draw PDF Table
    autoTable(doc, {
      startY: 68,
      head: headers,
      body: body,
      theme: "grid",
      headStyles: {
        fillColor: [11, 60, 131],
        textColor: [255, 255, 255],
        fontSize: 4.0,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        cellPadding: 0.5
      },
      columnStyles: {
        0: { cellWidth: 24, halign: "center", valign: "middle", fontSize: 6.5 }, // EQUIPE/DESCRIÇÃO
        1: { cellWidth: 41, valign: "middle", fontSize: 6.5 },                   // NOME
        2: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6 },   // MATRÍCULA
        3: { cellWidth: 23, halign: "center", valign: "middle", fontSize: 6 },   // CPF
        4: { cellWidth: 30, valign: "middle", fontSize: 6.5 },                   // HABILITAÇÃO
        5: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // HE 50%
        6: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // HE 100%
        7: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // AD NOT SEG-SAB
        8: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // AD NOT DOM-FER
        9: { cellWidth: 11, halign: "center", valign: "middle", fontSize: 6 },   // DIAS DE FALTAS
        10: { cellWidth: 11, halign: "center", valign: "middle", fontSize: 6 },  // FÉRIAS 10
        11: { cellWidth: 11, halign: "center", valign: "middle", fontSize: 6 },  // FÉRIAS 30
        12: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6 },  // VT
        13: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6 },  // VA
        14: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // CONDUTOR
        15: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }, // PERICULOSIDADE
        16: { cellWidth: 13, halign: "center", valign: "middle", fontSize: 6.5 }  // INSALUBRIDADE
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      styles: {
        font: "helvetica",
        fontSize: 6.5,
        cellPadding: 1.2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: [0, 0, 0]
      },
      margin: { left: 8, right: 8 },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.column.index === 5) {
            data.cell.styles.fillColor = [240, 249, 255]; // sky-50 (#f0f9ff)
          } else if (data.column.index === 6) {
            data.cell.styles.fillColor = [255, 241, 242]; // amber-50 (#fffbeb)
          } else if (data.column.index === 7) {
            data.cell.styles.fillColor = [240, 249, 255]; // violet-50 (#f5f3ff)
          } else if (data.column.index === 8) {
            data.cell.styles.fillColor = [255, 241, 242]; // rose-50 (#fff1f2)
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === "body" && [14, 15, 16].includes(data.column.index)) {
          const rec = sortedBySpecialty[data.row.index];
          if (!rec) return;

          let isChecked = false;
          if (data.column.index === 14) isChecked = !!rec.adicionalCondutor;
          if (data.column.index === 15) isChecked = !!rec.periculosidade;
          if (data.column.index === 16) isChecked = !!rec.insalubridade;

          const boxSize = 3.2; // mm
          const boxX = data.cell.x + (data.cell.width - boxSize) / 2;
          const boxY = data.cell.y + (data.cell.height - boxSize) / 2;

          if (isChecked) {
            // Fill with deep blue
            doc.setFillColor(11, 60, 131); // #0b3c83
            doc.setDrawColor(11, 60, 131);
            doc.setLineWidth(0.1);
            doc.rect(boxX, boxY, boxSize, boxSize, "FD");

            // Draw white checkmark inside
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.35);
            // scaling checkmark coordinates inside box
            doc.line(boxX + 0.8, boxY + 1.6, boxX + 1.4, boxY + 2.3);
            doc.line(boxX + 1.4, boxY + 2.3, boxX + 2.5, boxY + 0.9);
          } else {
            // Unchecked: empty white box with slate border
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(148, 163, 184); // slate-400
            doc.setLineWidth(0.2);
            doc.rect(boxX, boxY, boxSize, boxSize, "FD");
          }
        }
      },
      foot: [
        [
          { 
            content: `Total de Funcionários Terceirizados na unidade = ${processedRecords.length}`, 
            colSpan: 17, 
            styles: { 
              fillColor: [11, 60, 131], 
              textColor: [255, 255, 255], 
              fontStyle: "bold", 
              fontSize: 8,
              halign: "left",
              cellPadding: 2 
            } 
          }
        ]
      ]
    });



    doc.save(`Servitium_Fechamento_${formattedPeriod}.pdf`);
  };

  // Grouping logic for preview (exactly like PDF)
  const previewData = useMemo(() => {
    const sorted = [...processedRecords].sort((a, b) => {
      const specCompare = (a.especialidade || "").localeCompare(b.especialidade || "");
      if (specCompare !== 0) return specCompare;
      return (a.nome || "").localeCompare(b.nome || "");
    });

    const groups: { [key: string]: ConsolidatedRecord[] } = {};
    sorted.forEach(rec => {
      const spec = rec.especialidade || "Operacional";
      if (!groups[spec]) {
        groups[spec] = [];
      }
      groups[spec].push(rec);
    });

    return { sorted, groups };
  }, [processedRecords]);

  const formatHours = (timeStr: string) => {
    if (!timeStr || timeStr === "00:00") return "";
    const [h] = timeStr.split(":");
    const hoursNum = parseInt(h, 10);
    return hoursNum > 0 ? String(hoursNum) : "";
  };

  return (
    <div id="card-tabela-consolidada" className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-sm p-4">
      {/* Header with quick action buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1e2029] pb-2 mb-4 gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange-500" />
          <h2 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider font-sans">
            04 — Consolidação e Fechamento de Folha ({records.length})
          </h2>
        </div>

        {/* Export and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowRoundConfirm(true)}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-[#181921] border border-orange-500/40 hover:bg-orange-500/10 hover:border-orange-500 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-transparent text-orange-400 font-bold text-[11px] px-4 py-2 rounded transition-all cursor-pointer"
            title="Arredondar horas consolidadas individualmente pelo critério dos 30 minutos"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Aplicar Critério dos 30 Minutos</span>
          </button>
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-[#181921] border border-orange-500/40 hover:bg-orange-500/10 hover:border-orange-500 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-transparent text-orange-400 font-bold text-[11px] px-4 py-2 rounded transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizar Prévia</span>
          </button>
          <button
            onClick={exportToExcel}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold text-[11px] px-4 py-2 rounded transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-[#181921] border border-[#262836] hover:border-orange-500/80 hover:text-[#f8fafc] disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-transparent text-slate-300 font-bold text-[11px] px-4 py-2 rounded transition-all cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-[#181921] border border-red-500/40 hover:bg-red-500/10 hover:border-red-500 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-transparent text-red-400 font-bold text-[11px] px-4 py-2 rounded transition-all cursor-pointer"
            title="Limpar todos os registros consolidados de uma única vez"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Relatório</span>
          </button>
        </div>
      </div>

      {/* 30-Minute Criterion Confirmation Modal */}
      {showRoundConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-orange-500 pb-2 border-b border-[#1e2029]">
              <Clock className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-sans">
                Aplicar Critério dos 30 Minutos
              </h3>
            </div>
            
            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                Esta operação irá percorrer todos os funcionários que já possuem horas extras consolidadas e aplicar automaticamente o arredondamento em cada categoria de horas:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 font-mono">
                <li>HE 50%</li>
                <li>HE 100%</li>
                <li>Ad. Not. 50%</li>
                <li>Ad. Not. 100%</li>
              </ul>
              <div className="bg-[#181921] border border-[#262836] p-2.5 rounded text-[11px] space-y-1 text-slate-400 font-mono">
                <div className="font-bold text-orange-400 uppercase tracking-wider text-[9px] mb-1">Regra de Arredondamento:</div>
                <div>• Minutos <strong className="text-white">&lt; 30</strong> → arredondar para a hora atual.</div>
                <div>• Minutos <strong className="text-white">&gt;= 30</strong> → arredondar para a próxima hora.</div>
              </div>
              <p className="text-orange-400/90 font-semibold bg-orange-500/10 border border-orange-500/20 p-2.5 rounded">
                Atenção: Os valores consolidados serão alterados. Os registros de lançamentos diários individuais de origem não serão recalculados.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2029]">
              <button
                type="button"
                onClick={() => setShowRoundConfirm(false)}
                className="bg-[#181921] hover:bg-[#262836] text-slate-300 border border-[#262836] hover:border-slate-500 font-bold text-xs px-4 py-2 rounded cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyRounding}
                className="bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 font-bold text-xs px-4 py-2 rounded cursor-pointer transition-colors shadow-sm"
              >
                Aplicar Arredondamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Report Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#111217] border border-[#1e2029] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-[#1e2029]">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-sans">
                Limpar Relatório Consolidado
              </h3>
            </div>
            
            <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                Tem certeza que deseja limpar **todos os registros consolidados** de uma única vez?
              </p>
              <p className="text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded">
                Atenção: Esta ação é irreversível e removerá todos os {records.length} colaboradores atualmente consolidados no fechamento deste período. Os lançamentos diários individuais não serão afetados.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2029]">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="bg-[#181921] hover:bg-[#262836] text-slate-300 border border-[#262836] hover:border-slate-500 font-bold text-xs px-4 py-2 rounded cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateAllRecords([], "Todos os registros consolidados foram excluídos com sucesso.");
                  setShowClearConfirm(false);
                }}
                className="bg-red-500 hover:bg-red-600 text-white border border-red-600 font-bold text-xs px-4 py-2 rounded cursor-pointer transition-colors shadow-sm"
              >
                Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Section: Bloomberg/Stripe-like High-density Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        {/* Total General Overtime */}
        <div className="bg-[#181921] border border-[#262836] hover:border-orange-500/40 py-2 px-4 rounded flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans truncate">
              Acumulado Geral
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-orange-500 font-mono tracking-tight">
              {stats.totalOvertime}
            </span>
            <span className="text-[9px] text-orange-500/80 font-sans font-bold">hrs</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 font-sans leading-none flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            HE 50% + 100% + Not 50% + 100%
          </div>
        </div>

        {/* HE 50% */}
        <div className="bg-[#181921] border border-[#262836] hover:border-[#0b3c83]/50 py-2 px-4 rounded flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans truncate">
              HE 50% Seg-Sáb
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#38bdf8] font-mono tracking-tight">
              {stats.he50}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">hrs</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 font-sans leading-none">
            Geral Acumulado
          </div>
        </div>

        {/* HE 100% */}
        <div className="bg-[#181921] border border-[#262836] hover:border-slate-400/40 py-2 px-4 rounded flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans truncate">
              HE 100% Dom-Fer
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-red-500 font-mono tracking-tight">
              {stats.he100}
            </span>
            <span className="text-[9px] text-red-500/70 font-sans">hrs</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 font-sans leading-none">
            Geral Acumulado
          </div>
        </div>

        {/* Ad. Noturno 50% */}
        <div className="bg-[#181921] border border-[#262836] hover:border-[#0b3c83]/50 py-2 px-4 rounded flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans truncate">
              Ad. Noturno 50%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-indigo-400 font-mono tracking-tight">
              {stats.adNot50}
            </span>
            <span className="text-[9px] text-slate-500 font-sans">hrs</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 font-sans leading-none">
            Geral Acumulado
          </div>
        </div>

        {/* Ad. Noturno 100% */}
        <div className="bg-[#181921] border border-[#262836] hover:border-slate-400/40 py-2 px-4 rounded flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans truncate">
              Ad. Noturno 100%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-rose-400 font-mono tracking-tight">
              {stats.adNot100}
            </span>
            <span className="text-[9px] text-rose-500/70 font-sans">hrs</span>
          </div>
          <div className="mt-2 text-[9px] text-slate-500 font-sans leading-none">
            Geral Acumulado
          </div>
        </div>
      </div>

      {/* Filter and Sorting bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Pesquisar consolidado por nome, cpf ou matrícula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#181921] border border-[#262836] text-xs text-[#f8fafc] rounded pl-8 pr-4 py-2 focus:outline-none focus:border-orange-500 font-sans placeholder-slate-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
        </div>

        {/* Alphabetic sort button */}
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center justify-center gap-2 border border-[#262836] bg-[#181921] hover:bg-[#262836] hover:border-orange-500 text-slate-300 rounded px-4 py-2 text-xs font-bold font-sans cursor-pointer transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-orange-500" />
          <span>Ordem Alfabética ({sortAsc ? "A-Z" : "Z-A"})</span>
        </button>
      </div>

      {/* High Density Table Container */}
      <div className="overflow-x-auto border border-[#1e2029] bg-[#0a0b0d] rounded-md">
        <table className="w-full text-left border-collapse font-sans min-w-[1000px]">
          <thead className="bg-[#181921] text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#1e2029]">
            <tr>
              <th className="py-2 px-4 font-sans font-bold">Nome do Profissional</th>
              <th className="py-2 px-4 text-center font-sans font-bold">MAT</th>
              <th className="py-2 px-4 text-center font-sans font-bold">CPF</th>
              <th className="py-2 px-4 font-sans font-bold">Habilitação</th>
              <th className="py-2 px-2 text-center bg-sky-950/20 text-sky-400">HE 50%</th>
              <th className="py-2 px-2 text-center bg-amber-950/20 text-amber-400">HE 100%</th>
              <th className="py-2 px-2 text-center bg-indigo-950/20 text-indigo-400">Ad. Not 50%</th>
              <th className="py-2 px-2 text-center bg-rose-950/20 text-rose-400">Ad. Not 100%</th>
              <th className="py-2 px-4 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2029]/60 text-xs">
            {processedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500 font-medium font-sans">
                  Nenhum funcionário consolidado para o fechamento. Use o botão &quot;Transferir&quot; acima para consolidar os lançamentos.
                </td>
              </tr>
            ) : (
              processedRecords.map((rec) => {
                const isEditing = editingMatricula === rec.matricula;

                return (
                  <tr key={rec.matricula} className="hover:bg-[#1c1d27]/50 transition-colors">
                    {/* Name */}
                    <td className="py-2 px-4 font-bold text-[#f8fafc]">
                      {rec.nome}
                    </td>

                    {/* Matricula */}
                    <td className="py-2 px-4 text-center font-mono text-slate-400 font-bold">
                      {rec.matricula}
                    </td>

                    {/* CPF */}
                    <td className="py-2 px-4 text-center font-mono text-slate-400">
                      {rec.cpf}
                    </td>

                    {/* Habilitacao */}
                    <td className="py-2 px-4 text-slate-400 max-w-[120px] truncate" title={rec.habilitacao}>
                      {rec.habilitacao || <span className="text-slate-600">—</span>}
                    </td>

                    {/* HE 50% */}
                    <td 
                      className="py-2 px-2 text-center bg-sky-950/5 hover:bg-sky-950/20 cursor-pointer transition-colors"
                      onClick={() => !isEditing && startEditing(rec)}
                      title="Clique para editar HE 50%"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBuffer.he50 || ""}
                          onChange={(e) => handleBufferTimeChange("he50", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditing(rec.matricula);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          autoFocus
                          className="w-20 bg-[#181921] border border-sky-500/60 rounded px-2 py-1 text-center font-mono text-xs text-sky-400 focus:outline-none focus:border-sky-400 font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold text-sky-400">{rec.he50}</span>
                      )}
                    </td>

                    {/* HE 100% */}
                    <td 
                      className="py-2 px-2 text-center bg-amber-950/5 hover:bg-amber-950/20 cursor-pointer transition-colors"
                      onClick={() => !isEditing && startEditing(rec)}
                      title="Clique para editar HE 100%"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBuffer.he100 || ""}
                          onChange={(e) => handleBufferTimeChange("he100", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditing(rec.matricula);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="w-20 bg-[#181921] border border-amber-500/60 rounded px-2 py-1 text-center font-mono text-xs text-amber-400 focus:outline-none focus:border-amber-400 font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold text-amber-400">{rec.he100}</span>
                      )}
                    </td>

                    {/* Ad. Noturno 50% */}
                    <td 
                      className="py-2 px-2 text-center bg-indigo-950/5 hover:bg-indigo-950/20 cursor-pointer transition-colors"
                      onClick={() => !isEditing && startEditing(rec)}
                      title="Clique para editar Ad. Not. 50%"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBuffer.adNoturno50 || ""}
                          onChange={(e) => handleBufferTimeChange("adNoturno50", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditing(rec.matricula);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="w-20 bg-[#181921] border border-indigo-500/60 rounded px-2 py-1 text-center font-mono text-xs text-indigo-400 focus:outline-none focus:border-indigo-400 font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold text-indigo-400">{rec.adNoturno50}</span>
                      )}
                    </td>

                    {/* Ad. Noturno 100% */}
                    <td 
                      className="py-2 px-2 text-center bg-rose-950/5 hover:bg-rose-950/20 cursor-pointer transition-colors"
                      onClick={() => !isEditing && startEditing(rec)}
                      title="Clique para editar Ad. Not. 100%"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBuffer.adNoturno100 || ""}
                          onChange={(e) => handleBufferTimeChange("adNoturno100", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditing(rec.matricula);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="w-20 bg-[#181921] border border-rose-500/60 rounded px-2 py-1 text-center font-mono text-xs text-rose-400 focus:outline-none focus:border-rose-400 font-bold"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-400">{rec.adNoturno100}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-4 text-center border-l border-[#1e2029]/30">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEditing(rec.matricula)}
                              className="p-2 bg-emerald-950 border border-emerald-800 rounded hover:bg-emerald-900 text-emerald-400 transition-colors cursor-pointer"
                              title="Salvar alterações"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-2 bg-zinc-800 border border-[#262836] rounded hover:bg-zinc-700 text-slate-300 transition-colors cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : confirmDeleteMatricula === rec.matricula ? (
                          <>
                            <button
                              onClick={() => {
                                onRemoveRecord(rec.matricula);
                                setConfirmDeleteMatricula(null);
                              }}
                              className="p-2 bg-rose-950 border border-rose-800 rounded hover:bg-rose-900 text-rose-400 transition-colors cursor-pointer"
                              title="Confirmar exclusão"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMatricula(null)}
                              className="p-2 bg-zinc-800 border border-[#262836] rounded hover:bg-zinc-700 text-slate-300 transition-colors cursor-pointer"
                              title="Cancelar exclusão"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(rec)}
                              className="p-2 border border-transparent hover:border-[#262836] hover:bg-[#181921] text-slate-400 hover:text-orange-500 transition-all rounded cursor-pointer"
                              title="Editar horas consolidado"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMatricula(rec.matricula)}
                              className="p-2 border border-transparent hover:border-rose-950 hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-all rounded cursor-pointer"
                              title="Excluir do consolidado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PDF Print Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col p-4 md:p-8 overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-[#111217] border border-[#1e2029] p-4 rounded-t-xl max-w-[1400px] w-full mx-auto">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-sans uppercase tracking-wider">
                  Visualização Prévia do PDF Oficial
                </h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Layout de alta fidelidade para folha A4 Paisagem (Servitium & COMPESA)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-zinc-850 hover:bg-zinc-800 border border-[#262836] hover:border-orange-500 text-slate-200 font-bold text-xs px-4 py-2 rounded transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-orange-500" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Baixar PDF Oficial</span>
              </button>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="flex items-center justify-center p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-rose-500 text-slate-400 hover:text-slate-100 rounded transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Interactive Document Area */}
          <div className="flex-1 overflow-auto bg-[#07080a] p-4 md:p-8 flex justify-start lg:justify-center items-start rounded-b-xl max-w-[1400px] w-full mx-auto border-x border-b border-[#1e2029] shadow-inner">
            <div className="bg-white text-black p-8 shadow-2xl rounded-sm border border-slate-300 min-w-[1250px] w-[1250px] font-sans relative my-auto select-none">
              {/* COMPESA & SERVITIUM CORPORATE HEADER */}
              <div className="border-[1.5px] border-[#0b3c83] flex w-full mb-4 text-[9px] leading-tight">
                {/* COL 1: Logo & CMA SUL */}
                <div className="w-[18%] p-4 border-r-[1.5px] border-[#0b3c83] flex flex-col justify-between items-center bg-[#f8fafc]">
                  <div className="flex items-center justify-center w-full min-h-[56px]">
                    <img 
                      src={SERVITIUM_LOGO_BASE64} 
                      alt="Servitium Logo" 
                      className="h-15 w-auto max-w-full object-contain" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h1 className="text-xl font-black text-[#0b3c83] mt-4 tracking-tight">CMA SUL</h1>
                </div>

                {/* COL 2: Center Info Details */}
                <div className="w-[66%] p-4 border-r-[1.5px] border-[#0b3c83] flex flex-col gap-2 text-slate-800">
                  <h2 className="text-[#0b3c83] font-extrabold text-[10px] tracking-wide">
                    COMPESA – COMPANHIA PERNAMBUCANA DE SANEAMENTO
                  </h2>
                  <h3 className="font-bold text-slate-700 text-[9px]">
                    SETOR: GERÊNCIA DE PRODUÇÃO METROPOLITANA- GPM/CMA SUL
                  </h3>
                  <p className="text-slate-500 text-[8px] font-mono">
                    CGC 09.769.035/0001-64 – IE 18.1.001.0014398-6
                  </p>
                  <p className="font-bold text-black text-[8px]">
                    ETA PIRAPAMA - BR Sul KM 100, SN - Pirapama, Cabo de Santo Agostinho - PE
                  </p>
                  <p className="font-bold text-slate-900 text-[8px] mt-2">
                    EMPRESA: SERVITIUM EIRELI LTDA
                  </p>
                  <p className="font-bold text-slate-900 text-[8px]">
                    CONTRATO: CT.PS.22.4.417 - MANUT DAS UNIDADES OPERACIONAIS
                  </p>
                </div>

                {/* COL 3: Month/Year */}
                <div className="w-[16%] p-4 flex items-center justify-center bg-[#f8fafc]">
                  <span className="text-lg font-black text-[#0b3c83] tracking-tight whitespace-nowrap uppercase">
                    {periodName.replace(/[\s\/]+/g, "-")}
                  </span>
                </div>
              </div>

              {/* STATS CARDS ROW */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {/* Total General Overtime */}
                <div className="bg-[#f8fafc] border-[1.5px] border-[#0b3c83] py-2 px-4 rounded flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans truncate">
                      Acumulado Geral
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[17px] font-black text-orange-600 font-sans tracking-tight">
                      {stats.totalOvertime}
                    </span>
                    <span className="text-[7.5px] font-extrabold text-orange-600 font-sans">hrs</span>
                  </div>
                  <div className="mt-2 text-[6.5px] text-slate-400 font-sans leading-none flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                    HE 50% + 100% + Not 50% + 100%
                  </div>
                </div>

                {/* HE 50% */}
                <div className="bg-[#f8fafc] border-[1.5px] border-[#0b3c83] py-2 px-4 rounded flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans truncate">
                      HORAS EXTRAS 50% (SEG-SÁB)
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-[#0b3c83] font-sans tracking-tight">
                      {stats.he50}
                    </span>
                    <span className="text-[6.5px] text-[#0b3c83]/70 font-sans">hrs</span>
                  </div>
                  <div className="mt-2 text-[6.5px] text-slate-400 font-sans leading-none">
                    Geral Acumulado
                  </div>
                </div>

                {/* HE 100% */}
                <div className="bg-[#f8fafc] border-[1.5px] border-[#0b3c83] py-2 px-4 rounded flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans truncate">
                      HORAS EXTRAS 100% (DOM-FER)
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-red-600 font-sans tracking-tight">
                      {stats.he100}
                    </span>
                    <span className="text-[6.5px] text-red-600/80 font-sans">hrs</span>
                  </div>
                  <div className="mt-2 text-[6.5px] text-slate-400 font-sans leading-none">
                    Geral Acumulado
                  </div>
                </div>

                {/* Ad. Noturno 50% */}
                <div className="bg-[#f8fafc] border-[1.5px] border-[#0b3c83] py-2 px-4 rounded flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans truncate">
                      HORAS EXTRAS ADICIONAL NOTURNA 50%
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-[#0b3c83] font-sans tracking-tight">
                      {stats.adNot50}
                    </span>
                    <span className="text-[6.5px] text-[#0b3c83]/70 font-sans">hrs</span>
                  </div>
                  <div className="mt-2 text-[6.5px] text-slate-400 font-sans leading-none">
                    Geral Acumulado
                  </div>
                </div>

                {/* Ad. Noturno 100% */}
                <div className="bg-[#f8fafc] border-[1.5px] border-[#0b3c83] py-2 px-4 rounded flex flex-col justify-between transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider font-sans truncate">
                      HORAS EXTRAS ADICIONAL NOTURNA 100%
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-extrabold text-red-600 font-sans tracking-tight">
                      {stats.adNot100}
                    </span>
                    <span className="text-[6.5px] text-red-600/80 font-sans">hrs</span>
                  </div>
                  <div className="mt-2 text-[6.5px] text-slate-400 font-sans leading-none">
                    Geral Acumulado
                  </div>
                </div>
              </div>

              {/* TABLE CONTAINER */}
              <div className="border border-[#0b3c83] overflow-hidden">
                <table className="w-full border-collapse text-[8px]">
                  <thead>
                    <tr className="bg-[#0b3c83] text-white">
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[7.5px]" rowSpan={2}>EQUIPE/DESCRIÇÃO</th>
                      <th className="border border-[#0b3c83] p-2 text-left font-bold text-[7.5px]" rowSpan={2}>NOME DO PROFISSIONAL</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[7.5px]" rowSpan={2}>MAT</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[7.5px]" rowSpan={2}>CPF</th>
                      <th className="border border-[#0b3c83] p-2 text-left font-bold text-[7.5px]" rowSpan={2}>HABILITAÇÃO</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>HORA EXTRA<br/>SEGUNDA A<br/>SÁBADO 50%</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>HORA EXTRA<br/>DOMINGOS E<br/>FERIADOS 100%</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" colSpan={2}>HORA EXTRA NOTURNA 50% DAS 22:00 ÀS 05:00</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>DIAS DE<br/>FALTAS</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>FÉRIAS<br/>TRABALHANDO<br/>10 DIAS</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>FÉRIAS<br/>GOZANDO 30<br/>DIAS</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>RECEBE VALE<br/>TRANSPORTE</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>RECEBE VALE<br/>ALIMENTAÇÃO</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>ADICIONAL DE<br/>CONDUTOR</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>PERICULOSIDADE</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6.5px] leading-tight" rowSpan={2}>INSALUBRIDADE</th>
                    </tr>
                    <tr className="bg-[#0b3c83] text-white">
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6px]">SEGUNDA A SÁBADO</th>
                      <th className="border border-[#0b3c83] p-2 text-center font-bold text-[6px]">DOMINGOS E FERIADOS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0b3c83]/50">
                    {Object.keys(previewData.groups).length === 0 ? (
                      <tr>
                        <td colSpan={17} className="text-center p-8 text-slate-500 font-bold text-[10px]">
                          Nenhum registro consolidado para este período.
                        </td>
                      </tr>
                    ) : (
                      Object.keys(previewData.groups).map(spec => {
                        const groupRows = previewData.groups[spec];
                        return groupRows.map((rec, idx) => {
                          const vt = rec.recebeValeTransporte ? rec.recebeValeTransporte.toUpperCase().trim() : "NÃO";
                          const va = rec.recebeValeAlimentacao ? rec.recebeValeAlimentacao.toUpperCase().trim() : "SIM";

                          return (
                            <tr key={rec.matricula} className="hover:bg-slate-50 transition-colors">
                              {/* 1. EQUIPE/DESCRIÇÃO */}
                              {idx === 0 && (
                                <td 
                                  rowSpan={groupRows.length} 
                                  className="border border-[#0b3c83] bg-transparent p-2 text-center font-bold text-slate-800 text-[8.5px] uppercase align-middle"
                                >
                                  {spec}
                                </td>
                              )}
                              
                              {/* 2. NOME */}
                              <td className="border border-[#0b3c83] p-2 font-bold text-black text-[8.5px]">{rec.nome}</td>
                              
                              {/* 3. MATRICULA */}
                              <td className="border border-[#0b3c83] p-2 text-center font-mono text-slate-700">{rec.matricula}</td>
                              
                              {/* 4. CPF */}
                              <td className="border border-[#0b3c83] p-2 text-center font-mono text-slate-700 whitespace-nowrap">{rec.cpf}</td>
                              
                              {/* 5. HABILITAÇÃO */}
                              <td className="border border-[#0b3c83] p-2 text-slate-700">{rec.habilitacao || "Nenhuma"}</td>
                              
                              {/* 6. HE 50% */}
                              <td className="border border-[#0b3c83] p-2 text-center font-bold text-black bg-[#f0f9ff]">{formatHours(rec.he50)}</td>
                              
                              {/* 7. HE 100% */}
                              <td className="border border-[#0b3c83] p-2 text-center font-bold text-black bg-[#fff1f2]">{formatHours(rec.he100)}</td>
                              
                              {/* 8. AD NOT SEG-SAB */}
                              <td className="border border-[#0b3c83] p-2 text-center font-bold text-black bg-[#f0f9ff]">{formatHours(rec.adNoturno50)}</td>
                              
                              {/* 9. AD NOT DOM-FER */}
                              <td className="border border-[#0b3c83] p-2 text-center font-bold text-black bg-[#fff1f2]">{formatHours(rec.adNoturno100)}</td>
                              
                              {/* 10. FALTAS */}
                              <td className="border border-[#0b3c83] p-2 text-center text-slate-400"></td>
                              
                              {/* 11. FERIAS 10 */}
                              <td className="border border-[#0b3c83] p-2 text-center text-slate-400"></td>
                              
                              {/* 12. FERIAS 30 */}
                              <td className="border border-[#0b3c83] p-2 text-center text-slate-400"></td>
                              
                              {/* 13. VT */}
                              <td className={`border border-[#0b3c83] p-2 text-center font-bold text-[8px] ${vt === "SIM" ? "text-emerald-700" : "text-slate-400"}`}>
                                {vt}
                              </td>
                              
                              {/* 14. VA */}
                              <td className={`border border-[#0b3c83] p-2 text-center font-bold text-[8px] ${va === "SIM" ? "text-emerald-700" : "text-slate-400"}`}>
                                {va}
                              </td>
                              
                              {/* 15. AD CONDUTOR */}
                              <td className="border border-[#0b3c83] p-2 text-center bg-transparent">
                                <div className="flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    checked={!!rec.adicionalCondutor}
                                    onChange={(e) => onUpdateRecord(rec.matricula, { adicionalCondutor: e.target.checked })}
                                    className="w-4 h-4 rounded border-[#0b3c83] text-[#0b3c83] focus:ring-[#0b3c83] bg-white cursor-pointer accent-[#0b3c83] transition-all"
                                  />
                                </div>
                              </td>
                              
                              {/* 16. PERICULOSIDADE */}
                              <td className="border border-[#0b3c83] p-2 text-center bg-transparent">
                                <div className="flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    checked={!!rec.periculosidade}
                                    onChange={(e) => onUpdateRecord(rec.matricula, { periculosidade: e.target.checked })}
                                    className="w-4 h-4 rounded border-[#0b3c83] text-[#0b3c83] focus:ring-[#0b3c83] bg-white cursor-pointer accent-[#0b3c83] transition-all"
                                  />
                                </div>
                              </td>
                              
                              {/* 17. INSALUBRIDADE */}
                              <td className="border border-[#0b3c83] p-2 text-center bg-transparent">
                                <div className="flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    checked={!!rec.insalubridade}
                                    onChange={(e) => onUpdateRecord(rec.matricula, { insalubridade: e.target.checked })}
                                    className="w-4 h-4 rounded border-[#0b3c83] text-[#0b3c83] focus:ring-[#0b3c83] bg-white cursor-pointer accent-[#0b3c83] transition-all"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0b3c83] text-white">
                      <td colSpan={17} className="p-2 text-left font-bold text-[10px] tracking-wide">
                        Total de Funcionários Terceirizados na unidade = {processedRecords.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>


            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility to help typescript determine if row is editing
function isWritetable(b: boolean): b is true {
  return b === true;
}
