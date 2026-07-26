/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

export const YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"];

export const DAYS_OF_WEEK_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Gets the number of days in a given month and year.
 * Correctly accounts for leap years.
 */
export function getDaysInMonth(monthIndex: number, year: number): number {
  // monthIndex is 0-indexed (0 = Jan, 1 = Feb, etc.)
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Gets the day of the week (short form) for a specific date.
 */
export function getDayOfWeekName(day: number, monthIndex: number, year: number): string {
  const date = new Date(year, monthIndex, day);
  return DAYS_OF_WEEK_SHORT[date.getDay()];
}

/**
 * Checks if a day is a weekend (Saturday = 6 or Sunday = 0)
 */
export function isWeekend(day: number, monthIndex: number, year: number): boolean {
  const date = new Date(year, monthIndex, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Interface representing a holiday
 */
export interface Holiday {
  dateStr: string; // "DD/MM"
  name: string;
  isMobile?: boolean; // Mobile holidays (Carnaval, Sexta-feira Santa, Corpus Christi) are hardcoded per year
}

/**
 * Fixed national holidays in Brazil (DD/MM)
 */
export const FIXED_HOLIDAYS: { [key: string]: string } = {
  "01/01": "Confraternização Universal",
  "21/04": "Tiradentes",
  "01/05": "Dia do Trabalho",
  "07/09": "Independência do Brasil",
  "12/10": "Nossa Senhora Aparecida",
  "02/11": "Finados",
  "15/11": "Proclamação da República",
  "20/11": "Dia da Consciência Negra", // New national holiday since 2023/24
  "25/12": "Natal"
};

/**
 * Mobile holidays in Brazil for years 2025 to 2030
 * Maps "YYYY-MM-DD" to holiday name
 */
export const MOBILE_HOLIDAYS: { [key: string]: string } = {
  // 2025
  "2025-03-04": "Carnaval",
  "2025-04-18": "Sexta-feira Santa",
  "2025-06-19": "Corpus Christi",
  // 2026
  "2026-02-17": "Carnaval",
  "2026-04-03": "Sexta-feira Santa",
  "2026-06-04": "Corpus Christi",
  // 2027
  "2027-02-09": "Carnaval",
  "2027-03-26": "Sexta-feira Santa",
  "2027-05-27": "Corpus Christi",
  // 2028
  "2028-02-29": "Carnaval",
  "2028-04-14": "Sexta-feira Santa",
  "2028-06-15": "Corpus Christi",
  // 2029
  "2029-02-13": "Carnaval",
  "2029-03-30": "Sexta-feira Santa",
  "2029-05-31": "Corpus Christi",
  // 2030
  "2030-03-05": "Carnaval",
  "2030-04-19": "Sexta-feira Santa",
  "2030-06-20": "Corpus Christi"
};

/**
 * Checks if a specific date is a national holiday in Brazil.
 * Returns the holiday name or null.
 */
export function getHolidayName(day: number, monthIndex: number, year: number): string | null {
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(monthIndex + 1).padStart(2, "0");
  const keyFixed = `${dayStr}/${monthStr}`;

  if (FIXED_HOLIDAYS[keyFixed]) {
    return FIXED_HOLIDAYS[keyFixed];
  }

  const dateIso = `${year}-${monthStr}-${dayStr}`;
  if (MOBILE_HOLIDAYS[dateIso]) {
    return MOBILE_HOLIDAYS[dateIso];
  }

  return null;
}
