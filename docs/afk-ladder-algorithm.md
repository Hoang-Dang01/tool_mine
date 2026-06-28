# 🛡️ Blueprint: Stealth AFK Ladder Algorithm
**Nguồn:** Thảo luận Kiến trúc Bot (Phase 01)
**Ngày:** 2026-05-13
**Mục tiêu:** Thuật toán điều phối Hạm đội Bot (Swarm) cày Top AFK trong Minecraft một cách có tổ chức, giữ vững thứ hạng tuyệt đối mà không bị Admin phát hiện (Anti-Ban).

---

## 1. Vấn Đề (The Problem)
Khi cắm nhiều Account (Acc1, Acc2, Acc3...) để tranh Top AFK, nếu cắm chạy 24/7 đồng loạt thì:
- Thời gian sẽ sát nút nhau, rất dễ bị đảo lộn thứ hạng do lag/disconnect ngẫu nhiên.
- Rất dễ bị Admin phát hiện dùng tool vì các tài khoản hoạt động song song như những cỗ máy.

## 2. Giải Pháp: Thuật toán "Treo Lệch Pha Tránh Né" (Dynamic Spacing & Randomization)

### Bước 1: Cảm biến Đọc Top (Stealth Sensor)
- **Chu kỳ hoạt động:** Thay vì check liên tục (rất máy móc), bot sẽ chỉ mở GUI hoặc gõ lệnh `/top` với chu kỳ thưa thớt: **Khoảng 2 tiếng / 1 lần**.
- **Mục đích:** Cập nhật số liệu AFK thực tế của toàn Server về Bộ não trung tâm (Turing Hub).

### Bước 2: Thuật Toán Giữ Khoảng Cách An Toàn có Jitter (Anti-Ban Margin)
- **Cấu hình thứ tự:** Chỉ định cứng trên Dashboard: `Acc_Top1 > Acc_Top2 > Acc_Top3`.
- **Khoảng cách mục tiêu (Margin):** Thay vì là một con số cố định (vd đúng 2h), thuật toán sẽ tạo ra một hàm `Random(1, 3)` (Từ 1 tiếng đến 3 tiếng).
- **Logic:** 
  `Khoảng cách an toàn hiện tại = Random(1h, 3h)`
  `Điều kiện: Thời gian (Acc_Top1) - Thời gian (Acc_Top2) >= Khoảng cách an toàn hiện tại`

*Ví dụ: Hôm nay hệ thống random ra khoảng cách 1.5h. Ngày mai hệ thống random ra khoảng cách 2.2h. Nhờ vậy, Admin nhìn vào sẽ thấy khoảng cách giữa các Acc luôn thay đổi rất tự nhiên (Human-like).*

### Bước 3: Cơ Chế "Hi Sinh" Bất Đối Xứng (Asymmetric Auto-Rest)
- Nếu vì lý do nào đó (Acc_Top1 bị văng), dẫn đến việc Acc_Top2 sắp đuổi kịp (khoảng cách thu hẹp dưới mức an toàn).
- **Hành động:** Hệ thống tự động NGẮT KẾT NỐI (Log out) Acc_Top2. Trạng thái chuyển về `Nghỉ Ngơi`.
- **Kích hoạt lại:** Chỉ khi Acc_Top1 vào lại server và kéo giãn khoảng cách vượt qua mức an toàn (ví dụ: lại cách xa hơn 2 tiếng), hệ thống mới cho Acc_Top2 login vào cày tiếp.

## 3. Ứng Dụng Vào Frontend / Backend
- **Frontend (Turing Hub):** Đã có bảng hiển thị Cột `Thời Gian Treo`, trạng thái (Đang treo, Đang nghỉ ngơi) và cột `Mục Tiêu (Cày Top)` tại trang chi tiết Minecraft Engine.
- **Backend (Mineflayer):** Cần code một vòng lặp (Event Loop) điều phối chung (Master Orchestrator), đọc config từ API và điều khiển từng instance Mineflayer theo logic trên.
