# 📋 BẢN ĐẶC TẢ: CHIẾN DỊCH DI TRÚ MINECRAFT ENGINE TỪ LEGACY SANG TURING HUB
> Ngày: 08/05/2026 | Phụ trách: 📐 [ARCHITECT] & 🛑 [AUDITOR]

---

## 1. PHÂN TÍCH HIỆN TRẠNG (LEGACY `tool_mine`)

Dự án cũ `tool_mine` là một bản nguyên mẫu (Prototype) tốt nhưng không đạt chuẩn Industrial Grade.
- **Điểm yếu (Pain points):** UI quá cơ bản, khó thao tác. Logic vòng lặp Node.js (`bot_manager.js`) xử lý lỗi kết nối rất kém, thiếu cơ chế Reconnect an toàn hoặc dính lỗi tràn bộ nhớ (Memory Leak) khiến bot văng game liên tục.
- **Điểm mạnh:** Đã có sẵn kho dữ liệu cực kỳ quý giá (Tài khoản, Pass, tọa độ farm chuẩn xác).

---

## 2. QUYẾT ĐỊNH "THANH LỌC" (SALVAGE & DISCARD)

### 🟢 NHỮNG TÀI SẢN NÊN GIỮ LẠI (SALVAGE)
Đây là mỏ vàng dữ liệu chúng ta sẽ bê nguyên xi sang kiến trúc mới `src/minecraft-engine/`:

1. **Database Tài Khoản (`accounts.json`):**
   - Lấy toàn bộ 5 tài khoản: *Matizw2, Acetazolamid, vicentenguyen, nguthichetocc, yuevn*.
   - **Đặc biệt giữ lại logic Vault:** Các tham số `pvStart` và `pvEnd` (Ví dụ `pvStart: 2, pvEnd: 5`) là cực kỳ quan trọng để con `VaultManager.js` mới biết rương nào được phép cất đồ, rương nào không được đụng vào.
   - Giữ lại thông tin mật khẩu (`pass`) để làm script tự động gõ `/login <pass>`.

2. **Dữ liệu Tọa Độ AFK (`locations.json`):**
   - Giữ nguyên 4 tọa độ XYZ.
   - Con `FlightController.js` mới sẽ dùng list tọa độ này kết hợp với Perlin Noise để di chuyển mượt mà tới bãi farm mà không bị Anti-cheat soi.

### 🔴 NHỮNG THỨ CHẮC CHẮN PHẢI VỨT BỎ (DISCARD)
Tuyệt đối không tái sử dụng những rác thải công nghệ này để tránh nợ kỹ thuật (Technical Debt):

1. **Toàn bộ UI/Frontend Cũ (`public/`, `app.js`):**
   - Bỏ giao diện web cũ rích. Thay vào đó, chúng ta sẽ xây bảng điều khiển mới tại `src/frontend-ui/pages/minecraft/` sử dụng thiết kế **Tactical HUD** (Màu tối, Glassmorphism, thanh máu/thực phẩm realtime) để sếp dễ dàng theo dõi nhiều acc cùng lúc.
2. **Luồng Logic Cũ (`bot_manager.js`, `auto_trade.py`):**
   - Quá cồng kềnh. Cơ chế xử lý disconnect cũ gây Crash server.
   - Sẽ thay bằng luồng **Event-Driven** trong `server.js` mới: Bot bị văng sẽ tự delay 15-30 giây rồi connect lại, không spam làm sập server.
   - Bỏ tool trade bằng Python, gom hết vào Node.js Mineflayer cho đồng bộ.

---

## 3. TODO LỘ TRÌNH ĐƯA LÊN TURING HUB (SPRINTS)

- [ ] **Sprint 1: Migration Data** -> Bê file `accounts.json` và `locations.json` từ `tool_mine` ném sang thư mục `shared-knowledge/data/minecraft/`.
- [ ] **Sprint 2: Auto-Login & Vault Logic** -> Tích hợp đọc file tài khoản vào `VaultManager.js`, ép bot tự chat `/login <pass>` khi vừa vào server.
- [ ] **Sprint 3: Pathfinding & AFK** -> Ép `FlightController.js` tự động đọc `locations.json` và di chuyển bot đến `spot-1` hoặc `spot-2`.
- [ ] **Sprint 4: Tactical Dashboard UI** -> Đổ dữ liệu realtime từ Bot sang Giao diện Web mới bằng WebSocket. Hiển thị 5 bot cùng lúc trên 1 màn hình giám sát.

---
*Bản thiết kế này giúp hệ thống mới của sếp kế thừa được dữ liệu xịn, đồng thời xóa sổ hoàn toàn nguyên nhân gây văng game trước đây!*
