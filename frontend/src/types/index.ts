export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

export interface Account {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: Role;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  durationMinutes: number;
  isActive: boolean;
}

export interface StaffMember {
  id: string;
  fullName: string;
  staffProfile?: { specialties?: string | null; active?: boolean } | null;
}

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type BookingSource = "QUICK" | "ACCOUNT";
export type PaymentMethod = "ONLINE" | "OFFLINE";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export interface AppointmentServiceItem {
  service: Service;
  priceAtBooking: string;
  durationAtBooking: number;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  paidAt?: string | null;
}

export interface Appointment {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  source?: BookingSource;
  resultNotes?: string | null;
  staff?: StaffMember | null;
  customer?: { id: string; fullName: string; phone: string } | null;
  services: AppointmentServiceItem[];
  review?: Review | null;
  payment?: Payment | null;
}

export interface AvailabilitySlot {
  start: string;
  freeStaffIds: string[];
}

export interface CustomerRow {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  locked: boolean;
  isQuickProfile: boolean;
  createdAt: string;
}

export type FaceShape = "OVAL" | "ROUND" | "SQUARE" | "HEART" | "LONG" | "DIAMOND";
export type Gender = "MALE" | "FEMALE";

export interface Hairstyle {
  id: string;
  name: string;
  gender: Gender;
  faceShapes: FaceShape[];
  colorTag?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  bookingIntent?: { staffId?: string; serviceIds?: string; date?: string; time?: string };
}

export interface ReportSummary {
  range: { from: string; to: string };
  totalAppointments: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  staffPerformance: { staffId: string; fullName: string; completedCount: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number }[];
}
