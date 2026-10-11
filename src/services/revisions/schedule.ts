import type { RevisionOutcome } from "@/lib/constants";
import { startOfDayPlus } from "@/lib/utils/dates";

/**
 * Spaced-repetition policy (single source of truth; see README "Revision scheduling").
 *
 * Interval by stage (days): 1, 3, 7, 14, 30. A new version starts at stage 0 (due in 1 day).
 *
 * | Outcome                             | Stage                 | Next interval                      |
 * |-------------------------------------|-----------------------|------------------------------------|
 * | solved_independently, confidence>=3 | stage + 1 (max 4)     | INTERVALS[new stage]               |
 * | solved_independently, confidence<=2 | unchanged             | INTERVALS[stage]                   |
 * | solved_with_hints                   | unchanged             | max(1, floor(INTERVALS[stage]/2))  |
 * | viewed_solution / unable_to_solve   | reset to 0 (default)  | 1 day                              |
 * |   ... with restartSchedule = false  | unchanged             | same as solved_with_hints          |
 *
 * Dates snap to local midnight in the user's timezone, so "due in N days" means
 * "due from the start of the calendar day N days from today".
 */
export const INTERVALS = [1, 3, 7, 14, 30] as const;
export const MAX_STAGE = INTERVALS.length - 1;

export interface ScheduleInput {
  stage: number;
  outcome: RevisionOutcome;
  confidence: number;
  restartSchedule: boolean;
  now: Date;
  timezone: string;
}

export interface ScheduleResult {
  stageAfter: number;
  intervalDays: number;
  nextRevisionAt: Date;
  restarted: boolean;
}

const clampStage = (s: number) => Math.min(Math.max(Math.trunc(s) || 0, 0), MAX_STAGE);
const hintInterval = (stage: number) => Math.max(1, Math.floor(INTERVALS[stage] / 2));

export function computeNextSchedule(input: ScheduleInput): ScheduleResult {
  const stage = clampStage(input.stage);
  let stageAfter = stage;
  let intervalDays: number;
  let restarted = false;

  switch (input.outcome) {
    case "solved_independently":
      if (input.confidence >= 3) stageAfter = Math.min(stage + 1, MAX_STAGE);
      intervalDays = INTERVALS[stageAfter];
      break;
    case "solved_with_hints":
      intervalDays = hintInterval(stage);
      break;
    case "viewed_solution":
    case "unable_to_solve":
      if (input.restartSchedule) {
        stageAfter = 0;
        intervalDays = INTERVALS[0];
        restarted = true;
      } else {
        intervalDays = hintInterval(stage);
      }
      break;
  }

  return {
    stageAfter,
    intervalDays,
    nextRevisionAt: startOfDayPlus(input.now, input.timezone, intervalDays),
    restarted,
  };
}

/** Schedule for a freshly saved solution version. */
export function initialSchedule(now: Date, timezone: string) {
  return { stage: 0, nextRevisionAt: startOfDayPlus(now, timezone, INTERVALS[0]) };
}
