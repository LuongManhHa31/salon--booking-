import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  function handleQuickBook(e: FormEvent) {
    e.preventDefault();
    navigate("/quick-booking", { state: { phone } });
  }

  return (
    <div className="bg-[#f0f2f5] min-h-screen font-sans pb-16">
      {/* Header Menu Giả Lập (Chỉ hiển thị trên HomePage để giống 30Shine) */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-black text-[#1e3a8a] tracking-tighter">
              SALON<span className="text-[#3b82f6]">AI</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-gray-700">
              <Link to="/" className="text-blue-600 border-b-2 border-blue-600 py-5">Trang chủ</Link>
              <Link to="/about" className="hover:text-blue-600 py-5">Về Salon</Link>
              <Link to="/services" className="hover:text-blue-600 py-5">Dịch vụ</Link>
              <Link to="/hairstyle-ai" className="hover:text-blue-600 py-5 text-blue-600 font-bold flex items-center gap-1">
                ✨ AI Gợi Ý Tóc
              </Link>
              <a href="#" className="hover:text-blue-600 py-5">Nhượng quyền</a>
              <a href="#" className="hover:text-blue-600 py-5">Góc tư vấn</a>
            </nav>
          </div>
          <div>
            <Link to="/login" className="border border-blue-600 text-blue-600 font-bold px-4 py-1.5 rounded text-sm hover:bg-blue-50">
              Đăng nhập
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-white px-4 pt-4 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="relative p-[3px] rounded-2xl overflow-hidden shadow-lg group">
            {/* Animated running border element */}
            <div className="absolute inset-[-100%] bg-conic-border animate-spin-border opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="relative w-full aspect-[21/9] md:aspect-[25/9] rounded-[14px] overflow-hidden bg-gray-100 z-10">
              <img 
                src="/images/asian_layer.jpg" 
                alt="Banner" 
                className="w-full h-full object-cover object-top"
              />
              {/* Chữ giả lập trên banner */}
              <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white">
                <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-wide text-white drop-shadow-lg uppercase">
                  SHINE BRIGHT
                </h1>
                <p className="text-lg md:text-xl font-bold bg-blue-600/80 px-4 py-1 rounded-full backdrop-blur-sm shadow-md">
                  BỘ SƯU TẬP TÓC NAM MỚI NHẤT
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Bar & Rating (Overlapping Banner) */}
      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-10 flex flex-col md:flex-row gap-4">
        
        {/* Đặt lịch */}
        <div className="flex-1 bg-blue-600 text-white rounded-xl shadow-xl p-5 flex flex-col md:flex-row items-center gap-4 border-2 border-white/20">
          <div className="flex-1">
            <h3 className="text-lg font-bold uppercase tracking-tight mb-1">
              Đặt lịch giữ chỗ chỉ 30 giây
            </h3>
            <p className="text-sm text-blue-200">Cắt xong trả tiền, hủy lịch không sao</p>
          </div>
          <form onSubmit={handleQuickBook} className="w-full md:w-auto flex bg-white p-1 rounded-md">
            <input 
              type="tel" 
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập SĐT để đặt lịch" 
              className="flex-1 outline-none text-gray-900 px-3 py-2 w-full md:w-48 rounded-l-md text-sm font-medium"
            />
            <button className="bg-white text-blue-600 font-black uppercase text-sm px-4 py-2 rounded-md hover:bg-blue-50 transition-colors shadow-sm border border-gray-100">
              Đặt lịch ngay
            </button>
          </form>
        </div>

        {/* Đánh giá */}
        <div className="w-full md:w-[350px] bg-white rounded-xl shadow-lg p-5 flex flex-col justify-center border border-gray-100">
          <p className="text-sm font-bold text-gray-800 uppercase mb-1">Mời bạn đánh giá dịch vụ</p>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Phản hồi của bạn giúp chúng tôi cải thiện chất lượng dịch vụ tốt hơn
          </p>
          <div className="flex text-blue-500 text-xl">
            ★★★★★
          </div>
        </div>
      </div>

      {/* DỊCH VỤ TÓC */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-[#3b82f6]"></div>
          <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">Dịch Vụ Tóc</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Cắt tóc", price: "100.000", img: "/images/female1.jpg" },
            { name: "Uốn định hình", price: "350.000", img: "/images/female2.jpg" },
            { name: "Thay đổi màu tóc", price: "250.000", img: "/images/nhuom-toc.jpg" }
          ].map((s, i) => (
            <div key={i} className="relative p-[2px] rounded-xl overflow-hidden group hover:shadow-lg transition-shadow cursor-scissors">
              {/* Animated running border element */}
              <div className="absolute inset-[-100%] bg-conic-border animate-spin-border opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <Link to="/services" className="relative bg-white rounded-[10px] overflow-hidden flex flex-col h-full z-10">
                <div className="h-48 overflow-hidden bg-gray-200">
                  <img src={s.img} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4 flex items-end justify-between flex-1">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                    <p className="text-xs text-gray-500">Giá từ {s.price}VNĐ</p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 group-hover:underline">
                    Tìm hiểu thêm &gt;
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* THƯ GIÃN VÀ CHĂM SÓC DA */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-[#3b82f6]"></div>
          <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">Thư Giãn Và Chăm Sóc Da</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Gội dưỡng sinh thư giãn", price: "80.000", img: "/images/female3.jpg" },
            { name: "Lấy ráy tai êm", price: "50.000", img: "/images/lay-ray-tai.png" },
          ].map((s, i) => (
            <Link to="/services" key={i} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group border border-gray-100 block">
              <div className="h-48 overflow-hidden bg-gray-200">
                <img src={s.img} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4 flex items-end justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">{s.name}</h3>
                  <p className="text-xs text-gray-500">Giá từ {s.price}VNĐ</p>
                </div>
                <span className="text-xs font-semibold text-blue-600 hover:underline">
                  Tìm hiểu thêm &gt;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SHINE COLLECTION */}
      <section className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-[#3b82f6]"></div>
          <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">
            SHINE COLLECTION - 'VIBE' NÀO CŨNG TOẢ SÁNG
          </h2>
        </div>
        
        {/* Banner Collection */}
        <div className="relative p-[3px] rounded-2xl overflow-hidden shadow-lg group mb-6">
          {/* Animated running border element */}
          <div className="absolute inset-[-100%] bg-conic-border animate-spin-border opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          <div className="relative w-full aspect-[21/6] md:aspect-[25/6] rounded-[14px] overflow-hidden bg-gray-100 z-10">
            <img 
              src="/images/user_upload_1.jpg" 
              alt="Collection Banner" 
              className="w-full h-full object-cover object-top opacity-90"
            />
            <div className="absolute inset-0 bg-blue-900/40 flex flex-col items-center justify-center text-white">
              <h1 className="text-3xl md:text-5xl font-black mb-2 text-white drop-shadow-md uppercase tracking-wider">
                SHINE <span className="text-blue-300">BRIGHT</span>
              </h1>
            </div>
          </div>
        </div>

        {/* 3 Sub Collection Images */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "ANH TRAI SAY HAIR", subtitle: "BỘ SƯU TẬP", img: "/images/male1.jpg" },
            { title: "READY FOR NEW GAME", subtitle: "BTS K-PERM", img: "/images/male2.jpg" },
            { title: `"BAD BOY"`, subtitle: "CÁ TÍNH", img: "/images/male3.jpg" }
          ].map((item, i) => (
            <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden relative group cursor-pointer shadow-sm">
              <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                <p className="text-xs font-semibold uppercase text-gray-300">{item.subtitle}</p>
                <h3 className="text-xl font-black uppercase tracking-wide">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SAO TOẢ SÁNG */}
      <section className="max-w-6xl mx-auto px-4 mt-12 mb-12">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 bg-[#3b82f6]"></div>
          <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">Sao Tỏa Sáng</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6 ml-3">Đồng hành cùng Sao - Sẵn sàng tỏa sáng</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            "/images/male4.jpg",
            "/images/female7.jpg",
            "/images/male5.jpg",
            "/images/female8.jpg"
          ].map((imgSrc, i) => (
            <div key={i} className="aspect-square bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
               <img src={imgSrc} alt="Star" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300" />
            </div>
          ))}
        </div>
      </section>
      {/* ĐỘI NGŨ CHUYÊN GIA */}
      <section className="bg-white py-12 mt-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col items-center mb-8 text-center">
            <h2 className="text-2xl font-black text-blue-900 uppercase tracking-widest mb-2">Đội ngũ chuyên gia</h2>
            <p className="text-gray-500 max-w-xl">Những bàn tay vàng tạo nên phong cách hoàn hảo cho bạn</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Nguyễn Quang Minh", role: "Master Stylist", exp: "5 năm kinh nghiệm", img: "/images/stylist_1.jpg" },
              { name: "Trần Thu Hà", role: "Color Specialist", exp: "7 năm kinh nghiệm", img: "/images/stylist_2.jpg" },
              { name: "Thân Tuấn Vũ", role: "Creative Director", exp: "10 năm kinh nghiệm", img: "/images/stylist_3.jpg" },
              { name: "Dương Văn Tuấn", role: "Senior Stylist", exp: "4 năm kinh nghiệm", img: "/images/stylist_4.jpg" }
            ].map((staff, i) => (
              <div key={i} className="flex flex-col items-center group cursor-pointer">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden mb-4 border-4 border-gray-50 shadow-md group-hover:border-blue-100 transition-all duration-300 group-hover:-translate-y-2">
                  <img src={staff.img} alt={staff.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{staff.name}</h3>
                <p className="text-sm font-semibold text-blue-600">{staff.role}</p>
                <p className="text-xs text-gray-500 mt-1">{staff.exp}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="text-2xl font-black text-white tracking-tighter block mb-4">
              SALON<span className="text-blue-500">AI</span>
            </Link>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Tiên phong ứng dụng công nghệ Trí tuệ Nhân tạo trong lĩnh vực làm đẹp, mang đến trải nghiệm đặt lịch và tư vấn cá nhân hóa tuyệt vời nhất.
            </p>
            <div className="flex gap-4">
              <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors text-white text-xs">FB</span>
              <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors text-white text-xs">IG</span>
              <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors text-white text-xs">TT</span>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Dịch vụ</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Cắt tóc nam / nữ</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Uốn / Duỗi / Nhuộm</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Gội đầu dưỡng sinh</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Phục hồi tóc hư tổn</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Hỗ trợ khách hàng</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-blue-400 transition-colors">Tìm salon gần nhất</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Chính sách bảo hành</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Câu hỏi thường gặp</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Liên hệ góp ý</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Liên hệ</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-blue-500">📍</span>
                <span>20 Hoàng Văn Thụ, Thái Nguyên, Việt Nam</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-blue-500">📞</span>
                <span className="font-bold text-white">0345.607.361</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-blue-500">✉️</span>
                <span>support@salonai.vn</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 mt-12 pt-8 border-t border-gray-800 text-sm text-gray-500 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 SalonAI Booking. Bản quyền thuộc về Luong Manh Ha.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
            <a href="#" className="hover:text-white transition-colors">Bảo mật</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
