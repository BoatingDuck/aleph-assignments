export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "doing" | "done";

export const priorityRank: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3
};

export function seoulDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}


export function dateValueToSeoulDateString(value: unknown) {
  if (value == null || value === "") return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = value instanceof Date ? value : new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : seoulDateString(parsed);
}

export function cleanTags(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, 12);
}

export function asNonNegativeInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}
