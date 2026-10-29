import { Service, StaffMember } from "../types";

export const DEFAULT_SERVICES: Service[] = [
  { id: "srv-1", name: "Cắt tóc nam", description: "Cắt gọn gàng theo yêu cầu và phong cách lịch lãm", price: "100000", durationMinutes: 30, isActive: true },
  { id: "srv-2", name: "Cắt tóc nữ", description: "Cắt tạo kiểu tỉa layer theo dáng khuôn mặt", price: "150000", durationMinutes: 45, isActive: true },
  { id: "srv-3", name: "Nhuộm tóc", description: "Nhuộm màu thời trang, chuẩn tone bóng mượt", price: "500000", durationMinutes: 90, isActive: true },
  { id: "srv-4", name: "Uốn tóc", description: "Uốn sóng lơi Hàn Quốc, phồng chân tóc tự nhiên", price: "600000", durationMinutes: 120, isActive: true },
  { id: "srv-5", name: "Duỗi tóc", description: "Duỗi thẳng mượt tự nhiên, phục hồi Keratin", price: "550000", durationMinutes: 100, isActive: true },
  { id: "srv-6", name: "Gội đầu dưỡng sinh", description: "Thư giãn huyệt đạo, massage cổ vai gáy", price: "80000", durationMinutes: 30, isActive: true },
  { id: "srv-7", name: "Lấy ráy tai êm", description: "Làm sạch êm ái, thư giãn thoải mái", price: "50000", durationMinutes: 20, isActive: true },
];

export const DEFAULT_STAFF: StaffMember[] = [
  { id: "staff-1", fullName: "Nguyễn Quang Minh", staffProfile: { specialties: "Cắt tóc, Uốn tạo kiểu" } },
  { id: "staff-2", fullName: "Trần Thu Hà", staffProfile: { specialties: "Nhuộm, Duỗi phục hồi" } },
  { id: "staff-3", fullName: "Bùi Đức Minh", staffProfile: { specialties: "Cắt tóc, Gội đầu dưỡng sinh" } },
  { id: "staff-4", fullName: "Thân Tuấn Vũ", staffProfile: { specialties: "Uốn tóc Hàn Quốc, Nhuộm" } },
];
