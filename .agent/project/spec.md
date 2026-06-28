# BÀI TOÁN & Ý TƯỞNG SƠ BỘ (PROJECT SPECIFICATION)
**Dự án:** Nâng cấp Medstand Chatbot lên Kiến trúc AI Agentic V6 (Enterprise-Grade)

## 1. TỔNG QUAN Ý TƯỞNG (THE IDEA)
Mục tiêu của dự án là đập bỏ cấu trúc Chatbot rẽ nhánh (If/Else, Regex) lỗi thời để chuyển sang cấu trúc **Autonomous Agent (AI tự trị)**. 
- Thay vì lập trình sẵn các kịch bản, hệ thống trao cho AI "Bộ não" (LLM) và các "Công cụ" (Tools: RAG, SQL). AI sẽ tự đọc câu hỏi, tự phân tích và quyết định xem nên dùng công cụ nào để lấy dữ liệu.
- **Tiêu chuẩn Enterprise:** Giao diện tối giản, nghiêm túc (Zero-Emoji), phản hồi tức thì (Không gõ chữ từ từ), và bảo mật dữ liệu tuyệt đối (AI chỉ trả về Mã Ngăn Kéo - Cache ID, hệ thống tự động bốc dữ liệu thật ghép vào sau).

---

## 2. NHỮNG GÌ ĐÃ HOÀN THÀNH (ACCOMPLISHED WORK)

### A. Hạ tầng Backend (N8N & CSDL)
1. **Kiến trúc Agentic Core (`MAIN_ChatBot_V6_Agentic.json`)**: 
   - Đã khởi tạo thành công khối `AI Agent Brain` kết hợp với `OpenAI Chat Model`.
   - Kết nối thành công 2 Tools: **Tra cứu Số liệu SQL** (Map với luồng `K0-C Execute API`) và **Tra cứu Tài liệu RAG** (Map với luồng `K_RAG_Query_AntiBug`).
2. **Bộ nhớ Redis (Chat Memory)**:
   - Tích hợp thành công `Redis Chat Memory` (Lưu lịch sử chat 7200s). Redis Server đã được chạy ngầm cục bộ bằng PM2 tại cổng `127.0.0.1:6379`.
   - Khắc phục lỗi bất đồng bộ tên biến (`text` vs `message`, `session_id` vs `sessionId`).
3. **Data Bypass Engine (Cơ chế bảo mật dữ liệu)**:
   - Xây dựng thành công bộ `Response Assembler` bằng JavaScript.
   - AI chỉ nhả ra `Mã Ngăn Kéo` (VD: `cache_123`). Assembler sẽ chặn ở cuối, lấy mã này chui vào hầm N8N (`$getWorkflowStaticData`) bốc dữ liệu thô ra.
   - Đã xử lý mượt mà logic: Tự động xóa RAM sau khi lấy dữ liệu, và phân biệt được giữa "Chat giao tiếp thông thường" (Không báo lỗi) và "Chat bốc số liệu".

### B. Màn hình Frontend (Giao diện UI/UX)
1. **Zero-Emoji Policy (Quy tắc không biểu tượng cảm xúc)**:
   - Đã "triệt sản" toàn bộ các icon/emoji (`👩‍⚕️`, `📡`, `💰`) được gắn cứng trong các file `chatbot.js` và `chatbot-api-engine.js`.
   - System Prompt của AI cũng bị cấm sử dụng Emoji.
2. **Hiệu năng hiển thị**:
   - Vô hiệu hóa hiệu ứng Typewriter (gõ chữ từ từ) trong mã nguồn, giúp tin nhắn hiển thị tốc độ bàn thờ (Tức thì).
3. **Generative UI (Giao diện tự động nội soi)**:
   - Tích hợp thuật toán Auto-Introspection trong `chatbot-renderers-medstand.js`. Hệ thống tự động nhận diện các trường như `TongNo` để bôi đậm, tự động chia danh sách thành `Mục 1, Mục 2...` cực kỳ đẹp mắt mà không cần code cứng.
4. Chuyển hướng thành công toàn bộ luồng request sang API Endpoint mới: `/webhook/chat-v6`.

---

## 3. ĐỊNH HƯỚNG CHO AI TIẾP THEO (NEXT STEPS & TO-DO)
*(Bạn hãy nạp tài liệu này cho bạn AI tiếp theo và yêu cầu bạn ấy tiếp tục các công việc sau)*

1. **Tối ưu hóa System Prompt (Prompt Engineering):** 
   - Hiện tại AI đã gọi được Tool, nhưng cần rèn luyện thêm System Prompt để AI biết cách gom nhóm hoặc kết hợp cả 2 Tools (RAG + SQL) nếu người dùng hỏi những câu phức tạp.
2. **Bảo mật API (Security):** 
   - Đưa hệ thống xác thực `x-api-key` hoặc JWT vào giữa Frontend và N8N Webhook để tránh bị spam API.
3. **Testing & Đóng gói (Deployment):**
   - Tạo các kịch bản test chịu tải (Load Testing) để xem hệ thống N8N PM2 Portable và Redis chịu được bao nhiêu CCU (Người dùng cùng lúc) trước khi tràn RAM.
   - Viết các file log tự động để theo dõi tỷ lệ Hallucination (AI nói nhảm) của con OpenAI.
4. **Mở rộng Tools (Tool Expansion):**
   - Viết thêm các Tools mới cho AI (Ví dụ: Tool vẽ Biểu đồ tự động, Tool xuất file Excel) và cắm thêm vào `AI Agent Brain`.
