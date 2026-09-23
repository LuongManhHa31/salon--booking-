export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
}

// Tri thức nội bộ của salon dùng cho RAG (UC019 - chatbot tư vấn). Nội dung tổng hợp từ
// đặc tả yêu cầu (SRS) của dự án. Trong triển khai thật, các tài liệu này nên do quản trị
// viên salon soạn/cập nhật thay vì hard-code.
export const knowledgeBase: KnowledgeDoc[] = [
  {
    id: "policy-cancel",
    title: "Chính sách hủy / đổi lịch hẹn",
    content:
      "Khách hàng có thể hủy hoặc đổi lịch hẹn miễn phí nếu thực hiện trước giờ hẹn tối thiểu 2 giờ. " +
      "Nếu yêu cầu hủy/đổi trong vòng 2 giờ trước giờ hẹn, hệ thống sẽ từ chối tự động và khách hàng cần " +
      "liên hệ trực tiếp salon để được hỗ trợ. Khi đổi lịch, khách hàng chọn ngày giờ mới còn trống; " +
      "nếu khung giờ mới đã kín, hệ thống sẽ gợi ý khung giờ trống gần nhất.",
  },
  {
    id: "policy-quick-booking",
    title: "Đặt lịch nhanh không cần tài khoản",
    content:
      "Khách hàng chưa có tài khoản vẫn có thể đặt lịch nhanh bằng cách nhập số điện thoại và xác thực " +
      "qua mã OTP gửi về điện thoại, không cần đăng ký tài khoản đầy đủ ngay từ đầu. Sau khi đặt lịch " +
      "thành công, hệ thống tự tạo hồ sơ khách hàng để lưu lịch sử; khách hàng có thể quay lại bổ sung " +
      "thông tin và đặt mật khẩu sau để dùng đầy đủ tính năng tài khoản.",
  },
  {
    id: "policy-payment",
    title: "Hình thức thanh toán",
    content:
      "Salon hỗ trợ hai hình thức thanh toán: thanh toán trực tuyến qua cổng thanh toán (ví điện tử, " +
      "chuyển khoản, thẻ) ngay khi đặt lịch, hoặc thanh toán trực tiếp tại salon sau khi sử dụng dịch vụ. " +
      "Khách hàng có thể tự chọn hình thức phù hợp khi đặt lịch hoặc khi thanh toán hóa đơn.",
  },
  {
    id: "policy-ai-photo-privacy",
    title: "Bảo mật ảnh khuôn mặt dùng cho gợi ý kiểu tóc AI",
    content:
      "Khi khách hàng dùng tính năng gợi ý kiểu tóc bằng AI, ảnh khuôn mặt tải lên chỉ được xử lý tạm " +
      "thời trong bộ nhớ để phân tích dáng mặt và đưa ra gợi ý, sau đó không lưu trữ vĩnh viễn trên máy " +
      "chủ, trừ khi khách hàng chủ động đồng ý lưu lại để dùng cho lần sau. Salon tuân thủ nguyên tắc bảo " +
      "mật dữ liệu cá nhân khi xử lý các thông tin này.",
  },
  {
    id: "policy-hours",
    title: "Giờ hoạt động của salon",
    content:
      "Salon mở cửa phục vụ tất cả các ngày trong tuần, từ 9 giờ sáng đến 19 giờ tối. Khách hàng chỉ có " +
      "thể đặt lịch trong khung giờ hoạt động này; ngoài khung giờ trên hệ thống sẽ không hiển thị slot " +
      "trống để đặt.",
  },
  {
    id: "policy-chatbot-handoff",
    title: "Phạm vi hỗ trợ của chatbot tư vấn",
    content:
      "Chatbot hoạt động 24/7 để tư vấn dịch vụ, gợi ý khung giờ phù hợp và trả lời các câu hỏi thường " +
      "gặp về salon. Với các yêu cầu phức tạp, nhạy cảm, khiếu nại, hoặc khi khách hàng chủ động muốn " +
      "gặp người thật, chatbot sẽ chuyển tiếp (handoff) cho nhân viên salon xử lý trực tiếp thay vì tự " +
      "trả lời.",
  },
  {
    id: "policy-multi-service",
    title: "Đặt nhiều dịch vụ và chọn nhân viên",
    content:
      "Khách hàng có thể chọn nhiều dịch vụ trong cùng một lượt đặt lịch (ví dụ cắt và nhuộm cùng lúc), " +
      "hệ thống sẽ tự động cộng dồn tổng thời lượng thực hiện. Khách hàng có thể chỉ định nhân viên mong " +
      "muốn thực hiện dịch vụ, hoặc để hệ thống tự gợi ý nhân viên còn trống lịch phù hợp với khung giờ " +
      "đã chọn.",
  },
  {
    id: "policy-review",
    title: "Đánh giá dịch vụ",
    content:
      "Sau khi một lịch hẹn đã ở trạng thái hoàn tất, khách hàng có thể đánh giá chất lượng dịch vụ bằng " +
      "số sao và để lại nhận xét. Mỗi lịch hẹn chỉ được đánh giá một lần; hệ thống không cho phép đánh " +
      "giá lại hoặc đánh giá khi lịch hẹn chưa hoàn tất.",
  },
];
