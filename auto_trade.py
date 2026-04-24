import tkinter as tk
from tkinter import ttk
import pyautogui
import keyboard
import time
import threading
import os

class AutoTradeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Auto Trade Mine - VIP Pro")
        self.root.geometry("380x520")
        
        # Lệnh này giúp cửa sổ Tool luôn nổi trên cùng đè lên Minecraft
        self.root.attributes('-topmost', True) 
        
        self.is_running = False
        
        # Cấu trúc Cày Trade
        self.item_x = tk.StringVar(value="500")
        self.item_y = tk.StringVar(value="400")
        self.trade_x = tk.StringVar(value="700")
        self.trade_y = tk.StringVar(value="300")
        self.confirm_x = tk.StringVar(value="850")
        self.confirm_y = tk.StringVar(value="300")
        self.delay = tk.StringVar(value="0.1")
        
        # Cấu trúc Chống Kick
        self.is_auto_reconnect = tk.BooleanVar(value=True)
        self.server_coord_x = tk.StringVar(value="450")
        self.server_coord_y = tk.StringVar(value="350")
        self.sv_password = tk.StringVar(value="/login matkhau123")
        
        # Đường dẫn file log của Minecraft
        self.log_path = os.path.join(os.getenv('APPDATA', ''), '.minecraft', 'logs', 'latest.log')
        
        self.build_ui()
        
        threading.Thread(target=self.hotkey_listener, daemon=True).start()
        self.update_mouse_coords()
        
        # Luồng vệ sĩ: Theo dõi log để phát hiện rớt mạng
        if os.path.exists(self.log_path):
            threading.Thread(target=self.log_monitor_thread, daemon=True).start()
        else:
            print(f"Không tìm thấy log tại: {self.log_path} - Tính năng chống kick sẽ không chạy!")

    # ==========================================
    # PHẦN GIAO DIỆN (UI)
    # ==========================================
    def build_ui(self):
        style = ttk.Style()
        style.configure('TFrame', background='#ffffff')
        
        main_frame = ttk.Frame(self.root, padding=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        self.lbl_mouse = ttk.Label(main_frame, text="Tọa độ: X=0 | Y=0", font=("Consolas", 14, "bold"), foreground="blue")
        self.lbl_mouse.pack(pady=5)
        
        # Tạo chia Tab cho gọn
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True, pady=5)
        
        tab_trade = ttk.Frame(notebook, padding=5)
        tab_recon = ttk.Frame(notebook, padding=5)
        
        notebook.add(tab_trade, text="⚙️ Cày Trade")
        notebook.add(tab_recon, text="🛡️ Chống Rớt Mạng")
        
        # ---- TAB 1: Cày Trade ----
        def create_entry_group(parent, text, var_x, var_y):
            lf = ttk.LabelFrame(parent, text=text, padding=5)
            lf.pack(fill=tk.X, pady=3)
            ttk.Label(lf, text="X:").grid(row=0, column=0, padx=5)
            ttk.Entry(lf, textvariable=var_x, width=10).grid(row=0, column=1)
            ttk.Label(lf, text="Y:").grid(row=0, column=2, padx=10)
            ttk.Entry(lf, textvariable=var_y, width=10).grid(row=0, column=3)
            
        create_entry_group(tab_trade, "1. Vị trí vật phẩm (Kho đồ)", self.item_x, self.item_y)
        create_entry_group(tab_trade, "2. Ô đổi đồ Trade (Của Server)", self.trade_x, self.trade_y)
        create_entry_group(tab_trade, "3. Nút Nhận đồ / Khu vực lấy kết quả", self.confirm_x, self.confirm_y)
        
        f_delay = ttk.Frame(tab_trade)
        f_delay.pack(pady=10)
        ttk.Label(f_delay, text="Delay Click (giây):").pack(side=tk.LEFT)
        ttk.Entry(f_delay, textvariable=self.delay, width=8).pack(side=tk.LEFT, padx=5)
        
        # ---- TAB 2: Chống Kick ----
        ttk.Checkbutton(tab_recon, text="Tự động vào lại Server khi bị diss", variable=self.is_auto_reconnect).pack(anchor=tk.W, pady=5)
        create_entry_group(tab_recon, "Tọa độ tên Server (Trong phần Multiplayer)", self.server_coord_x, self.server_coord_y)
        
        lf_pw = ttk.LabelFrame(tab_recon, text="Lệnh đăng nhập lúc mới vào:", padding=5)
        lf_pw.pack(fill=tk.X, pady=5)
        ttk.Entry(lf_pw, textvariable=self.sv_password, width=35).pack(pady=5)
        
        short_path = "...\\" + self.log_path.split("\\")[-3] + "\\" + self.log_path.split("\\")[-1] if "\\" in self.log_path else self.log_path
        ttk.Label(tab_recon, text=f"Chạy bộ quét log qua: {short_path}", foreground="gray", justify=tk.LEFT).pack(anchor=tk.W, pady=10)
        
        # ---- BOTTOM (Trạng thái và Nút) ----
        self.lbl_status = ttk.Label(main_frame, text="▶ Đang Dừng", font=("Arial", 12, "bold"), foreground="red")
        self.lbl_status.pack(pady=5)
        
        self.btn_toggle = ttk.Button(main_frame, text="CHẠY AUTO [F2]", command=self.toggle_script)
        self.btn_toggle.pack(fill=tk.X, ipady=8, pady=5)

    def update_mouse_coords(self):
        try:
            x, y = pyautogui.position()
            self.lbl_mouse.config(text=f"Trực tiếp: X={x:4d} | Y={y:4d}")
        except: pass
        self.root.after(50, self.update_mouse_coords)

    def hotkey_listener(self):
        keyboard.add_hotkey('f2', self.toggle_script)
        keyboard.wait()
        
    def toggle_script(self):
        if self.is_running:
            self.stop_automation()
        else:
            self.start_automation()

    def start_automation(self):
        self.is_running = True
        self.lbl_status.config(text="🔄 Đang Cày Trade...", foreground="green")
        self.btn_toggle.config(text="DỪNG LẠI [F2]")
        threading.Thread(target=self.run_automation_logic, daemon=True).start()

    def stop_automation(self):
        self.is_running = False
        self.lbl_status.config(text="▶ Đang Dừng", foreground="red")
        self.btn_toggle.config(text="CHẠY AUTO [F2]")

    # ==========================================
    # PHẦN LOGIC (HỒN CỦA TOOL)
    # ==========================================
    def run_automation_logic(self):
        try:
            ix, iy = int(self.item_x.get()), int(self.item_y.get())
            tx, ty = int(self.trade_x.get()), int(self.trade_y.get())
            cx, cy = int(self.confirm_x.get()), int(self.confirm_y.get())
            dly = float(self.delay.get())
            
            # Khúc 1: Gõ lệnh mở kho ảo Server /pv 2
            if not self.is_running: return
            pyautogui.press('t')
            time.sleep(0.1)
            pyautogui.write('/pv 2', interval=0.02)
            time.sleep(0.1)
            pyautogui.press('enter')
            time.sleep(1.5) # Để 1.5s cho chắc ăn server không lag
            
            # Khúc 2: Bốc đồ
            if not self.is_running: return
            pyautogui.moveTo(ix, iy)
            time.sleep(dly)
            pyautogui.click()
            time.sleep(dly)
            
            # Khúc 3: Lót xuống Trade
            if not self.is_running: return
            pyautogui.moveTo(tx, ty)
            time.sleep(dly)
            pyautogui.click()
            time.sleep(dly)
            
            # Khúc 4: Chốt Trade
            if not self.is_running: return
            pyautogui.moveTo(cx, cy)
            time.sleep(dly)
            pyautogui.keyDown('shift') 
            pyautogui.click()
            pyautogui.keyUp('shift')
            time.sleep(dly)
            
            # Khúc 5: ESC thoát
            if not self.is_running: return
            pyautogui.press('esc')
            
        except Exception as e:
            print("Lỗi hệ thống Trade:", e)
        finally:
            pyautogui.keyUp('shift') 
            if self.is_running: 
                self.is_running = False
                self.root.after(0, self.stop_automation)

    # ==========================================
    # LUỒNG VỆ SĨ: AUTO RECONNECT
    # ==========================================
    def log_monitor_thread(self):
        try:
            # Nhảy tới cuối log, chỉ đọc những gì xảy ra TỪ BÂY GIỜ
            with open(self.log_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(0, os.SEEK_END)
                
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(1) # Không có log mới thì ngủ 1s
                        continue
                    
                    if self.is_auto_reconnect.get():
                        txt = line.lower()
                        # Dấu hiệu của một vụ tai nạn mang tên "KICK"
                        if "disconnected from server" in txt or "lost connection" in txt or "kicked" in txt:
                            print("\n[!] CẢNH BÁO: BẠN VỪA BỊ ĐÁ KHỎI SERVER!")
                            self.execute_safety_protocol()
        except Exception as e:
            print("Lỗi bộ đọc log:", e)

    def execute_safety_protocol(self):
        # 1. Tắt trade ngay lập tức tránh nó di chuột loạn xà ngầu
        self.stop_automation()
        self.root.after(0, lambda: self.lbl_status.config(text="⚠️ Rớt Mạng! Đang vào lại...", foreground="orange"))
        
        time.sleep(3) # Đợi màn hình đỏ ngòm "Disconnected" hiện rõ
        
        # 2. Bấm ESC để đóng thông báo đó, lùi về menu Multiplayer
        pyautogui.press('esc')
        time.sleep(2) 
        
        # 3. Double click vào cái tọa độ Server bạn đã cấu hình
        try:
            sx, sy = int(self.server_coord_x.get()), int(self.server_coord_y.get())
            pyautogui.moveTo(sx, sy)
            time.sleep(0.5)
            pyautogui.click()
            time.sleep(0.1)
            pyautogui.click()
        except: pass
        
        print("[!] Đang trong màn hình đen load map...")
        time.sleep(8) # Vụ này tốn thời gian, cho 8s cho đỡ nghẽn
        
        # 4. Gõ mật khẩu
        pyautogui.press('t')
        time.sleep(0.5)
        pyautogui.write(self.sv_password.get(), interval=0.05)
        time.sleep(0.5)
        pyautogui.press('enter')
        
        print("[+] Đã kết nối lại thành công. Bật kịch bản auto trade sau 3 giây.")
        time.sleep(3)
        
        # 5. Kích hoạt lại vòng lặp
        self.root.after(0, self.start_automation)

if __name__ == "__main__":
    _root = tk.Tk()
    app = AutoTradeApp(_root)
    _root.mainloop()
