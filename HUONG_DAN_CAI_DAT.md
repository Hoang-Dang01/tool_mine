# 📘 CẨM NANG TRIỂN KHAI BOT MINEFLAYER (50+ ACC CẮM 24/7)

Tài liệu này dành cho dân IT để ném nguyên cái Túp lều (Folder) này lên một con máy tính khác (VPS, Máy trạm, hoặc máy thằng bạn) và cắm tự động không cần treo màn hình.

---

## BƯỚC 1: CHUẨN BỊ MÔI TRƯỜNG CHO MÁY MỚI
Nếu máy tính mới chưa từng gõ code bao giờ, bạn phải cài linh hồn cho nó:
1. Tải và cài đặt **[Node.js](https://nodejs.org/)** (Cứ bấm Next Next tới bến).
2. Xong khởi động lại máy (hoặc bật cái Command Prompt mới tinh lên) để nó nhận diện môi trường.

---

## BƯỚC 2: COPY VÀ ĐÓNG GÓI
1. Giải nén/Copy cái thư mục **`Tool Mine`** này quăng qua bên máy kia.
2. Mở Terminal (hoặc CMD) chĩa thẳng vào thư mục `Tool Mine` đó:
   * Mẹo: Vào thư mục đó, gõ chữ `cmd` lên ô đường dẫn File Explorer rồi Enter.

---

## BƯỚC 3: CÀI ĐẶT "SÚNG ĐẠN" (Làm 1 lần duy nhất)

Gõ lần lượt 3 lệnh thần thánh này vào CMD:

```bash
# 1. Khởi tạo cục dự án Node.js (Nếu trong folder chưa có file package.json)
npm init -y

# 2. Tải cái lõi Bot Mineflayer 
npm install mineflayer

# 3. Tải công cụ Trùm Cuối quản lý 24/7 (PM2 - cài thẳng vào lõi Hệ điều hành)
npm install -g pm2
```

---

## BƯỚC 4: CẤU HÌNH ACC & IP TRONG FILE `app.js`
Bạn mở file `app.js` lên (Sửa bằng Notepad hay VSCode đều được) và điền các thông tin sau ở dòng đầu:

```javascript
const SERVER_IP = "vidu.net";    // Sửa thành IP Server bạn muốn công phá
const PASSWORD = "matkhaucuaban"; // Chỉ cần nếu server bắt /login

const DANH_SACH_ACC = [
    { username: 'AccCuaTui_1' },
    { username: 'AccCuaTui_2' },
    { username: 'AccCuaTui_3' },
    { username: 'AccCuaTui_4' },
    { username: 'AccCuaTui_5' }, // Rải thêm acc nếu server chưa sập
];
```

---

## BƯỚC 5: XUẤT KÍCH (RUN)

### Chế độ Test (Nên làm trước để xem nó có báo lỗi gì không)
Gõ lệnh:
```bash
node app.js
```
=> Xem log in ra console. Nó hiện đỏ/vàng gì thì CTRL+C (để tắt) rồi fix. Nếu tất cả chui vào server ngon ơ thì chuyển qua bước dưới.

### Chế độ Ma Quỷ (Cắm 24/7 Ẩn Màn Hình)
Gõ lệnh này để thảy nó vào bóng tối, bạn có thể tắt luôn cái cửa sổ đen CMD đi mà bot vẫn chạy:
```bash
pm2 start app.js --name "Bot_DaoMo"
```

---

## 🛠️ CÁC LỆNH BẢO TRÌ BỎ TÚI KHI DÙNG PM2 (CỰC KỲ QUAN TRỌNG)

Bởi vì nó chạy ẩn, nên bạn không thể ấn chéo (X) để tắt nó. Xài các lệnh sau:

* Cầm ống nhòm theo dõi xem bot đang nói gì (Xem log ngầm):
  ```bash
  pm2 log Bot_DaoMo
  ```

* Xem trạng thái sức khỏe (Nó bú bao nhiêu RAM/CPU - Thường chỉ 50MB):
  ```bash
  pm2 monit
  ```

* Báo động đỏ, kéo hết toàn bộ quân về (Tắt tool hoàn toàn):
  ```bash
  pm2 stop Bot_DaoMo
  ```

* Khởi động lại toàn bộ nếu server bảo trì xong:
  ```bash
  pm2 restart Bot_DaoMo
  ```

* Lưu trạng thái để lỡ cúp điện rớt mạng Windows khởi động lại thì bot cũng DẬY THEO:
  ```bash
  pm2 save
  pm2 startup
  ```
