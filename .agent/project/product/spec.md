# 📜 Đặc Tả Dự Án Hiện Tại (Project Specification)

> File này được cập nhật ĐỘC QUYỀN bởi Planner Agent. Mọi thay đổi về tính năng/logic đều phải được phê duyệt và phản ánh vào đây trước khi Frontend/Backend Agent tiến hành code.

## 1. Mục Tiêu Dự Án (Hiện Tại)
- Xây dựng hệ sinh thái AI Learning & RAG Pipeline cấp độ doanh nghiệp (Enterprise Grade).
- Phát triển "Model Lab" - Nơi chứa các Visualizer trực quan hóa thuật toán AI (Linear Regression, Decision Trees, Neural Networks, và Data Flow).
- Giao diện Vibe Mode/Glassmorphism với Framer Motion siêu mượt.

## 2. Luồng Xử Lý Chính: Enterprise RAG Pipeline (12 Steps)
Kiến trúc trích xuất thông tin (RAG) chuẩn công nghiệp đã được chốt và mô phỏng trên Frontend:
1. **User App:** Tiếp nhận Prompt từ người dùng.
2. **Input Guardrail:** Kiểm duyệt PII & Độc tính.
3. **Semantic Cache:** Kiểm tra Redis Cache để tối ưu thời gian phản hồi.
4. **Query Rewriter:** Viết lại câu hỏi để tối ưu hóa việc tìm kiếm (Query Expansion).
5. **Embedding Model:** Chuyển đổi Text thành Dense Vector.
6. **Vector DB:** Tìm kiếm ANN (Approximate Nearest Neighbors) trên Chroma/Neo4j lấy Top K IDs.
7. **Doc Store:** Lấy Raw Text Payload từ NoSQL.
8. **Re-ranker:** Dùng Cross-Encoder chấm điểm lại và lọc ra Top N Chunks chất lượng nhất.
9. **Prompt Compiler:** Lắp ráp System Prompt + Context + Query.
10. **Core LLM Engine:** Sinh văn bản dựa trên LLM lớn.
11. **Output Guardrail:** Kiểm tra Hallucination & Fact-Checking.
12. **Final Response:** Streaming kết quả về UI.

## 3. Ràng Buộc Kỹ Thuật
- **Frontend:** Next.js (React), Tailwind CSS, Framer Motion. 
- **Quy tắc UI:** Không sử dụng thư viện UI Component có sẵn (như AntDesign, MUI). Tự code CSS thuần, ưu tiên animation mượt mà (Spring physics), hiệu ứng neon glow và trải nghiệm "Sống động" (Real-time interactivity).
- **Trạng thái (State):** Không gọi các hàm impure (như `Math.random()`) trực tiếp trong Render body. Phải bọc trong `useEffect` hoặc `useMemo` để đảm bảo Purity cho React.
