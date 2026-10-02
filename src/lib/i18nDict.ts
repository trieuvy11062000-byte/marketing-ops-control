import type { Lang } from "./i18n";

/** Shared dictionary of UI chrome terms reused across many modules (status
 *  labels, column headers, button text, empty states). Falls back to the key
 *  itself if no Vietnamese entry exists, so adding entries incrementally never
 *  breaks a page. Business-standard terms (A&P, SKU, Golden Week, Demo, POSM,
 *  TVC...) are intentionally left untranslated. Use `td(lang, key)` for these;
 *  for one-off page-specific strings use `ts()`/`tt()` from `i18n.tsx` directly. */
const DICT: Record<string, string> = {
  // Common actions / nav
  "View All": "Xem tất cả",
  "Open": "Mở",
  "Back": "Quay lại",
  "Search": "Tìm kiếm",
  "Filter": "Lọc",
  "All": "Tất cả",
  "Save": "Lưu",
  "Edit": "Sửa",
  "Cancel": "Hủy",
  "Close": "Đóng",
  "Export": "Xuất",
  "Upload": "Tải lên",
  "Download": "Tải xuống",

  // Status
  "Status": "Trạng thái",
  "Live": "Đang chạy",
  "Ending Soon": "Sắp kết thúc",
  "Upcoming": "Sắp tới",
  "Completed": "Hoàn thành",
  "Planned": "Dự kiến",
  "In Progress": "Đang thực hiện",
  "Pending": "Đang chờ",
  "Done": "Xong",
  "Cancelled": "Đã hủy",
  "Active": "Đang hoạt động",
  "Inactive": "Ngừng hoạt động",
  "Overdue": "Quá hạn",
  "At Risk": "Có rủi ro",
  "Blocked": "Bị chặn",
  "Needs Mapping": "Cần ánh xạ",
  "Needs Verification": "Cần xác minh",
  "Current": "Hiện hành",
  "Historical": "Lịch sử",

  // Common fields
  "Brand": "Thương hiệu",
  "Brands": "Thương hiệu",
  "Campaign": "Chiến dịch",
  "Campaigns": "Chiến dịch",
  "Promotion": "Khuyến mãi",
  "Promotions": "Khuyến mãi",
  "Deadline": "Hạn chót",
  "Owner": "Người phụ trách",
  "PIC": "Người phụ trách (PIC)",
  "Store": "Cửa hàng",
  "Stores": "Cửa hàng",
  "Week": "Tuần",
  "Month": "Tháng",
  "Date": "Ngày",
  "Start": "Bắt đầu",
  "End": "Kết thúc",
  "Period": "Thời gian",
  "Notes": "Ghi chú",
  "Source": "Nguồn",
  "Description": "Mô tả",
  "Products": "Sản phẩm",
  "Product": "Sản phẩm",
  "Channel": "Kênh",
  "Evidence": "Bằng chứng",
  "Report": "Báo cáo",
  "Reports": "Báo cáo",
  "Summary": "Tóm tắt",
  "Total": "Tổng",
  "Detail": "Chi tiết",
  "Details": "Chi tiết",

  // Empty states
  "No data yet": "Chưa có dữ liệu",
  "Nothing here — all clear": "Không có gì — mọi thứ ổn",

  // Section titles
  "This Week": "Tuần này",
  "Next 2 Weeks": "2 tuần tới",
  "Dashboard": "Bảng điều khiển",
};

export function td(lang: Lang, key: string): string {
  if (lang === "en") return key;
  return DICT[key] ?? key;
}
