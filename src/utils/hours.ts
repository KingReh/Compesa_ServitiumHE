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
 * Supports hours with 1, 2, 3 or more digits (e.g. 104:36, 120:00).
 */
export function applyTimeMask(rawValue: string): string {
  if (!rawValue) return "";

  // If user typed a colon, honor their explicit separation of hours and minutes
  if (rawValue.includes(":")) {
    const parts = rawValue.split(":");
    const hours = parts[0].replace(/\D/g, "");
    let minutes = parts[1].replace(/\D/g, "").slice(0, 2);

    if (minutes.length === 2) {
      const minsNum = parseInt(minutes, 10);
      if (minsNum > 59) {
        minutes = "59";
      }
    }
    return `${hours}:${minutes}`;
  }

  // Strip non-digits
  const digits = rawValue.replace(/\D/g, "");

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 2) {
    return digits;
  }

  // 3 or 4 digits without colon (e.g., "123" -> "12:3", "1230" -> "12:30")
  if (digits.length <= 4) {
    const hours = digits.slice(0, digits.length <= 3 ? digits.length - 1 : 2);
    let minutes = digits.slice(digits.length <= 3 ? digits.length - 1 : 2);

    if (minutes.length === 2) {
      const minsNum = parseInt(minutes, 10);
      if (minsNum > 59) {
        minutes = "59";
      }
    }
    return `${hours}:${minutes}`;
  }

  // 5 or more digits without colon (e.g., "10436" -> hours "104", minutes "36")
  const hours = digits.slice(0, digits.length - 2);
  let minutes = digits.slice(digits.length - 2);

  const minsNum = parseInt(minutes, 10);
  if (minsNum > 59) {
    minutes = "59";
  }

  return `${hours}:${minutes}`;
}

/**
 * Format a finished string (like on blur) to ensure it is fully compliant "HH:MM" or "HHH:MM".
 * E.g., "104:36" -> "104:36", "104:3" -> "104:30", "5" -> "05:00", "104" -> "104:00"
 */
export function normalizeTimeOnBlur(timeStr: string): string {
  const clean = timeStr.trim();
  if (!clean) return "00:00";

  // If it contains a colon
  if (clean.includes(":")) {
    const parts = clean.split(":");
    const rawH = parts[0].replace(/\D/g, "");
    const rawM = parts[1].replace(/\D/g, "");

    const hoursNum = parseInt(rawH, 10);
    const hStr = isNaN(hoursNum) ? "00" : String(hoursNum).padStart(2, "0");

    let mStr = "00";
    if (rawM.length === 1) {
      mStr = rawM + "0"; // e.g. "3" -> "30"
    } else if (rawM.length >= 2) {
      let mNum = parseInt(rawM.slice(0, 2), 10);
      if (mNum > 59) mNum = 59;
      mStr = String(mNum).padStart(2, "0");
    }

    return `${hStr}:${mStr}`;
  }

  // If no colon
  const digits = clean.replace(/\D/g, "");
  if (!digits) return "00:00";

  if (digits.length === 1) {
    return `0${digits}:00`;
  } else if (digits.length === 2) {
    return `${digits}:00`;
  } else if (digits.length === 3) {
    const val = parseInt(digits, 10);
    if (val >= 100) {
      return `${digits}:00`;
    }
    const hours = `0${digits.slice(0, 1)}`;
    const minutes = digits.slice(1, 3);
    let minsVal = parseInt(minutes, 10);
    if (minsVal > 59) minsVal = 59;
    return `${hours}:${String(minsVal).padStart(2, "0")}`;
  } else {
    // 4 or more digits
    const hoursDigits = digits.slice(0, digits.length - 2);
    const minutesDigits = digits.slice(digits.length - 2);

    const hoursNum = parseInt(hoursDigits, 10) || 0;
    let minsNum = parseInt(minutesDigits, 10) || 0;
    if (minsNum > 59) minsNum = 59;

    const hStr = String(hoursNum).padStart(2, "0");
    const mStr = String(minsNum).padStart(2, "0");

    return `${hStr}:${mStr}`;
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

