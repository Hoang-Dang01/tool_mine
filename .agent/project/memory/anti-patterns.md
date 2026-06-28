# 🚫 Anti-Patterns (Blacklist)

> Cập nhật bởi Reviewer Agent. File này chứa các thói quen code độc hại đã từng gây hậu quả nghiêm trọng trong dự án này và tuyệt đối bị cấm tái phạm.

## 1. Frontend React
- **[CẤM]** Gọi hàm tạo số ngẫu nhiên (e.g., `Math.random()`) trực tiếp trong JSX/Render body. Dẫn tới lỗi Hydration mismatch.
- **[CẤM]** Sử dụng `useEffect` chỉ để đồng bộ hóa state (Cascading renders).

## 2. Backend & Database
- **[CẤM]** Nối chuỗi SQL thô (Raw string concatenation) để tránh SQL Injection.
- **[CẤM]** Commit Transaction khi chưa xử lý toàn bộ logic nghiệp vụ bên trong khối try-catch.
