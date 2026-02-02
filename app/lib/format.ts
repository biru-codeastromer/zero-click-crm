import type { CrmEntry } from "@/app/lib/types";

export function formatMoneyUsd(value: number | null): string {
  if (value === null) return "N/A";
  return `$${value.toLocaleString("en-US")}`;
}

export function formatBoolean(value: boolean | null): string {
  if (value === null) return "N/A";
  return value ? "Yes" : "No";
}

export function formatTimestamp(value: CrmEntry["created_at"], locale?: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(locale || undefined);
}

export function formatText(value: string | null): string {
  if (!value) return "N/A";
  return value;
}
