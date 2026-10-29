import { prisma } from "../prisma";
import { generateCandidateSlots, rangesOverlap } from "./schedule";
import { withDbTimeout } from "./dbTimeout";
import { FALLBACK_SERVICES, FALLBACK_STAFF, MOCK_APPOINTMENTS } from "./mockStore";

export interface AvailableSlot {
  start: string;
  freeStaffIds: string[];
}

export async function computeAvailableSlots(
  date: string,
  serviceIds: string[],
  staffId?: string
): Promise<{ totalDurationMinutes: number; slots: AvailableSlot[] } | { error: string }> {
  let services: { id: string; name: string; durationMinutes: number }[] = [];

  try {
    services = await withDbTimeout(
      prisma.service.findMany({ where: { id: { in: serviceIds }, isActive: true } }),
      2000
    );
  } catch (err) {
    // DB offline, fallback to in-memory services
  }

  if (services.length !== serviceIds.length) {
    // Fill missing services from FALLBACK_SERVICES
    const fallbackMatches = FALLBACK_SERVICES.filter((s) => serviceIds.includes(s.id));
    services = fallbackMatches;
  }

  if (services.length === 0) {
    return { error: "Không tìm thấy dịch vụ tương ứng" };
  }

  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

  let candidateStaff: { id: string; fullName: string }[] = [];
  try {
    candidateStaff = staffId
      ? await withDbTimeout(
          prisma.account.findMany({ where: { id: staffId, role: "STAFF", staffProfile: { active: true } } }),
          2000
        )
      : await withDbTimeout(
          prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } } }),
          2000
        );
  } catch (err) {
    // DB offline
  }

  if (candidateStaff.length === 0) {
    candidateStaff = staffId
      ? FALLBACK_STAFF.filter((s) => s.id === staffId)
      : FALLBACK_STAFF;
  }

  if (candidateStaff.length === 0) {
    return { error: "Không tìm thấy nhân viên khả dụng" };
  }

  const dayStart = new Date(`${date}T00:00:00+07:00`);
  const dayEnd = new Date(`${date}T23:59:59+07:00`);

  let existingAppointments: { staffId: string | null; scheduledStart: Date; scheduledEnd: Date }[] = [];
  try {
    const dbAppts = await withDbTimeout(
      prisma.appointment.findMany({
        where: {
          staffId: { in: candidateStaff.map((s) => s.id) },
          status: { in: ["PENDING", "CONFIRMED"] },
          scheduledStart: { lte: dayEnd },
          scheduledEnd: { gte: dayStart },
        },
      }),
      2000
    );
    existingAppointments = dbAppts;
  } catch (err) {
    // DB offline
  }

  // Combine with in-memory mock appointments
  const mockDayAppts = MOCK_APPOINTMENTS.filter((a) => {
    if (a.status !== "PENDING" && a.status !== "CONFIRMED") return false;
    const start = new Date(a.scheduledStart);
    return start >= dayStart && start <= dayEnd;
  }).map((a) => ({
    staffId: a.staffId,
    scheduledStart: new Date(a.scheduledStart),
    scheduledEnd: new Date(a.scheduledEnd),
  }));

  existingAppointments = [...existingAppointments, ...mockDayAppts];

  const candidateTimes = generateCandidateSlots(date, totalDuration);
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + 10 * 60_000);

  const slots = candidateTimes
    .filter((slotStart) => {
      // Nếu là khung giờ đã trôi qua trong ngày hôm nay thì bỏ qua
      return slotStart.getTime() >= minBookingTime.getTime();
    })
    .map((slotStart) => {
      const slotEnd = new Date(slotStart.getTime() + totalDuration * 60_000);
      const freeStaffIds = candidateStaff
        .filter((staff) => {
          const conflict = existingAppointments.some(
            (appt) => appt.staffId === staff.id && rangesOverlap(slotStart, slotEnd, appt.scheduledStart, appt.scheduledEnd)
          );
          return !conflict;
        })
        .map((s) => s.id);
      return { start: slotStart.toISOString(), freeStaffIds };
    })
    .filter((slot) => slot.freeStaffIds.length > 0);

  return { totalDurationMinutes: totalDuration, slots };
}

export async function findAssignableStaff(staffId: string | undefined, start: Date, end: Date) {
  let candidateStaff: { id: string; fullName: string }[] = [];
  try {
    candidateStaff = staffId
      ? await withDbTimeout(
          prisma.account.findMany({ where: { id: staffId, role: "STAFF", staffProfile: { active: true } } }),
          2000
        )
      : await withDbTimeout(
          prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } } }),
          2000
        );
  } catch (err) {
    // DB offline
  }

  if (candidateStaff.length === 0) {
    candidateStaff = staffId
      ? FALLBACK_STAFF.filter((s) => s.id === staffId)
      : FALLBACK_STAFF;
  }

  if (candidateStaff.length === 0) return null;

  let existingAppointments: { staffId: string | null; scheduledStart: Date; scheduledEnd: Date }[] = [];
  try {
    existingAppointments = await withDbTimeout(
      prisma.appointment.findMany({
        where: { staffId: { in: candidateStaff.map((s) => s.id) }, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      2000
    );
  } catch (err) {
    // DB offline
  }

  const mockAppts = MOCK_APPOINTMENTS.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED").map((a) => ({
    staffId: a.staffId,
    scheduledStart: new Date(a.scheduledStart),
    scheduledEnd: new Date(a.scheduledEnd),
  }));

  const allAppts = [...existingAppointments, ...mockAppts];

  return (
    candidateStaff.find((staff) => {
      const conflict = allAppts.some(
        (appt) => appt.staffId === staff.id && rangesOverlap(start, end, appt.scheduledStart, appt.scheduledEnd)
      );
      return !conflict;
    }) ?? null
  );
}
