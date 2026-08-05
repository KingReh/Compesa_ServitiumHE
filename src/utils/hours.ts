/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a time string "HH:MM" (or "H:MM", or "HHH:MM") to total minutes.
 * Returns 0 if invalid or empty.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  if (parts.length !== 2) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Converts total minutes back to "HH:MM" format.
 * Zero-pads both hours and minutes to maintain double-digit format.
 */
export function minutesToTime(totalMinutes: number): string {
  if (totalMinutes <= 0 || isNaN(totalMinutes)) return "00:00";
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");

  return `${hStr}:${mStr}`;
}

/**
 * Validates if a string is a valid time in HH:MM format (hours can have 2 or more digits, minutes must be 00-59)
 */
export function isValidTime(timeStr: string): boolean {
  if (!timeStr) return true; // Empty is fine (represents 00:00)
  const regex = /^\d+:[0-5]\d$/;
  return regex.test(timeStr.trim());
}

/**
 * Takes a raw keystroke value and formats/applies a clean HH:MM mask while typing.
 * Rules:
 * - Only allow numbers and colon.
 * - Max length of 5 (or more if they type 3 digits for hours, but standard daily is max 24 hours, so e.g. "99:59").
 * Let's make a highly interactive mask:
 * - Strip out all non-digits.
 * - Limit to 4 digits (HHMM).
 * - If length is 3 or 4, format as HH:MM.
 */
export function applyTimeMask(rawValue: string): string {
  // Strip non-digits
  const digits = rawValue.replace(/\D/g, "");
  
  if (digits.length === 0) {
    return "";
  }
  
  if (digits.length <= 2) {
    return digits;
  }
  
  const hours = digits.slice(0, 2);
  let minutes = digits.slice(2, 4);

  // Validate minutes to not exceed 59 when fully typed
  if (minutes.length === 2) {
    const minsNum = parseInt(minutes, 10);
    if (minsNum > 59) {
      minutes = "59";
    }
  }

  return `${hours}:${minutes}`;
}

/**
 * Format a finished string (like on blur) to ensure it is fully compliant "HH:MM".
 * E.g., "5" -> "05:00", "05:1" -> "05:10", "1:3" -> "01:30"
 */
export function normalizeTimeOnBlur(timeStr: string): string {
  const clean = timeStr.trim();
  if (!clean) return "00:00";

  // If it already matches HH:MM perfectly
  if (/^\d{2}:[0-5]\d$/.test(clean)) {
    return clean;
  }

  // If it's just numbers
  const digits = clean.replace(/\D/g, "");
  if (!digits) return "00:00";

  if (digits.length === 1) {
    return `0${digits}:00`;
  } else if (digits.length === 2) {
    return `${digits}:00`;
  } else if (digits.length === 3) {
    const hours = `0${digits.slice(0, 1)}`;
    const minutes = `${digits.slice(1, 3)}`;
    const minsVal = parseInt(minutes, 10);
    const validMins = minsVal > 59 ? "59" : minutes;
    return `${hours}:${validMins}`;
  } else {
    const hours = digits.slice(0, 2);
    const minutes = digits.slice(2, 4).padEnd(2, "0");
    const minsVal = parseInt(minutes, 10);
    const validMins = minsVal > 59 ? "59" : minutes;
    return `${hours}:${validMins}`;
  }
}

/**
 * Rounds a time string "HH:MM" according to the 30-Minute Criterion:
 * - Minutes < 30 -> round down to current hour (e.g. 12:29 -> 12:00)
 * - Minutes >= 30 -> round up to next hour (e.g. 12:30 -> 13:00)
 */
export function roundTo30MinCriterion(timeStr: string): string {
  if (!timeStr || timeStr.trim() === "") return "00:00";
  const parts = timeStr.trim().split(":");
  if (parts.length !== 2) return timeStr;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return timeStr;

  if (minutes < 30) {
    return `${String(hours).padStart(2, "0")}:00`;
  } else {
    return `${String(hours + 1).padStart(2, "0")}:00`;
  }
}

