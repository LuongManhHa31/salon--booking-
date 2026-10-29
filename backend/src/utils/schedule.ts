export const SALON_OPEN_HOUR = 9;
export const SALON_CLOSE_HOUR = 19;
export const SLOT_STEP_MINUTES = 30;

export function generateCandidateSlots(dateISO: string, totalDurationMinutes: number): Date[] {
  const openH = String(SALON_OPEN_HOUR).padStart(2, "0");
  const closeH = String(SALON_CLOSE_HOUR).padStart(2, "0");

  // Luôn xác định giờ làm việc theo múi giờ Việt Nam (+07:00) trên mọi môi trường (Render, Vercel, localhost)
  const dayStart = new Date(`${dateISO}T${openH}:00:00+07:00`);
  const dayEnd = new Date(`${dateISO}T${closeH}:00:00+07:00`);
  const slots: Date[] = [];

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
