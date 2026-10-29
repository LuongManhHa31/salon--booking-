export interface RegisteredMockAccount {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  passwordHash: string;
  role: "CUSTOMER";
  isQuickProfile: boolean;
}

export const REGISTERED_ACCOUNTS: RegisteredMockAccount[] = [];
export const MOCK_OTP_CODES = new Map<string, { code: string; expiresAt: number }>();

export interface MockService {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface MockStaff {
  id: string;
  fullName: string;
  phone?: string;
  role: "STAFF";
  staffProfile: {
    active: boolean;
    specialties: string;
  };
}

export interface MockAppointment {
  id: string;
  customerId: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
  };
  staffId: string;
  staff: {
    id: string;
    fullName: string;
    staffProfile?: { specialties: string } | null;
  };
  scheduledStart: string;
  scheduledEnd: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  source: "QUICK" | "ACCOUNT";
  createdAt: string;
  services: {
    serviceId: string;
    priceAtBooking: number;
    durationAtBooking: number;
    service: {
      id: string;
      name: string;
      price: number;
      durationMinutes: number;
    };
  }[];
  payment?: {
    id: string;
    amount: number;
    status: "PENDING" | "PAID";
    method: "ONLINE" | "OFFLINE";
  } | null;
  review?: {
    id: string;
    rating: number;
    comment: string;
  } | null;
}

export const FALLBACK_SERVICES: MockService[] = [
  { id: "srv-1", name: "Cắt tóc nam", description: "Cắt gọn gàng theo yêu cầu, tạo kiểu", price: 100000, durationMinutes: 30, isActive: true },
  { id: "srv-2", name: "Cắt tóc nữ", description: "Cắt tạo kiểu theo dáng mặt, layer, bob", price: 150000, durationMinutes: 45, isActive: true },
  { id: "srv-3", name: "Nhuộm tóc", description: "Nhuộm màu thời trang cao cấp", price: 500000, durationMinutes: 90, isActive: true },
  { id: "srv-4", name: "Uốn tóc", description: "Uốn tạo kiểu bồng bềnh, uốn xoăn sóng", price: 600000, durationMinutes: 120, isActive: true },
  { id: "srv-5", name: "Duỗi tóc", description: "Duỗi thẳng, phục hồi keratin", price: 550000, durationMinutes: 100, isActive: true },
  { id: "srv-6", name: "Gội đầu dưỡng sinh", description: "Thư giãn, massage da đầu bấm huyệt", price: 80000, durationMinutes: 30, isActive: true },
  { id: "srv-7", name: "Lấy ráy tai êm", description: "Làm sạch tai êm ái, chuyên nghiệp", price: 50000, durationMinutes: 20, isActive: true },
];

export const FALLBACK_STAFF: MockStaff[] = [
  { id: "staff-1", fullName: "Nguyễn Quang Minh", role: "STAFF", staffProfile: { active: true, specialties: "Cắt tóc, Uốn" } },
  { id: "staff-2", fullName: "Trần Thu Hà", role: "STAFF", staffProfile: { active: true, specialties: "Nhuộm, Duỗi" } },
  { id: "staff-3", fullName: "Bùi Đức Minh", role: "STAFF", staffProfile: { active: true, specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
  { id: "staff-4", fullName: "Thân Tuấn Vũ", role: "STAFF", staffProfile: { active: true, specialties: "Nhuộm, Uốn" } },
  { id: "staff-5", fullName: "Dương Văn Tuấn", role: "STAFF", staffProfile: { active: true, specialties: "Cắt tóc, Duỗi" } },
];

function getRelativeDate(daysOffset: number, hours: number, minutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const MOCK_APPOINTMENTS: MockAppointment[] = [
  {
    id: "appt-001",
    customerId: "cust-001",
    customer: { id: "cust-001", fullName: "Lê Hoàng Nam", phone: "0911223344", email: "nam.le@gmail.com" },
    staffId: "staff-3",
    staff: { id: "staff-3", fullName: "Bùi Đức Minh", staffProfile: { specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
    scheduledStart: getRelativeDate(0, 9, 0),
    scheduledEnd: getRelativeDate(0, 10, 0),
    status: "COMPLETED",
    source: "ACCOUNT",
    createdAt: getRelativeDate(-1, 20, 0),
    services: [
      {
        serviceId: "srv-1",
        priceAtBooking: 100000,
        durationAtBooking: 30,
        service: { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30 },
      },
      {
        serviceId: "srv-6",
        priceAtBooking: 80000,
        durationAtBooking: 30,
        service: { id: "srv-6", name: "Gội đầu dưỡng sinh", price: 80000, durationMinutes: 30 },
      },
    ],
    payment: { id: "pay-001", amount: 180000, status: "PAID", method: "OFFLINE" },
    review: { id: "rev-001", rating: 5, comment: "Dịch vụ rất chu đáo, thợ cắt rất tỉ mỉ và ưng ý!" },
  },
  {
    id: "appt-002",
    customerId: "cust-002",
    customer: { id: "cust-002", fullName: "Trần Thị Thu Thảo", phone: "0987654321", email: "thuthao.tran@gmail.com" },
    staffId: "staff-1",
    staff: { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn" } },
    scheduledStart: getRelativeDate(0, 14, 0),
    scheduledEnd: getRelativeDate(0, 17, 30),
    status: "CONFIRMED",
    source: "ACCOUNT",
    createdAt: getRelativeDate(-1, 15, 30),
    services: [
      {
        serviceId: "srv-4",
        priceAtBooking: 600000,
        durationAtBooking: 120,
        service: { id: "srv-4", name: "Uốn tóc", price: 600000, durationMinutes: 120 },
      },
      {
        serviceId: "srv-3",
        priceAtBooking: 500000,
        durationAtBooking: 90,
        service: { id: "srv-3", name: "Nhuộm tóc", price: 500000, durationMinutes: 90 },
      },
    ],
    payment: { id: "pay-002", amount: 1100000, status: "PAID", method: "ONLINE" },
  },
  {
    id: "appt-003",
    customerId: "cust-003",
    customer: { id: "cust-003", fullName: "Phạm Quỳnh Nga", phone: "0933445566", email: "quynhnga@gmail.com" },
    staffId: "staff-2",
    staff: { id: "staff-2", fullName: "Trần Thu Hà", staffProfile: { specialties: "Nhuộm, Duỗi" } },
    scheduledStart: getRelativeDate(0, 16, 30),
    scheduledEnd: getRelativeDate(0, 17, 35),
    status: "PENDING",
    source: "QUICK",
    createdAt: getRelativeDate(0, 8, 15),
    services: [
      {
        serviceId: "srv-2",
        priceAtBooking: 150000,
        durationAtBooking: 45,
        service: { id: "srv-2", name: "Cắt tóc nữ", price: 150000, durationMinutes: 45 },
      },
      {
        serviceId: "srv-7",
        priceAtBooking: 50000,
        durationAtBooking: 20,
        service: { id: "srv-7", name: "Lấy ráy tai êm", price: 50000, durationMinutes: 20 },
      },
    ],
    payment: { id: "pay-003", amount: 200000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-004",
    customerId: "cust-004",
    customer: { id: "cust-004", fullName: "Vũ Đức Anh", phone: "0944556677", email: "ducanh.vu@gmail.com" },
    staffId: "staff-4",
    staff: { id: "staff-4", fullName: "Thân Tuấn Vũ", staffProfile: { specialties: "Nhuộm, Uốn" } },
    scheduledStart: getRelativeDate(1, 10, 0),
    scheduledEnd: getRelativeDate(1, 11, 40),
    status: "CONFIRMED",
    source: "ACCOUNT",
    createdAt: getRelativeDate(0, 11, 0),
    services: [
      {
        serviceId: "srv-5",
        priceAtBooking: 550000,
        durationAtBooking: 100,
        service: { id: "srv-5", name: "Duỗi tóc", price: 550000, durationMinutes: 100 },
      },
    ],
    payment: { id: "pay-004", amount: 550000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-005",
    customerId: "customer-master-id",
    customer: { id: "customer-master-id", fullName: "Nguyễn Văn Khách", phone: "0912345678", email: "khachhang@gmail.com" },
    staffId: "staff-1",
    staff: { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn" } },
    scheduledStart: getRelativeDate(1, 14, 30),
    scheduledEnd: getRelativeDate(1, 15, 0),
    status: "CONFIRMED",
    source: "ACCOUNT",
    createdAt: getRelativeDate(0, 12, 0),
    services: [
      {
        serviceId: "srv-1",
        priceAtBooking: 100000,
        durationAtBooking: 30,
        service: { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30 },
      },
    ],
    payment: { id: "pay-005", amount: 100000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-006",
    customerId: "cust-005",
    customer: { id: "cust-005", fullName: "Đặng Minh Tuấn", phone: "0988776655", email: "tuan.dang@gmail.com" },
    staffId: "staff-4",
    staff: { id: "staff-4", fullName: "Thân Tuấn Vũ", staffProfile: { specialties: "Uốn tóc Hàn Quốc, Nhuộm" } },
    scheduledStart: getRelativeDate(0, 10, 30),
    scheduledEnd: getRelativeDate(0, 12, 30),
    status: "CONFIRMED",
    source: "QUICK",
    createdAt: getRelativeDate(0, 7, 30),
    services: [
      {
        serviceId: "srv-4",
        priceAtBooking: 600000,
        durationAtBooking: 120,
        service: { id: "srv-4", name: "Uốn tóc", price: 600000, durationMinutes: 120 },
      },
    ],
    payment: { id: "pay-006", amount: 600000, status: "PAID", method: "ONLINE" },
  },
  {
    id: "appt-007",
    customerId: "cust-006",
    customer: { id: "cust-006", fullName: "Hoàng Bích Ngọc", phone: "0977112233", email: "ngoc.hoang@gmail.com" },
    staffId: "staff-3",
    staff: { id: "staff-3", fullName: "Bùi Đức Minh", staffProfile: { specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
    scheduledStart: getRelativeDate(0, 15, 0),
    scheduledEnd: getRelativeDate(0, 16, 15),
    status: "PENDING",
    source: "ACCOUNT",
    createdAt: getRelativeDate(0, 9, 0),
    services: [
      {
        serviceId: "srv-2",
        priceAtBooking: 150000,
        durationAtBooking: 45,
        service: { id: "srv-2", name: "Cắt tóc nữ", price: 150000, durationMinutes: 45 },
      },
      {
        serviceId: "srv-6",
        priceAtBooking: 80000,
        durationAtBooking: 30,
        service: { id: "srv-6", name: "Gội đầu dưỡng sinh", price: 80000, durationMinutes: 30 },
      },
    ],
    payment: { id: "pay-007", amount: 230000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-008",
    customerId: "cust-007",
    customer: { id: "cust-007", fullName: "Trần Văn Hùng", phone: "0909123456", email: "hung.tran@gmail.com" },
    staffId: "staff-1",
    staff: { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn" } },
    scheduledStart: getRelativeDate(0, 11, 30),
    scheduledEnd: getRelativeDate(0, 12, 20),
    status: "CONFIRMED",
    source: "QUICK",
    createdAt: getRelativeDate(0, 8, 45),
    services: [
      {
        serviceId: "srv-1",
        priceAtBooking: 100000,
        durationAtBooking: 30,
        service: { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30 },
      },
      {
        serviceId: "srv-7",
        priceAtBooking: 50000,
        durationAtBooking: 20,
        service: { id: "srv-7", name: "Lấy ráy tai êm", price: 50000, durationMinutes: 20 },
      },
    ],
    payment: { id: "pay-008", amount: 150000, status: "PAID", method: "OFFLINE" },
  },
  {
    id: "appt-009",
    customerId: "cust-008",
    customer: { id: "cust-008", fullName: "Lê Thuỳ Linh", phone: "0966554433", email: "linh.le@gmail.com" },
    staffId: "staff-2",
    staff: { id: "staff-2", fullName: "Trần Thu Hà", staffProfile: { specialties: "Nhuộm, Duỗi" } },
    scheduledStart: getRelativeDate(0, 15, 30),
    scheduledEnd: getRelativeDate(0, 17, 30),
    status: "PENDING",
    source: "ACCOUNT",
    createdAt: getRelativeDate(0, 10, 15),
    services: [
      {
        serviceId: "srv-5",
        priceAtBooking: 550000,
        durationAtBooking: 100,
        service: { id: "srv-5", name: "Duỗi tóc", price: 550000, durationMinutes: 100 },
      },
    ],
    payment: { id: "pay-009", amount: 550000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-010",
    customerId: "cust-009",
    customer: { id: "cust-009", fullName: "Phạm Gia Bảo", phone: "0922334455", email: "bao.pham@gmail.com" },
    staffId: "staff-1",
    staff: { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn" } },
    scheduledStart: getRelativeDate(1, 9, 30),
    scheduledEnd: getRelativeDate(1, 11, 30),
    status: "CONFIRMED",
    source: "QUICK",
    createdAt: getRelativeDate(0, 13, 0),
    services: [
      {
        serviceId: "srv-1",
        priceAtBooking: 100000,
        durationAtBooking: 30,
        service: { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30 },
      },
      {
        serviceId: "srv-3",
        priceAtBooking: 500000,
        durationAtBooking: 90,
        service: { id: "srv-3", name: "Nhuộm tóc", price: 500000, durationMinutes: 90 },
      },
    ],
    payment: { id: "pay-010", amount: 600000, status: "PENDING", method: "OFFLINE" },
  },
  {
    id: "appt-011",
    customerId: "cust-010",
    customer: { id: "cust-010", fullName: "Nguyễn Thị Mai", phone: "0919882211", email: "mai.nguyen@gmail.com" },
    staffId: "staff-3",
    staff: { id: "staff-3", fullName: "Bùi Đức Minh", staffProfile: { specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
    scheduledStart: getRelativeDate(1, 13, 0),
    scheduledEnd: getRelativeDate(1, 14, 15),
    status: "CONFIRMED",
    source: "ACCOUNT",
    createdAt: getRelativeDate(0, 14, 20),
    services: [
      {
        serviceId: "srv-2",
        priceAtBooking: 150000,
        durationAtBooking: 45,
        service: { id: "srv-2", name: "Cắt tóc nữ", price: 150000, durationMinutes: 45 },
      },
      {
        serviceId: "srv-6",
        priceAtBooking: 80000,
        durationAtBooking: 30,
        service: { id: "srv-6", name: "Gội đầu dưỡng sinh", price: 80000, durationMinutes: 30 },
      },
    ],
    payment: { id: "pay-011", amount: 230000, status: "PAID", method: "ONLINE" },
  },
  {
    id: "appt-012",
    customerId: "cust-011",
    customer: { id: "cust-011", fullName: "Bùi Quốc Khánh", phone: "0981239876", email: "khanh.bui@gmail.com" },
    staffId: "staff-4",
    staff: { id: "staff-4", fullName: "Thân Tuấn Vũ", staffProfile: { specialties: "Uốn tóc Hàn Quốc, Nhuộm" } },
    scheduledStart: getRelativeDate(1, 16, 30),
    scheduledEnd: getRelativeDate(1, 19, 0),
    status: "PENDING",
    source: "QUICK",
    createdAt: getRelativeDate(0, 15, 10),
    services: [
      {
        serviceId: "srv-1",
        priceAtBooking: 100000,
        durationAtBooking: 30,
        service: { id: "srv-1", name: "Cắt tóc nam", price: 100000, durationMinutes: 30 },
      },
      {
        serviceId: "srv-4",
        priceAtBooking: 600000,
        durationAtBooking: 120,
        service: { id: "srv-4", name: "Uốn tóc", price: 600000, durationMinutes: 120 },
      },
    ],
    payment: { id: "pay-012", amount: 700000, status: "PENDING", method: "OFFLINE" },
  },
];

export interface FallbackCustomer {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  locked: boolean;
  isQuickProfile: boolean;
  createdAt: string;
}

export const FALLBACK_CUSTOMERS: FallbackCustomer[] = [
  { id: "customer-master-id", fullName: "Nguyễn Văn Khách", phone: "0912345678", email: "khachhang@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-001", fullName: "Lê Hoàng Nam", phone: "0911223344", email: "nam.le@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-002", fullName: "Trần Thị Thu Thảo", phone: "0987654321", email: "thuthao.tran@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-003", fullName: "Phạm Quỳnh Nga", phone: "0933445566", email: "quynhnga@gmail.com", locked: false, isQuickProfile: true, createdAt: new Date().toISOString() },
  { id: "cust-004", fullName: "Vũ Đức Anh", phone: "0944556677", email: "ducanh.vu@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-005", fullName: "Đặng Minh Tuấn", phone: "0988776655", email: "tuan.dang@gmail.com", locked: false, isQuickProfile: true, createdAt: new Date().toISOString() },
  { id: "cust-006", fullName: "Hoàng Bích Ngọc", phone: "0977112233", email: "ngoc.hoang@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-007", fullName: "Trần Văn Hùng", phone: "0909123456", email: "hung.tran@gmail.com", locked: false, isQuickProfile: true, createdAt: new Date().toISOString() },
  { id: "cust-008", fullName: "Lê Thuỳ Linh", phone: "0966554433", email: "linh.le@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-009", fullName: "Phạm Gia Bảo", phone: "0922334455", email: "bao.pham@gmail.com", locked: false, isQuickProfile: true, createdAt: new Date().toISOString() },
  { id: "cust-010", fullName: "Nguyễn Thị Mai", phone: "0919882211", email: "mai.nguyen@gmail.com", locked: false, isQuickProfile: false, createdAt: new Date().toISOString() },
  { id: "cust-011", fullName: "Bùi Quốc Khánh", phone: "0981239876", email: "khanh.bui@gmail.com", locked: false, isQuickProfile: true, createdAt: new Date().toISOString() },
];
