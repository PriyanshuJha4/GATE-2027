import { ErrorLogEntry } from "./types";
import { daysBetween } from "./countdown";

// An error-log entry is "due" for re-testing 3, 7, and 30 days after it was logged.
const INTERVALS = [3, 7, 30];

export interface DueReview {
  entry: ErrorLogEntry;
  intervalDay: number;
}

export function getDueReviews(entries: ErrorLogEntry[]): DueReview[] {
  const todayISO = new Date().toISOString().slice(0, 10);
  const due: DueReview[] = [];

  for (const entry of entries) {
    const age = daysBetween(entry.log_date, todayISO);

    for (const interval of INTERVALS) {
      if (age === interval) {
        due.push({ entry, intervalDay: interval });
      }
    }
  }

  return due;
}