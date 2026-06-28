# 🗄️ Lược Đồ Cơ Sở Dữ Liệu (DB Schema)

> File này được thiết kế và cập nhật ĐỘC QUYỀN bởi Planner Agent. Backend Agent dựa vào đây để cấu trúc các truy vấn (Queries).

## Các Bảng (Tables) Hiện Có:
*(Hiện tại hệ thống sử dụng PostgreSQL với pgvector).*

- **Bảng `users`**: Quản lý tài khoản (id, username, password_hash).
- **Bảng `knowledge_base`**: Chứa dữ liệu RAG đã được nhúng vector (id, content, embedding_vector).

*(Cần cập nhật thêm khi dự án phình to).*
