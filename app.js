const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

// Khai báo cấu hình chung của Server
const SERVER_CONFIG = {
    host: "global.luckyvn.com",
    fakeHost: "mc.luckyvn.com",
    version: "1.18.1",
    home: { x: 0, y: 64, z: 0 }
};

// ============================================
// ĐIỀN 5 TÀI KHOẢN CỦA ÔNG VÀO ĐÂY NHÉ:
// ============================================
const ACCOUNTS = [
    { username: 'Matizw2', pass: '92211100' }, // Acc 1
    { username: 'Acetazolamid', pass: 'Dat.2512' }, // Acc 2
    { username: 'vicentenguyen', pass: 'Dat.2512' }, // Acc 3
    { username: 'nguthichetocc', pass: '123456987a' }, // Acc 4
    { username: 'yuevn', pass: '15112009' }  // Acc 5
];

function taoCongNhan(accInfo) {
    // Gộp cấu hình server và tài khoản lại thành BOT_CONFIG
    const BOT_CONFIG = { ...SERVER_CONFIG, ...accInfo };

    const bot = mineflayer.createBot({
        host: BOT_CONFIG.host,
        port: 25565,
        username: BOT_CONFIG.username,
        auth: 'offline',
        fakeHost: BOT_CONFIG.fakeHost,
        version: BOT_CONFIG.version
    });

    // Nạp bộ não AI (Pathfinder) vào bot
    bot.loadPlugin(pathfinder);

    // Hàm Click chuẩn Packet (Có await để không bị crash bộ đếm transaction của Mineflayer)
    async function clickDutKhoat(slot) {
        if (slot === null || slot === undefined) return;
        console.log(`[🔨] Đang nhắm bắn vào Slot ${slot}...`);

        try {
            await bot.clickWindow(slot, 0, 0);
            console.log(`[+] Đã click Packet thành công vào slot ${slot}!`);
        } catch (err) {
            console.log(`[-] Server từ chối lệnh click: ${err.message}`);
        }
    }

    bot.on('windowOpen', async (window) => {
        console.log(`\n[>] Bảng hiện ra: ${window.title}`);

        // Đợi 2 giây cho Server kịp load Item vào bảng (Bắt buộc)
        await new Promise(res => setTimeout(res, 2000));

        const title = window.title ? window.title.toUpperCase() : "";

        // --- TRƯỜNG HỢP 1: BẢNG MENU CHÍNH ---
        if (title.includes('MENU') || title.includes('NETWORK')) {
            let slotTarget = 20; // Mặc định là 20 vì ô 12 là server khác

            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";

                    if (customText.includes('SKYBLOCK') || vanillaText.includes('SKYBLOCK')) {
                        slotTarget = i;
                        console.log(`[OK] MENU CHÍNH: Tìm thấy lệnh đi Skyblock tại ô số ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }

        // --- TRƯỜNG HỢP 2: BẢNG CHỌN CỤM SKYBLOCK ---
        // (Bảng này có cụm LUCKYVN SKYBLOCK)
        else if (title.includes('LUCKYVN') && title.includes('SKYBLOCK')) {
            let slotTarget = 33; // Mặc định theo log cũ Spring ở 33

            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";

                    if (customText.includes('SPRING') || vanillaText.includes('SPRING')) {
                        slotTarget = i;
                        console.log(`[OK] MENU CỤM: Tìm thấy Cụm Spring tại ô ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }

        // --- TRƯỜNG HỢP 3: BẢNG ĐIỂM DANH (Xử lý dứt điểm rác) ---
        else if (title.includes('ĐIỂM DANH') || title.includes('DIEM DANH')) {
            console.log("[>] Bảng Điểm Danh hiện ra. (Đóng bảng để tránh lỗi click bậy bạ)");
            bot.closeWindow(window); // Tắt GUI này đi luôn
        }
    });

    // Cờ đánh dấu để không lặp lại lệnh login khi chuyển Server
    let initialized = false;

    // --- QUY TRÌNH VÀO GAME ---
    bot.on('spawn', () => {
        if (!initialized) {
            initialized = true;
            console.log(`[+] [${BOT_CONFIG.username}] Đã vào sảnh gốc.`);

            // Đợi 3s trước khi login
            setTimeout(() => {
                console.log(`[!] Đang login...`);
                bot.chat(`/login ${BOT_CONFIG.pass}`);
            }, 3000);

            // Quy trình mở la bàn / đồng hồ chọn Server
            setTimeout(() => {
                console.log(`[!] Bấm Phím 5...`);
                bot.setQuickBarSlot(4);
                setTimeout(() => {
                    bot.look(0, 0);
                    bot.activateItem();
                    console.log(`[>] Đã chuột phải để mở Menu BungeeCord.`);
                }, 1000);
            }, 12000);
        } else {
            console.log(`[+] [${BOT_CONFIG.username}] Đã đáp đất bên Cụm Spring an toàn.`);

            // ============================================
            // TẢN RA KHI MỚI VÀO ĐỂ TRANG BỊ CHO NHIỀU ACC
            // ============================================
            console.log(`[!] Đang tản ra một chút để có không gian...`);

            // Xoay mặt sang hướng ngẫu nhiên
            const yaw = Math.random() * Math.PI * 2;
            bot.look(yaw, 0);

            // Bước đi tới phía trước vài giây
            bot.setControlState('forward', true);
            bot.setControlState('jump', true); // nhảy vài cái cho đỡ kẹt block

            // Dừng lại sau ~1.5 đến 3.5 giây
            setTimeout(() => {
                bot.setControlState('forward', false);
                bot.setControlState('jump', false);
                console.log(`[+] Đã tìm được chỗ và đứng yên hoàn toàn.`);
            }, 1500 + Math.random() * 2000);

            console.log(`[!] Bắt đầu kích hoạt chế độ TREO MÁY (Đứng yên tuyệt đối, KHÔNG Anti-AFK).`);

            // Theo yêu cầu: tắt luôn cả vung tay (anti-afk) để hoàn toàn bất động lấy gem
            // setInterval(() => {
            //     bot.swingArm('right');
            // }, 60000); 
        }
    });

    // --- CƠ CHẾ BẤT TỬ (AUTO RECONNECT) ---
    bot.on('end', (reason) => {
        console.log(`[-] [${BOT_CONFIG.username}] Mất kết nối: ${reason}. Tiến hành tái tạo Bot sau 20s...`);
        bot.removeAllListeners(); // Rất quan trọng: Phải xoá tai nghe sự kiện trước khi hồi sinh bot tránh rò rỉ bộ nhớ
        setTimeout(() => taoCongNhan(accInfo), 20000);
    });

    bot.on('error', (err) => {
        console.log(`[LỖI]: ${err.message}`);
    });

    // Lắng nghe và in toàn bộ tin nhắn từ server (có bộ lọc rác siêu cấp)
    bot.on('message', (message) => {
        // const text = message.toString().trim();

        // --- BỘ LỌC RÁC: DANH SÁCH TỪ KHOÁ CẤM ---
        // const spamWords = [
        //    'ʙᴏᴏꜱᴛᴇʀ', 'CLEANING STAFF', 'tài xỉu - LUCKYVN', 'NHIỆM VỤ ĐẶC BIỆT',
        //    'Nhận ngay:', 'Trạng thái: Hoàn thành', 'Link:', 'Kết thúc sau:',
        //    'Bạn có thể kiếm tiền', 'Khi mua rank', 'Xem top tuần này'
        // ];

        // Nếu có chữ nào trong danh sách trên thì xoá phát một không in ra
        // if (!text || spamWords.some(word => text.includes(word))) return;

        // Đã tắt hoàn toàn console.log chat theo yêu cầu
        // console.log(`[CHAT] ${message.toAnsi()}`);
    });

    // --- TÍNH NĂNG ĐIỀU KHIỂN AI TỪ XA BẰNG KÊNH CHAT ---
    bot.on('chat', (username, message) => {
        // Không nhận lệnh từ chính nó
        if (username === bot.username) return;

        // Nếu có ai chat lệnh "!come"
        if (message === '!come') {
            const target = bot.players[username] ? bot.players[username].entity : null;
            if (!target) {
                console.log(`[AI] Không tìm thấy toạ độ của ${username} để đi tới.`);
                return;
            }

            // Gọi dữ liệu vật lý của phiên bản đang chơi
            const mcData = require('minecraft-data')(bot.version);
            const defaultMove = new Movements(bot, mcData);

            // Xoá quyền đập lốc/đặt block của bot (chỉ cho phép đi bộ/nhảy)
            defaultMove.canDig = false;

            // Nạp thông số vật lý và ra lệnh đi tới chỗ người gọi (cách 1 block thì dừng)
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new goals.GoalFollow(target, 1), true);

            console.log(`[AI] Đang cắm đầu chạy tới vị trí của ${username}...`);
        }

        // Lệnh "!stop" để bắt nó dừng lại
        if (message === '!stop') {
            bot.pathfinder.setGoal(null);
            console.log(`[AI] Đã ra lệnh đứng yên!`);
        }
    });

}

console.clear();
console.log("🔥 BOT LUCKYVN - CHÍNH THỨC SẴN SÀNG TREO 24/7 (CHẾ ĐỘ MAX 5 ACC) 🔥");

// Chạy lần lượt từng acc để tránh bị server phát hiện hoặc quá tải
ACCOUNTS.forEach((acc, index) => {
    setTimeout(() => {
        console.log(`\n[=== 🚀 Đang Khởi Động Acc ${index + 1}: ${acc.username} ===]`);
        taoCongNhan(acc);
    }, index * 10000); // Mỗi acc cách nhau 10 giây (10000 ms)
});
