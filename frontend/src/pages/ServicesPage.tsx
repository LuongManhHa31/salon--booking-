import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { Service } from "../types";

function formatPrice(price: string) {
  return Number(price).toLocaleString("vi-VN") + "đ";
}

function getServiceImage(name: string) {
  const lower = name.toLowerCase();
  
  if (lower.includes("nữ") || lower.includes("nu") || lower.includes("cắt tạo kiểu")) {
    return "https://images.pexels.com/photos/3993444/pexels-photo-3993444.jpeg?auto=compress&cs=tinysrgb&w=600";
  }
  if (lower.includes("nhuộm") || lower.includes("màu")) 
    return "/images/nhuom-toc.jpg";
  if (lower.includes("uốn")) 
    return "https://images.pexels.com/photos/973401/pexels-photo-973401.jpeg?auto=compress&cs=tinysrgb&w=600";
  if (lower.includes("duỗi")) 
    return "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600";
  if (lower.includes("gội") || lower.includes("massage")) 
    return "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600";
    
  // Mặc định (Cắt tóc nam)
  return "https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?w=600";
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ services: Service[] }>("/services")
      .then((res) => setServices(res.services))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6 text-blue-900">Danh sách dịch vụ</h1>
      {loading && <p className="text-gray-500">Đang tải...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s) => (
          <div key={s.id} className="relative p-[2px] rounded-xl overflow-hidden group hover:shadow-lg transition-shadow cursor-scissors flex flex-col">
            {/* Animated running border element */}
            <div className="absolute inset-[-100%] bg-conic-border animate-spin-border opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <Link to="/booking" state={{ serviceId: s.id }} className="relative bg-white border border-white rounded-[10px] overflow-hidden flex flex-col flex-1 z-10">
              <div className="h-48 overflow-hidden bg-gray-100">
                <img src={getServiceImage(s.name)} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</h2>
                {s.description && <p className="text-sm text-gray-500 mt-1 flex-1">{s.description}</p>}
                <div className="flex justify-between items-center text-sm mt-4 pt-3 border-t border-gray-100">
                  <span className="font-bold text-blue-600">{formatPrice(s.price)}</span>
                  <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded text-xs">{s.durationMinutes} phút</span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      {!loading && services.length === 0 && <p className="text-gray-500">Chưa có dịch vụ nào.</p>}
      <div className="mt-8">
        <Link to="/booking" className="bg-brand-600 text-white px-5 py-2.5 rounded-md hover:bg-brand-700">
          Đặt lịch ngay
        </Link>
      </div>
    </div>
  );
}
