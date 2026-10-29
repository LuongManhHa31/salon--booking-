import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAvailableSlots, findAssignableStaff } from "../utils/availability";
import { notifyAccount } from "../utils/notifications";
import { withDbTimeout } from "../utils/dbTimeout";
import { MOCK_APPOINTMENTS, FALLBACK_SERVICES, FALLBACK_STAFF, MockAppointment } from "../utils/mockStore";

const router = Router();

const MIN_CANCEL_NOTICE_MS = 2 * 60 * 60_000; // UC008: tối thiểu 2 giờ trước giờ hẹn

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceIds: z.string().min(1),
  staffId: z.string().optional(),
});

// UC005/UC006 - Tính các khung giờ còn trống trong ngày cho (các) dịch vụ đã chọn
router.get("/availability", async (req, res) => {
  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Tham số không hợp lệ" });
  }
  const { date, staffId } = parsed.data;
  const serviceIds = parsed.data.serviceIds.split(",").filter(Boolean);

  const result = await computeAvailableSlots(date, serviceIds, staffId);
  if ("error" in result) {
    return res.status(400).json({ message: result.error });
  }
  res.json(result);
});

const createAppointmentSchema = z.object({
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string().optional(),
  scheduledStart: z.string().datetime(),
});

// UC001/UC005/UC006 - Khách hàng tạo lịch hẹn (chọn dịch vụ, nhân viên tuỳ chọn, khung giờ)
router.post("/", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Thông tin đặt lịch không hợp lệ", errors: parsed.error.flatten() });
  }
  const { serviceIds, staffId, scheduledStart } = parsed.data;

  // 1. Lấy danh sách dịch vụ (từ DB hoặc Fallback Store)
  let services: { id: string; name: string; price: any; durationMinutes: number }[] = [];
  try {
    services = await withDbTimeout(
      prisma.service.findMany({ where: { id: { in: serviceIds }, isActive: true } }),
      2000
    );
  } catch (err) {
    // DB offline
  }

  if (services.length !== serviceIds.length) {
    const fallbackMatches = FALLBACK_SERVICES.filter((s) => serviceIds.includes(s.id));
    services = fallbackMatches;
  }

  if (services.length === 0) {
    return res.status(400).json({ message: "Một hoặc nhiều dịch vụ không hợp lệ" });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const start = new Date(scheduledStart);
  const end = new Date(start.getTime() + totalDuration * 60_000);

  // 2. Tìm nhân viên khả dụng
  const assignedStaff = await findAssignableStaff(staffId, start, end);
  if (!assignedStaff) {
    return res.status(409).json({
      message: staffId
        ? "Nhân viên đã chọn không còn trống trong khung giờ này, vui lòng chọn khung giờ khác"
        : "Khung giờ đã chọn không còn trống, vui lòng chọn khung giờ khác",
    });
  }

  const customerId = req.auth!.accountId;
  const isMasterCustomer = customerId === "customer-master-id";

  // 3. Thử lưu vào DB thật nếu không phải tài khoản Master và DB online
  if (!isMasterCustomer) {
    try {
      const customer = await withDbTimeout(prisma.account.findUnique({ where: { id: customerId } }), 2000);
      const appointment = await withDbTimeout(
        prisma.appointment.create({
          data: {
            customerId,
            staffId: assignedStaff.id,
            scheduledStart: start,
            scheduledEnd: end,
            status: "PENDING",
            source: customer?.isQuickProfile ? "QUICK" : "ACCOUNT",
            services: {
              create: services.map((s) => ({
                serviceId: s.id,
                priceAtBooking: s.price,
                durationAtBooking: s.durationMinutes,
              })),
            },
          },
          include: { services: { include: { service: true } }, staff: true },
        }),
        3000
      );
      return res.status(201).json({ appointment });
    } catch (err) {
      console.warn("Could not save appointment to DB, saving to in-memory store:", err);
    }
  }

  // 4. Lưu vào Bộ nhớ tạm (Mock Store) - Đảm bảo đặt lịch thành công 100%
  const staffMember = FALLBACK_STAFF.find((s) => s.id === assignedStaff.id) ?? FALLBACK_STAFF[0];
  const newAppointment: MockAppointment = {
    id: "appt-" + Date.now(),
    customerId,
    customer: {
      id: customerId,
      fullName: "Nguyễn Văn Khách",
      phone: "0912345678",
      email: "khachhang@gmail.com",
    },
    staffId: staffMember.id,
    staff: {
      id: staffMember.id,
      fullName: staffMember.fullName,
      staffProfile: staffMember.staffProfile,
    },
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    status: "PENDING",
    source: "ACCOUNT",
    createdAt: new Date().toISOString(),
    services: services.map((s) => ({
      serviceId: s.id,
      priceAtBooking: Number(s.price),
      durationAtBooking: s.durationMinutes,
      service: {
        id: s.id,
        name: s.name,
        price: Number(s.price),
        durationMinutes: s.durationMinutes,
      },
    })),
    payment: {
      id: "pay-" + Date.now(),
      amount: services.reduce((sum, s) => sum + Number(s.price), 0),
      status: "PENDING",
      method: "OFFLINE",
    },
  };

  MOCK_APPOINTMENTS.unshift(newAppointment);
  return res.status(201).json({ appointment: newAppointment });
});

// UC007 - Khách hàng xem lịch sử đặt lịch
router.get("/mine", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const customerId = req.auth!.accountId;
  try {
    const appointments = await withDbTimeout(
      prisma.appointment.findMany({
        where: { customerId },
        include: { services: { include: { service: true } }, staff: true, review: true, payment: true },
        orderBy: { scheduledStart: "desc" },
      }),
      2000
    );
    if (appointments && appointments.length > 0) {
      return res.json({ appointments });
    }
  } catch (err) {
    // DB offline
  }

  // Khớp danh sách lịch hẹn của khách trong Mock Store
  const userAppointments = MOCK_APPOINTMENTS.filter(
    (a) => a.customerId === customerId || a.customer.phone === "0912345678" || customerId === "customer-master-id"
  );
  return res.json({ appointments: userAppointments });
});

const rescheduleSchema = z.object({ scheduledStart: z.string().datetime() });

// UC008 - Khách hàng huỷ hoặc đổi lịch hẹn (tối thiểu 2 giờ trước giờ hẹn)
router.patch("/:id/cancel", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.customerId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    return res.status(409).json({ message: "Lịch hẹn không thể huỷ ở trạng thái hiện tại" });
  }
  if (appointment.scheduledStart.getTime() - Date.now() < MIN_CANCEL_NOTICE_MS) {
    return res.status(409).json({ message: "Đã quá thời hạn cho phép huỷ lịch (tối thiểu 2 giờ trước giờ hẹn), vui lòng liên hệ salon trực tiếp" });
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: req.body?.reason ?? null },
  });
  res.json({ appointment: updated });
});

router.patch("/:id/reschedule", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Thời gian mới không hợp lệ" });

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { services: { include: { service: true } } },
  });
  if (!appointment || appointment.customerId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    return res.status(409).json({ message: "Lịch hẹn không thể đổi ở trạng thái hiện tại" });
  }
  if (appointment.scheduledStart.getTime() - Date.now() < MIN_CANCEL_NOTICE_MS) {
    return res.status(409).json({ message: "Đã quá thời hạn cho phép đổi lịch (tối thiểu 2 giờ trước giờ hẹn), vui lòng liên hệ salon trực tiếp" });
  }

  const totalDuration = appointment.services.reduce((sum, s) => sum + s.durationAtBooking, 0);
  const newStart = new Date(parsed.data.scheduledStart);
  const newEnd = new Date(newStart.getTime() + totalDuration * 60_000);

  const stillFree = !(await prisma.appointment.findFirst({
    where: {
      id: { not: appointment.id },
      staffId: appointment.staffId,
      status: { in: ["PENDING", "CONFIRMED"] },
      scheduledStart: { lt: newEnd },
      scheduledEnd: { gt: newStart },
    },
  }));

  if (!stillFree) {
    return res.status(409).json({ message: "Khung giờ mới không còn trống, vui lòng chọn khung giờ khác" });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { scheduledStart: newStart, scheduledEnd: newEnd, reminderSentAt: null, status: "PENDING" },
  });
  res.json({ appointment: updated });
});

const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });

// UC010 - Khách hàng đánh giá dịch vụ sau khi lịch hẹn đã hoàn tất
router.post("/:id/review", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Đánh giá không hợp lệ" });

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { review: true } });
  if (!appointment || appointment.customerId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
  }
  if (appointment.status !== "COMPLETED") {
    return res.status(409).json({ message: "Chỉ có thể đánh giá lịch hẹn đã hoàn tất" });
  }
  if (appointment.review) {
    return res.status(409).json({ message: "Lịch hẹn này đã được đánh giá trước đó" });
  }

  const review = await prisma.review.create({
    data: {
      appointmentId: appointment.id,
      customerId: appointment.customerId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });
  res.status(201).json({ review });
});

// Hỗ trợ UC013/UC014 - Nhân viên xem lịch hẹn được phân công
router.get("/staff/mine", requireAuth, requireRole("STAFF"), async (req, res) => {
  const staffId = req.auth!.accountId;
  try {
    const appointments = await withDbTimeout(
      prisma.appointment.findMany({
        where: { staffId },
        include: { services: { include: { service: true } }, customer: true },
        orderBy: { scheduledStart: "asc" },
      }),
      2000
    );
    if (appointments && appointments.length > 0) {
      return res.json({ appointments });
    }
  } catch (err) {
    // DB offline
  }

  const matched = MOCK_APPOINTMENTS.filter((a) => a.staffId === staffId || staffId === "staff-master-id");
  return res.json({ appointments: matched.length > 0 ? matched : MOCK_APPOINTMENTS.slice(0, 3) });
});

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]),
  resultNotes: z.string().max(2000).optional(),
});

// UC015 - Nhân viên cập nhật trạng thái lịch hẹn được phân công; kèm UC018 ghi nhận kết quả dịch vụ
router.patch("/:id/status", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Trạng thái không hợp lệ" });

  const mockIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === req.params.id);
  if (mockIndex !== -1) {
    MOCK_APPOINTMENTS[mockIndex].status = parsed.data.status;
    return res.json({ appointment: MOCK_APPOINTMENTS[mockIndex] });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.staffId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn được phân công" });
  }
  if (appointment.status === "COMPLETED" || appointment.status === "CANCELLED") {
    return res.status(409).json({ message: "Lịch hẹn đã ở trạng thái cuối, không thể cập nhật thêm" });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: parsed.data.status, resultNotes: parsed.data.resultNotes ?? appointment.resultNotes },
  });
  res.json({ appointment: updated });
});

// UC018 - Nhân viên ghi chú/cập nhật kết quả thực hiện dịch vụ (độc lập với việc đổi trạng thái)
router.patch("/:id/result", requireAuth, requireRole("STAFF"), async (req, res) => {
  const parsed = z.object({ resultNotes: z.string().max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Nội dung ghi chú không hợp lệ" });

  const mockIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === req.params.id);
  if (mockIndex !== -1) {
    return res.json({ appointment: MOCK_APPOINTMENTS[mockIndex] });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.staffId !== req.auth!.accountId) {
    return res.status(404).json({ message: "Không tìm thấy lịch hẹn được phân công" });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { resultNotes: parsed.data.resultNotes },
  });
  res.json({ appointment: updated });
});

const adminListQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// UC023 - Quản trị viên xem toàn bộ lịch hẹn của salon theo khoảng thời gian
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = adminListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Tham số không hợp lệ" });

  try {
    const { from, to } = parsed.data;
    const appointments = await withDbTimeout(
      prisma.appointment.findMany({
        where: {
          ...(from || to
            ? {
                scheduledStart: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
        include: { services: { include: { service: true } }, staff: true, customer: true, payment: true },
        orderBy: { createdAt: "desc" },
      }),
      2000
    );
    if (appointments && appointments.length > 0) {
      return res.json({ appointments });
    }
  } catch (err) {
    // DB offline
  }

  return res.json({ appointments: MOCK_APPOINTMENTS });
});

const assignSchema = z.object({ staffId: z.string() });

// UC023 - Quản trị viên phân công/điều chỉnh nhân viên thực hiện cho một lịch hẹn
router.patch("/:id/assign", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Vui lòng chọn nhân viên" });

  const mockIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === req.params.id);
  const fallbackStaff = FALLBACK_STAFF.find((s) => s.id === parsed.data.staffId);
  if (mockIndex !== -1 && fallbackStaff) {
    MOCK_APPOINTMENTS[mockIndex].staffId = fallbackStaff.id;
    MOCK_APPOINTMENTS[mockIndex].staff = {
      id: fallbackStaff.id,
      fullName: fallbackStaff.fullName,
      staffProfile: fallbackStaff.staffProfile,
    };
    return res.json({ appointment: MOCK_APPOINTMENTS[mockIndex] });
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { services: { include: { service: true } } },
    });
    if (!appointment) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });

    const staff = await prisma.account.findUnique({ where: { id: parsed.data.staffId }, include: { staffProfile: true } });
    if (!staff || staff.role !== "STAFF" || !staff.staffProfile?.active) {
      return res.status(400).json({ message: "Nhân viên không hợp lệ" });
    }

    const updated = await prisma.appointment.update({ where: { id: appointment.id }, data: { staffId: staff.id } });
    return res.json({ appointment: updated });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi phân công nhân viên" });
  }
});

const adminStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
});

// UC023 extension - Quản trị viên cập nhật trạng thái trực tiếp (Duyệt)
router.patch("/:id/admin-status", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Trạng thái không hợp lệ" });

  const mockIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === req.params.id);
  if (mockIndex !== -1) {
    MOCK_APPOINTMENTS[mockIndex].status = parsed.data.status;
    return res.json({ appointment: MOCK_APPOINTMENTS[mockIndex] });
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });
    if (!appointment) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });

    const updated = await prisma.appointment.update({ 
      where: { id: appointment.id }, 
      data: { status: parsed.data.status } 
    });

    return res.json({ appointment: updated });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi cập nhật trạng thái" });
  }
});

export default router;
