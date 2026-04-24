# 🚀 CẨM NANG LỆNH VPS & BẢO MẬT (Dành cho Đăng)

Dưới đây là tổng hợp các lệnh thường dùng để quản lý server (VPS), Git, PM2, Docker và kết nối SSH.

## 1. Nhóm lệnh Kết nối & Bảo mật (Dùng trên máy Legion)

| Câu lệnh | Tác dụng |
| --- | --- |
| `ssh -i AI-Agent_key.pem azureuser@20.255.63.159` | Đăng nhập từ xa vào server (Hong Kong) bằng "chìa khóa" `.pem`. |
| `icacls "AI-Agent_key.pem" /inheritance:r /grant:r "%username%":"(R)"` | Fix lỗi bảo mật file key trên Windows (chỉ cho phép mình ông được đọc file). |
| `exit` | Thoát khỏi server, quay về máy Legion. |

## 2. Nhóm lệnh Hệ thống & Môi trường (Dùng bên trong VPS)

| Câu lệnh | Tác dụng |
| --- | --- |
| `sudo apt update && sudo apt upgrade -y` | Cập nhật toàn bộ các phần mềm hệ thống lên bản mới nhất. |
| `node -v && npm -v` | Kiểm tra phiên bản Node.js và npm đã cài trên máy chưa. |
| `cat ~/.ssh/id_rsa.pub` | Lấy mã "chìa khóa công khai" để dán vào GitHub (SSH Key). |
| `ls` | Liệt kê các file và thư mục đang có. |
| `cd <tên_thư_mục>` | Đi vào một thư mục nào đó. |
| `cd ..` | Quay lại thư mục cấp trước đó. |

## 3. Nhóm lệnh Git & Quản lý Code

| Câu lệnh | Tác dụng |
| --- | --- |
| `git clone git@github.com:Hoang-Dang01/tool_mine.git` | Tải code từ GitHub về server lần đầu tiên. |
| `git pull` | Cập nhật code mới nhất từ GitHub về (dùng khi ông vừa sửa code ở máy nhà và push lên). |
| `npm install` | Tải tất cả các thư viện cần thiết để chạy dự án (vào thư mục `node_modules`). |

## 4. Nhóm lệnh PM2 (Quản lý App chạy ngầm 24/7)

| Câu lệnh | Tác dụng |
| --- | --- |
| `pm2 start server.js --name "tool-mine"` | Chạy app và đặt tên cho nó, giúp app không bị sập khi tắt Terminal. |
| `pm2 list` (hoặc `pm2 status`) | Xem danh sách các app đang chạy ngầm và tình trạng (online/offline). |
| `pm2 logs tool-mine` | Xem nhật ký hoạt động (để debug nếu app bị lỗi). |
| `pm2 restart tool-mine` | Khởi động lại app (thường dùng sau khi ông `git pull` code mới). |
| `pm2 stop tool-mine` | Dừng app lại. |
| `pm2 save` | Lưu danh sách app để tự động bật lại nếu server bị reboot. |

## 5. Nhóm lệnh Docker (Dành cho n8n)

| Câu lệnh | Tác dụng |
| --- | --- |
| `docker ps` | Xem các "container" (như n8n) có đang chạy hay không. |
| `docker compose up -d` | Khởi chạy n8n dựa trên file cấu hình `docker-compose.yml` (chạy ngầm). |
| `docker compose down` | Dừng và xóa các container n8n. |
| `docker compose logs -f` | Xem trực tiếp n8n đang làm gì bên trong. |

---

## 💡 Mẹo nhỏ cho Đăng:

* **Phím `Tab`**: Khi gõ tên thư mục hoặc tên file dài (như `AI-Agent_key.pem`), ông chỉ cần gõ vài chữ đầu rồi nhấn phím `Tab`, máy sẽ tự điền nốt phần còn lại, đỡ phải gõ mỏi tay.
* **Mũi tên `Lên/Xuống`**: Nhấn phím mũi tên lên để tìm lại những lệnh ông đã gõ trước đó, cực nhanh!
