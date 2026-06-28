# 🏗️ Architecture Decision Records (ADRs)

> Cập nhật bởi Planner Agent và Reviewer. Mỗi khi đưa ra một quyết định thay đổi kiến trúc lớn, hãy ghi vào đây thay vì để nó chìm vào quên lãng.

## ADR-001: Chuyển đổi sang React (11/05/2026)
- **Context:** Hệ thống Frontend cũ dùng HTML/JS thuần không chịu nổi tải quản lý State cho Multi-Agent.
- **Decision:** Đập đi xây lại bằng Next.js (App Router) + React.
- **Consequences:** Phải tuân thủ nghiêm ngặt Luật của React Hook (Purity, Hydration).

## ADR-002: Sử dụng 12-Step RAG Pipeline (13/05/2026)
- **Context:** RAG thông thường quá yếu để xử lý câu hỏi phức tạp.
- **Decision:** Áp dụng kiến trúc Enterprise 12 bước (có Semantic Cache, Query Rewriter, và Re-ranker).
- **Consequences:** Độ trễ API tăng lên nhưng độ chính xác đạt mức cao nhất. Cần xử lý Streaming trên UI.
