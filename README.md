# Hệ thống quản lý đặt lịch Salon tóc có tích hợp AI

**Link truy cập cố định:** https://laptop-m23gkq84.tailb7499f.ts.net/hairstyle-ai
(qua Tailscale Funnel, không đổi giữa các lần khởi động lại - chỉ cần bấm `start-all.bat` để bật
backend/frontend/funnel trước khi vào link)

Ứng dụng full-stack triển khai toàn bộ 25 use case trong tài liệu đặc tả yêu cầu (SRS) của nhóm,
bao gồm đặt lịch, quản trị salon, và hai tính năng AI (gợi ý kiểu tóc từ ảnh khuôn mặt, chatbot tư
vấn) dùng Claude API.

## Use case đã triển khai

| UC | Mô tả | Ghi chú |
|---|---|---|
| UC001 | Đặt lịch nhanh không cần tài khoản | Xác thực bằng OTP (mô phỏng gửi SMS, in mã ra log/response ở môi trường dev) |
| UC002 | Đăng ký tài khoản | |
| UC003 | Đăng nhập / đăng xuất | |
| UC004 | Xem danh sách/chi tiết dịch vụ | |
| UC005 | Đặt lịch hẹn dịch vụ | Tự động khoá trùng khung giờ theo nhân viên |
| UC006 | Chọn nhân viên thực hiện dịch vụ | |
| UC007 | Xem lịch sử đặt lịch | |
| UC008 | Huỷ / đổi lịch hẹn | Chặn nếu còn dưới 2 giờ trước giờ hẹn |
| UC009 | Nhận thông báo nhắc lịch hẹn | Job kiểm tra định kỳ mỗi 5 phút; thông báo trong ứng dụng luôn hoạt động, email cần cấu hình SMTP |
| UC010 | Đánh giá dịch vụ | |
| UC011 | Thanh toán trực tuyến / tại salon | Cổng thanh toán trực tuyến được **mô phỏng** (chưa nối VNPay/Momo thật) |
| UC012 | Cập nhật thông tin cá nhân | Cũng dùng để hoàn thiện tài khoản (đặt mật khẩu) sau khi đặt lịch nhanh - CN-02 |
| UC013 | Đăng nhập nhân viên | |
| UC014 | Xem lịch hẹn được phân công | |
| UC015 | Cập nhật trạng thái lịch hẹn | |
| UC016 | Gợi ý kiểu tóc bằng AI | Ưu tiên Gemini (nếu có `GEMINI_API_KEY`) hoặc Claude vision phân tích ảnh, không dùng model nhận diện khuôn mặt cài local |
| UC017 | Xem thông tin khách hàng (nhân viên) | Nhân viên chỉ xem được khách đã từng phục vụ |
| UC018 | Ghi nhận kết quả thực hiện dịch vụ | |
| UC019 | Chatbot tư vấn | Dùng Gemini (nếu có `GEMINI_API_KEY`) hoặc Claude, có tool tra cứu khung giờ trống thật từ dữ liệu lịch hẹn, và dùng RAG (`backend/src/rag`) để trả lời dựa trên tài liệu chính sách/FAQ nội bộ của salon |
| UC020 | Quản lý dịch vụ | |
| UC021 | Quản lý nhân viên | |
| UC022 | Quản lý khách hàng | Tìm kiếm, khoá/mở tài khoản |
| UC023 | Quản lý và phân công lịch hẹn | |
| UC024 | Quản lý thanh toán, hoá đơn | |
| UC025 | Thống kê, báo cáo | Doanh thu theo ngày, hiệu suất nhân viên |

## Kiến trúc

- **backend/**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL, xác thực JWT. Cả gợi ý kiểu
  tóc AI (UC016) và chatbot (UC019) đều tự chọn Claude (Anthropic SDK) hoặc Google Gemini
  (`@google/genai`) theo key nào được cấu hình, ưu tiên Gemini nếu có.
- **frontend/**: React + Vite + TypeScript, TailwindCSS, React Router.

## Yêu cầu cài đặt trước

- Node.js 18+ và npm
- PostgreSQL 14+ (chạy local hoặc dùng dịch vụ cloud)
- API key của Anthropic (Claude) - dùng làm phương án dự phòng khi chưa cấu hình Gemini
- API key của Google Gemini (khuyến khích) - nếu có, cả gợi ý kiểu tóc AI (UC016) và chatbot
  (UC019) sẽ ưu tiên dùng Gemini thay vì Claude. Lấy tại https://aistudio.google.com/apikey. Có thể
  điền nhiều key cách nhau bằng dấu phẩy để tự động xoay key khi một key hết quota free-tier (xem
  `.env.example`)

## Cài đặt backend

```bash
cd backend
npm install
cp .env.example .env   # chỉnh DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, GEMINI_API_KEY cho phù hợp
npx prisma migrate dev --name init
npm run prisma:seed    # tạo tài khoản admin/nhân viên mẫu, dịch vụ mẫu, kho kiểu tóc mẫu
npm run dev             # chạy tại http://localhost:4000
```

Tài khoản mẫu sau khi seed:

- Quản trị viên: SĐT `0900000000`, mật khẩu `Admin@123`
- Nhân viên: SĐT `0900000001` hoặc `0900000002`, mật khẩu `Staff@123`

## Cài đặt frontend

```bash
cd frontend
npm install
npm run dev   # chạy tại http://localhost:5173, tự proxy /api sang backend
```

Mở `http://localhost:5173` để sử dụng ứng dụng.

## Giới hạn đã biết / việc cần làm khi triển khai thật

- **OTP**: chưa nối nhà cung cấp SMS thật. Ở môi trường không phải production, endpoint
  `/api/auth/otp/request` trả kèm trường `devCode` để tiện test. Khi triển khai thật cần thêm
  Twilio/Zalo SMS... và bỏ trường `devCode`.
- **Thanh toán trực tuyến**: `/api/payments/:appointmentId` với `method: "ONLINE"` mô phỏng giao
  dịch thành công ngay lập tức để phục vụ demo luồng nghiệp vụ. Khi triển khai thật cần tích hợp
  cổng thanh toán (VNPay/Momo) với luồng redirect/callback và xác thực chữ ký giao dịch.
  Sau khi hoàn thiện cổng thanh toán thật, hãy đối chiếu lại phần "Bảo mật & quyền riêng tư" trong
  đặc tả yêu cầu phi chức năng để đảm bảo dữ liệu thẻ/giao dịch được xử lý đúng chuẩn.
- **Email nhắc lịch**: nếu không cấu hình `SMTP_HOST` trong `.env`, hệ thống chỉ tạo thông báo
  trong ứng dụng và ghi log console thay vì gửi email thật.
- **Gợi ý kiểu tóc AI**: dùng Claude API (có khả năng vision) để ước lượng dáng mặt/giới tính thay
  vì một model nhận diện khuôn mặt chuyên biệt cài local - đơn giản hoá triển khai nhưng độ chính
  xác phụ thuộc vào chất lượng mô tả của mô hình ngôn ngữ. Ảnh chỉ xử lý tạm thời trong bộ nhớ, không
  lưu trữ trên server.
- **Chatbot đa nhà cung cấp AI**: `backend/src/routes/chat.routes.ts` tự chọn Gemini nếu
  `GEMINI_API_KEY` được cấu hình, ngược lại dùng Claude qua `ANTHROPIC_API_KEY`. Cả hai nhánh dùng
  chung một tool tra khung giờ trống thật (`get_available_slots`), chỉ khác cách gọi API của từng
  nhà cung cấp.
- **RAG cho chatbot** (`backend/src/rag`): trước khi trả lời, hệ thống chia nhỏ (chunking) các tài
  liệu chính sách/FAQ trong `knowledgeBase.ts` thành đoạn ngắn, vector hoá bằng
  `gemini-embedding-001` (nếu có `GEMINI_API_KEY`) và lưu trong bộ nhớ (không dùng vector database
  chuyên dụng vì quy mô nhỏ), sau đó truy xuất Top-K đoạn liên quan nhất tới câu hỏi gần nhất của
  khách hàng để đưa vào system prompt. Nếu không có `GEMINI_API_KEY`, hệ thống tự chuyển sang tìm
  kiếm theo từ khóa (`retriever.ts`) thay vì tìm kiếm ngữ nghĩa. Muốn bổ sung tri thức mới, chỉ cần
  thêm mục vào mảng `knowledgeBase` trong `backend/src/rag/knowledgeBase.ts`.
- **Giờ hoạt động salon**: mặc định 09:00–19:00, bước khung giờ 30 phút
  (`backend/src/utils/schedule.ts`). Chỉnh theo cấu hình thực tế của salon.
