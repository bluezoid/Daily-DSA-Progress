import { describe, expect, it } from "vitest";
import { computeNextSchedule, initialSchedule, INTERVALS } from "@/services/revisions/schedule";

const now = new Date("2026-03-10T15:30:00Z");
const base = { confidence: 4, restartSchedule: true, now, timezone: "UTC" } as const;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("initialSchedule", () => {
  it("schedules the first revision for the next local day", () => {
    expect(initialSchedule(now, "UTC")).toEqual({ stage: 0, nextRevisionAt: day("2026-03-11") });
  });

  it("uses the user's timezone for 'tomorrow'", () => {
    // 15:30Z is 00:30 on Mar 11 in Tokyo, so tomorrow there is Mar 12 (= Mar 11 15:00Z).
    expect(initialSchedule(now, "Asia/Tokyo").nextRevisionAt.toISOString()).toBe("2026-03-11T15:00:00.000Z");
  });
});

describe("computeNextSchedule", () => {
  it("advances through 3, 7, 14, 30 and then stays at 30 days on success", () => {
    let stage = 0;
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = computeNextSchedule({ ...base, stage, outcome: "solved_independently" });
      seen.push(r.intervalDays);
      stage = r.stageAfter;
    }
    expect(seen).toEqual([3, 7, 14, 30, 30, 30]);
    expect(INTERVALS).toEqual([1, 3, 7, 14, 30]);
  });

  it("does not advance a low-confidence success", () => {
    const r = computeNextSchedule({ ...base, stage: 2, confidence: 2, outcome: "solved_independently" });
    expect(r).toMatchObject({ stageAfter: 2, intervalDays: 7 });
  });

  it("halves the current interval when hints were needed", () => {
    expect(computeNextSchedule({ ...base, stage: 3, outcome: "solved_with_hints" })).toMatchObject({
      stageAfter: 3,
      intervalDays: 7,
    });
    expect(computeNextSchedule({ ...base, stage: 0, outcome: "solved_with_hints" }).intervalDays).toBe(1);
  });

  it.each(["viewed_solution", "unable_to_solve"] as const)("restarts at 1 day after %s by default", (outcome) => {
    const r = computeNextSchedule({ ...base, stage: 4, outcome });
    expect(r).toMatchObject({ stageAfter: 0, intervalDays: 1, restarted: true });
    expect(r.nextRevisionAt).toEqual(day("2026-03-11"));
  });

  it("keeps the stage when the user opts out of restarting", () => {
    const r = computeNextSchedule({ ...base, stage: 4, outcome: "unable_to_solve", restartSchedule: false });
    expect(r).toMatchObject({ stageAfter: 4, intervalDays: 15, restarted: false });
  });

  it("snaps to local midnight across a DST change", () => {
    // US DST starts 2026-03-08. From Mar 7 noon New York, +3 days is Mar 10 00:00 EDT (04:00Z).
    const r = computeNextSchedule({
      ...base,
      now: new Date("2026-03-07T17:00:00Z"),
      timezone: "America/New_York",
      stage: 0,
      outcome: "solved_independently",
    });
    expect(r.nextRevisionAt.toISOString()).toBe("2026-03-10T04:00:00.000Z");
  });

  it("clamps out-of-range stored stages", () => {
    expect(computeNextSchedule({ ...base, stage: 99, outcome: "solved_independently" }).intervalDays).toBe(30);
    expect(computeNextSchedule({ ...base, stage: -3, outcome: "solved_independently" }).intervalDays).toBe(3);
  });
});
