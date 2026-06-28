# 📜 Nhật Ký Dự Án (Project History)

> File này do Reviewer Agent và Debugger Agent cập nhật sau mỗi đợt Code Review hoặc Xử lý sự cố (Incident), để lưu trữ Quyết định Kiến trúc (ADR) và ngăn ngừa lỗi hồi quy.

## Bài Học Rút Ra (Lessons Learned):
- **11/05/2026**: Di chuyển toàn bộ kiến trúc frontend sang ReactJS. Cấu trúc cũ sử dụng HTML/JS thuần không đủ khả năng mở rộng cho hệ thống Multi-Agent Realtime.
- Đã thiết lập cấu trúc `docs/` phẳng để tối ưu hóa việc nạp dữ liệu RAG.
- **13/05/2026**: Chốt hạ kiến trúc **Enterprise RAG Pipeline (12 Steps)**. Sử dụng UI "Data Flow Visualizer" để thiết kế API Payload (Mock-first) trước khi code Backend thật.
- **13/05/2026 (React Hook Purity)**: Rút kinh nghiệm sâu sắc về React Impurity. Tuyệt đối KHÔNG gọi `Math.random()` trực tiếp trong JSX/Render body vì sẽ gây ra lỗi Hydration và Cascading Renders ở Next.js. Giải pháp: Khởi tạo giá trị ngẫu nhiên bên ngoài Component hoặc gán trong `useEffect`.

## Lỗi Thường Gặp (Gotchas):
- Cẩn thận khi chạy `concurrently` ở thư mục root, cần đảm bảo đường dẫn `cd src/` trỏ đúng vào các module con.
- React ESLint (Rules of Hooks, Exhaustive Deps, Impurity) rất gắt gao trong Next.js (App Router). Phải rà soát kỹ các Warnings.
