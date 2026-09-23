export const SALON_OPEN_HOUR = 9;
export const SALON_CLOSE_HOUR = 19;
export const SLOT_STEP_MINUTES = 30;

export function generateCandidateSlots(dateISO: string, totalDurationMinutes: number): Date[] {
  const [year, month, day] = dateISO.split("-").map(Number);
  const slots: Date[] = [];

  const dayStart = new Date(year, month - 1, day, SALON_OPEN_HOUR, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, SALON_CLOSE_HOUR, 0, 0, 0);

  let cursor = new Date(dayStart);
  while (cursor.getTime() + totalDurationMinutes * 60_000 <= dayEnd.getTime()) {
    slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000);
  }
  return slots;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
