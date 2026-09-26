import { PrismaClient, Role, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const admin = await prisma.account.upsert({
    where: { phone: "0900000000" },
    update: {},
    create: {
      phone: "0900000000",
      email: "admin@salon.local",
      passwordHash: adminPasswordHash,
      fullName: "Quản trị viên",
      role: Role.ADMIN,
    },
  });

  const staffPasswordHash = await bcrypt.hash("Staff@123", 10);
  const staffAccounts = await Promise.all(
    [
      { phone: "0900000001", fullName: "Nguyễn Quang Minh", specialties: "Cắt tóc, Uốn" },
      { phone: "0900000002", fullName: "Trần Thu Hà", specialties: "Nhuộm, Duỗi" },
      { phone: "0900000003", fullName: "Bùi Đức Minh", specialties: "Cắt tóc, Gội đầu dưỡng sinh" },
      { phone: "0900000004", fullName: "Thân Tuấn Vũ", specialties: "Nhuộm, Uốn" },
      { phone: "0900000005", fullName: "Dương Văn Tuấn", specialties: "Cắt tóc, Duỗi" },
    ].map((s) =>
      prisma.account.upsert({
        where: { phone: s.phone },
        update: {},
        create: {
          phone: s.phone,
          passwordHash: staffPasswordHash,
          fullName: s.fullName,
          role: Role.STAFF,
          staffProfile: { create: { specialties: s.specialties } },
        },
      })
    )
  );

  const services = [
    { name: "Cắt tóc nam", description: "Cắt gọn gàng theo yêu cầu", price: 100000, durationMinutes: 30 },
    { name: "Cắt tóc nữ", description: "Cắt tạo kiểu theo dáng mặt", price: 150000, durationMinutes: 45 },
    { name: "Nhuộm tóc", description: "Nhuộm màu thời trang", price: 500000, durationMinutes: 90 },
    { name: "Uốn tóc", description: "Uốn tạo kiểu", price: 600000, durationMinutes: 120 },
    { name: "Duỗi tóc", description: "Duỗi thẳng, phục hồi", price: 550000, durationMinutes: 100 },
    { name: "Gội đầu dưỡng sinh", description: "Thư giãn, massage da đầu", price: 80000, durationMinutes: 30 },
    { name: "Lấy ráy tai êm", description: "Làm sạch, thư giãn, êm ái", price: 50000, durationMinutes: 20 },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    }
  }

  const maleColors = [
    { label: "Đen tự nhiên", hex: "#1a1a1a" },
    { label: "Nâu socola", hex: "#4a2c1a" },
    { label: "Nâu khói", hex: "#5c4a3a" },
    { label: "Xám bạc", hex: "#8a8a8a" },
    { label: "Rêu khói", hex: "#4a5a44" },
  ];
  const femaleColors = [
    { label: "Nâu hạt dẻ", hex: "#6b3f2a" },
    { label: "Nâu caramel", hex: "#a06a3a" },
    { label: "Bạch kim", hex: "#d4c4a8" },
    { label: "Hồng pastel", hex: "#e8b4c8" },
    { label: "Đỏ burgundy", hex: "#6b1f2a" },
    { label: "Nâu ánh khói", hex: "#5a4a42" },
    { label: "Vàng ánh kim", hex: "#c9a876" },
  ];

  const maleStyles: { base: string; faceShapes: string[]; description: string; colorCount: number; imageUrl: string }[] = [
    { base: "Undercut", faceShapes: ["OVAL", "SQUARE"], description: "Cắt ngắn hai bên, để dài phần đỉnh", colorCount: 3, imageUrl: "/images/male1.jpg" },
    { base: "Side Part cổ điển", faceShapes: ["ROUND", "OVAL"], description: "Rẽ ngôi lịch lãm", colorCount: 3, imageUrl: "/images/male2.jpg" },
    { base: "Crew Cut", faceShapes: ["ROUND", "SQUARE", "DIAMOND"], description: "Cắt ngắn gọn gàng", colorCount: 3, imageUrl: "/images/male3.jpg" },
    { base: "Buzz Cut", faceShapes: ["OVAL", "DIAMOND", "LONG"], description: "Cắt sát, tôn đường nét", colorCount: 2, imageUrl: "/images/male4.jpg" },
    { base: "Textured Quiff", faceShapes: ["OVAL", "HEART"], description: "Vuốt phồng phần đỉnh", colorCount: 3, imageUrl: "/images/male5.jpg" },
    { base: "Slick Back", faceShapes: ["SQUARE", "DIAMOND"], description: "Vuốt ngược ra sau", colorCount: 2, imageUrl: "/images/male6.jpg" },
  ];
  const femaleStyles: { base: string; faceShapes: string[]; description: string; colorCount: number; imageUrl: string }[] = [
    { base: "Tóc Layer Dài Mái Bay", faceShapes: ["ROUND", "OVAL", "SQUARE", "HEART"], description: "Tỉa layer mềm mại, che khuyết điểm mặt to", colorCount: 4, imageUrl: "/images/asian_layer.jpg" },
    { base: "Tóc Bob Uốn Cụp", faceShapes: ["OVAL", "LONG", "HEART", "DIAMOND"], description: "Ngắn ngang cằm, uốn chữ C trẻ trung", colorCount: 4, imageUrl: "/images/user_upload_1.jpg" },
    { base: "Xoăn Sóng Lơi Hàn Quốc", faceShapes: ["SQUARE", "DIAMOND", "OVAL", "ROUND"], description: "Sóng lơi bồng bềnh, tạo độ dày cho tóc", colorCount: 4, imageUrl: "/images/female1.jpg" },
    { base: "Tóc Lửng Ngang Vai (Lob)", faceShapes: ["ROUND", "HEART", "OVAL"], description: "Trẻ trung, năng động, dễ chăm sóc", colorCount: 4, imageUrl: "/images/female2.jpg" },
    { base: "Tóc Thẳng Dài Tự Nhiên", faceShapes: ["LONG", "OVAL", "HEART"], description: "Suôn mượt, dịu dàng, chuẩn Á Đông", colorCount: 4, imageUrl: "/images/female3.jpg" },
    { base: "Xoăn Hippie Cá Tính", faceShapes: ["DIAMOND", "SQUARE", "OVAL", "LONG"], description: "Xoăn xù mì phá cách, vintage", colorCount: 4, imageUrl: "/images/female4.jpg" },
    { base: "Tóc Mái Thưa Khóa Mặt", faceShapes: ["LONG", "HEART", "SQUARE", "OVAL"], description: "Mái thưa che trán cao, cân đối khuôn mặt", colorCount: 4, imageUrl: "/images/female5.jpg" },
    { base: "Tóc Ngắn Tomboy", faceShapes: ["OVAL", "HEART", "DIAMOND"], description: "Cắt sát gọn gàng, tôn đường nét khuôn mặt", colorCount: 3, imageUrl: "/images/female6.jpg" },
    { base: "Xoăn Lọn To Đuôi", faceShapes: ["ROUND", "SQUARE", "LONG", "OVAL"], description: "Uốn lọn to phần đuôi sang trọng", colorCount: 4, imageUrl: "/images/female7.jpg" },
    { base: "Tóc Layer Ngắn Wolf Cut", faceShapes: ["ROUND", "DIAMOND", "HEART"], description: "Layer tầng cao cực kỳ cá tính", colorCount: 4, imageUrl: "/images/female8.jpg" },
    { base: "Tóc Hime Nhật Bản", faceShapes: ["OVAL", "LONG", "HEART"], description: "Cắt bằng hai bên má ấn tượng", colorCount: 3, imageUrl: "/images/female9.jpg" },
    { base: "Buổi Cao Đuôi Ngựa (Ponytail)", faceShapes: ["ROUND", "OVAL", "SQUARE", "HEART"], description: "Kiểu buộc đuôi ngựa trẻ trung thanh lịch", colorCount: 2, imageUrl: "/images/female10.jpg" }
  ];

  // Xoá toàn bộ kho kiểu tóc cũ để reseed lại với bộ dữ liệu mở rộng (nhiều kiểu + nhiều màu hơn)
  await prisma.hairstyle.deleteMany({});

  const hairstyles = [
    ...maleStyles.flatMap((s) =>
      maleColors.slice(0, s.colorCount).map((c) => ({
        name: `${s.base} - ${c.label}`,
        gender: Gender.MALE,
        faceShapes: s.faceShapes,
        colorTag: c.hex,
        description: s.description,
        imageUrl: s.imageUrl,
      }))
    ),
    ...femaleStyles.flatMap((s) =>
      femaleColors.slice(0, s.colorCount).map((c) => ({
        name: `${s.base} - ${c.label}`,
        gender: Gender.FEMALE,
        faceShapes: s.faceShapes,
        colorTag: c.hex,
        description: s.description,
        imageUrl: s.imageUrl,
      }))
    ),
  ];
  for (const h of hairstyles) {
    const existing = await prisma.hairstyle.findFirst({ where: { name: h.name } });
    if (!existing) {
      await prisma.hairstyle.create({ data: h });
    }
  }

  console.log("Seed complete:", { admin: admin.phone, staff: staffAccounts.map((s) => s.phone) });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
