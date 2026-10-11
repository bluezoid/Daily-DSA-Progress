import { calendarDaysUntil } from "@/lib/utils/dates";

export function formatDate(value: string | Date | null | undefined, timezone: string, withTime = false) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}

/** "Due today", "2 days overdue", "in 3 days". */
export function dueLabel(value: string | Date | null | undefined, timezone: string, now = new Date()) {
  if (!value) return "Not scheduled";
  const days = calendarDaysUntil(typeof value === "string" ? new Date(value) : value, now, timezone);
  if (days === 0) return "Due today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function dueTone(value: string | Date | null | undefined, timezone: string, now = new Date()) {
  if (!value) return "none" as const;
  const days = calendarDaysUntil(typeof value === "string" ? new Date(value) : value, now, timezone);
  return days < 0 ? ("overdue" as const) : days === 0 ? ("today" as const) : ("upcoming" as const);
}
