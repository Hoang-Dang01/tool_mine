const mineflayer = require('mineflayer');

const BOT_CONFIG = {
    username: 'Matizw2',
    pass: '92211100',
    host: "global.luckyvn.com",
    fakeHost: "mc.luckyvn.com",
    version: "1.18.1"
};

function taoCongNhan() {
    const bot = mineflayer.createBot({
        host: BOT_CONFIG.host,
        port: 25565,
        username: BOT_CONFIG.username,
        auth: 'offline',
        fakeHost: BOT_CONFIG.fakeHost,
        version: BOT_CONFIG.version
    });

    // (FIX LỖI 1): Hàm Click chuẩn Packet
    async function clickDutKhoat(slot) {
        if (slot === null || slot === undefined) return;
        console.log(`[🔨] Đang nhắm bắn vào Slot ${slot}...`);
        
        try {
            // Await chờ phản hồi từ server
            await bot.clickWindow(slot, 0, 0);
            console.log(`[+] Đã click Packet thành công vào slot ${slot}!`);
        } catch (err) {
            console.log(`[-] Server từ chối lệnh click: ${err.message}`);
        }
    }

    bot.on('windowOpen', async (window) => {
        console.log(`\n[>] Bảng hiện ra: ${window.title}`);
        
        // Đợi 2 giây cho Server kịp load Item vào bảng
        await new Promise(res => setTimeout(res, 2000));

        // Mẹo IT: In danh sách đồ ra console để coi mặt mũi tụi nó
        console.log("=== THÁM THÍNH DANH SÁCH ITEM TRONG BẢNG ===");
        console.log(window.slots.map((item, index) => item ? `${index}: ${item.customName || item.displayName}` : null).filter(i => i !== null));
        console.log("=============================================");

        const title = window.title ? window.title.toUpperCase() : "";

        // --- TRƯỜNG HỢP 1: MENU CHÍNH ---
        if (title.includes('LUCKYVN') || title.includes('NETWORK') || title.includes('MENU')) {
            let slotTarget = 12; 

            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";
                    
                    if (customText.includes('SKYBLOCK') || vanillaText.includes('SKYBLOCK')) {
                        slotTarget = i;
                        console.log(`[OK] Tìm thấy lệnh Skyblock tại ô số ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }

        // --- TRƯỜNG HỢP 2: MENU CỤM SKYBLOCK ---
        else if (title.includes('SKYBLOCK') || title.includes('SERVER')) {
            let slotTarget = 22; 

            for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                    const customText = item.customName ? item.customName.toUpperCase() : "";
                    const vanillaText = item.displayName ? item.displayName.toUpperCase() : "";
                    
                    if (customText.includes('SPRING') || vanillaText.includes('SPRING')) {
                        slotTarget = i;
                        console.log(`[OK] Tìm thấy Cụm Spring tại ô ${i}`);
                        break;
                    }
                }
            }
            await clickDutKhoat(slotTarget);
        }
    });

    // --- QUY TRÌNH VÀO GAME ---
    bot.on('spawn', () => {
        console.log(`[+] [${BOT_CONFIG.username}] Đã vào sảnh.`);
        
        // Login
        setTimeout(() => {
            console.log(`[!] Đang login...`);
            bot.chat(`/login ${BOT_CONFIG.pass}`);
        }, 3000);

        // Mở Menu (Bạn set 12 giây khá an toàn đấy)
        setTimeout(() => {
            console.log(`[!] Bấm Phím 5... (Cầm đồng hồ/La bàn)`);
            bot.setQuickBarSlot(4);
            setTimeout(() => {
                bot.look(0, 0); // Ngó thẳng
                bot.activateItem(); // Ấn chuột phải rẹt rẹt
                console.log(`[>] Đã chuột phải mở Menu.`);
            }, 1000);
        }, 12000);
    });

    bot.on('end', (reason) => {
        console.log(`[-] Mất kết nối: ${reason}.`);
        process.exit(0); // Kết thúc quy trình test
    });
    
    bot.on('error', (err) => {
        console.log(`[LỖI CỐT LÕI]: ${err.message}`);
    });
}

console.log("🔥 CHẠY THỬ BOT LUCKYVN PHIÊN BẢN FIX 🔥");
taoCongNhan();
