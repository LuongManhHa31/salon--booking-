import { prisma } from "../prisma";
import { generateCandidateSlots, rangesOverlap } from "./schedule";

export interface AvailableSlot {
  start: string;
  freeStaffIds: string[];
}

export async function computeAvailableSlots(
  date: string,
  serviceIds: string[],
  staffId?: string
): Promise<{ totalDurationMinutes: number; slots: AvailableSlot[] } | { error: string }> {
  const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, isActive: true } });
  if (services.length !== serviceIds.length) {
    return { error: "Một hoặc nhiều dịch vụ không hợp lệ" };
  }
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);

  const candidateStaff = staffId
    ? await prisma.account.findMany({ where: { id: staffId, role: "STAFF", staffProfile: { active: true } } })
    : await prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } } });

  if (candidateStaff.length === 0) {
    return { error: "Không tìm thấy nhân viên khả dụng" };
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      staffId: { in: candidateStaff.map((s) => s.id) },
      status: { in: ["PENDING", "CONFIRMED"] },
      scheduledStart: { lte: dayEnd },
      scheduledEnd: { gte: dayStart },
    },
  });

  const slots = generateCandidateSlots(date, totalDuration)
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
  const candidateStaff = staffId
    ? await prisma.account.findMany({ where: { id: staffId, role: "STAFF", staffProfile: { active: true } } })
    : await prisma.account.findMany({ where: { role: "STAFF", staffProfile: { active: true } } });

  if (candidateStaff.length === 0) return null;

  const existingAppointments = await prisma.appointment.findMany({
    where: { staffId: { in: candidateStaff.map((s) => s.id) }, status: { in: ["PENDING", "CONFIRMED"] } },
  });

  return (
    candidateStaff.find((staff) => {
      const conflict = existingAppointments.some(
        (appt) => appt.staffId === staff.id && rangesOverlap(start, end, appt.scheduledStart, appt.scheduledEnd)
      );
      return !conflict;
    }) ?? null
  );
}
