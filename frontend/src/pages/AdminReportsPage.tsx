import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { ReportSummary } from "../types";

const statusLabel: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
  NO_SHOW: "Không đến",
};

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export function AdminReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ReportSummary>("/reports/summary")
      .then(setSummary)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-10 text-gray-500">Đang tải...</p>;
  if (!summary) return <p className="text-center py-10 text-gray-500">Không tải được báo cáo.</p>;

  const maxDaily = Math.max(1, ...summary.dailyRevenue.map((d) => d.revenue));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Thống kê, báo cáo</h1>
      <p className="text-gray-500 text-sm mb-6">
        Từ {new Date(summary.range.from).toLocaleDateString("vi-VN")} đến {new Date(summary.range.to).toLocaleDateString("vi-VN")}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Tổng lịch hẹn</p>
          <p className="text-xl font-semibold">{summary.totalAppointments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">Doanh thu</p>
          <p className="text-xl font-semibold">{formatPrice(summary.totalRevenue)}</p>
        </div>
        {Object.entries(summary.byStatus).map(([status, count]) => (
          <div key={status} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500">{statusLabel[status] ?? status}</p>
            <p className="text-xl font-semibold">{count}</p>
          </div>
        ))}
      </div>

      <h2 className="font-medium mb-3">Doanh thu theo ngày</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8">
        {summary.dailyRevenue.length === 0 && <p className="text-gray-500 text-sm">Chưa có dữ liệu doanh thu.</p>}
        <div className="space-y-1">
          {summary.dailyRevenue.map((d) => (
            <div key={d.date} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-gray-500">{d.date}</span>
              <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                <div className="bg-brand-500 h-full" style={{ width: `${(d.revenue / maxDaily) * 100}%` }} />
              </div>
              <span className="w-24 text-right text-gray-600">{formatPrice(d.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="font-medium mb-3">Hiệu suất nhân viên</h2>
      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {summary.staffPerformance.map((s) => (
          <div key={s.staffId} className="p-3 flex justify-between text-sm">
            <span>{s.fullName}</span>
            <span className="text-gray-500">
              {s.completedCount} lượt hoàn tất - {formatPrice(s.revenue)}
            </span>
          </div>
        ))}
        {summary.staffPerformance.length === 0 && <p className="p-3 text-gray-500 text-sm">Chưa có dữ liệu.</p>}
      </div>
    </div>
  );
}
