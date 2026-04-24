const socket = io();

const API_URL = '/api';

const botGrid = document.getElementById('botGrid');
const consoleWindow = document.getElementById('consoleWindow');
const btnClearLog = document.getElementById('btnClearLog');
const newUsername = document.getElementById('newUsername');
const newPass = document.getElementById('newPass');
const btnAdd = document.getElementById('btnAdd');

let selectedBotId = null; // Trạng thái xem log của riêng bot nào
const consoleTitle = document.querySelector('.console-header h2');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');

let globalLocations = { afk_spots: [], npc_trade: null };

// --- HÀM VIEW (RENDER) ---
function renderBots(accounts) {
    botGrid.innerHTML = '';
    accounts.forEach(acc => {
        let statusClass = `status-${acc.status}`;
        let statusText = acc.status.toUpperCase();
        if (acc.status === 'waiting') {
            statusClass = 'status-connecting'; // Use same color as connecting (yellow) or add something
            statusText = 'WAITING (Đang Chờ)';
        }
        
        let actions = '';
        if (acc.status === 'online' || acc.status === 'connecting' || acc.status === 'waiting') {
            actions = `<button class="btn btn-stop" onclick="event.stopPropagation(); stopBot('${acc.id}')"><i class="fa-solid fa-stop"></i> MÁY NGHỈ</button>`;
        } else {
            actions = `<button class="btn btn-start" onclick="event.stopPropagation(); startBot('${acc.id}')"><i class="fa-solid fa-play"></i> CHẠY BOT</button>`;
        }

        const isSelected = selectedBotId === acc.id ? 'selected' : '';

        // Dropdown chọn góc AFK
        const afkSpotOptions = (globalLocations.afk_spots || []).map(spot => 
            `<option value="${spot.id}" ${acc.afkSpotId === spot.id ? 'selected' : ''}>📍 ${spot.name}</option>`
        ).join('');

        // Dropdown chọn Mode & Công tắc PvP
        const modeSelect = `
            <select class="mode-select" id="mode-${acc.id}" onchange="document.getElementById('pv-config-${acc.id}').style.display = this.value === 'trade' ? 'inline-block' : 'none';" onclick="event.stopPropagation()">
                <option value="afk" ${acc.mode === 'afk' ? 'selected' : ''}>🛡️ Smart AFK</option>
                <option value="trade" ${acc.mode === 'trade' ? 'selected' : ''}>💰 Auto Trade</option>
                <option value="random" ${acc.mode === 'random' ? 'selected' : ''}>🚶 Tản ra tự do</option>
            </select>
            <select class="mode-select" id="afkspot-${acc.id}" onclick="event.stopPropagation()" style="margin-top: 5px; max-width: 150px;" title="Chọn góc AFK">
                <option value="">-- Chọn Góc AFK --</option>
                ${afkSpotOptions}
            </select>
            <div id="pv-config-${acc.id}" style="display: ${acc.mode === 'trade' ? 'inline-block' : 'none'}; margin-top: 5px;" onclick="event.stopPropagation()">
                <span style="font-size: 11px; color: #ccc;">Kho PV:</span>
                <input type="number" id="pvstart-${acc.id}" value="${acc.pvStart || 2}" title="Từ PV X" style="width: 35px; background: #222; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 11px; text-align: center;"> 
                <span style="color: #ccc;">-</span> 
                <input type="number" id="pvend-${acc.id}" value="${acc.pvEnd || 5}" title="Đến PV Y" style="width: 35px; background: #222; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 11px; text-align: center;">
            </div>
            <label class="pvp-toggle" onclick="event.stopPropagation()" style="margin-top: 5px; display: inline-flex; align-items: center; vertical-align: middle;">
                <input type="checkbox" id="pvp-${acc.id}" ${acc.pvpEnabled !== false ? 'checked' : ''} onchange="document.getElementById('pvp-text-${acc.id}').innerText = this.checked ? 'PvP Bật' : 'PvP Tắt'"> 
                <span id="pvp-text-${acc.id}">${acc.pvpEnabled !== false ? 'PvP Bật' : 'PvP Tắt'}</span>
            </label>
            <button class="btn-save-config" onclick="event.stopPropagation(); saveBotConfig('${acc.id}', this)" title="Lưu cấu hình">💾 LƯU</button>
        `;

        const html = `
            <div class="bot-card ${isSelected}" id="card-${acc.id}" onclick="toggleSelectBot('${acc.id}', '${acc.username}')">
                <div class="bot-info">
                    <h4>${acc.username} <span class="status-badge ${statusClass}" id="status-${acc.id}">${statusText}</span></h4>
                    <p>Pass: ${'*'.repeat(acc.pass.length)} | Server: Cụm Spring</p>
                    <div class="bot-configs" onclick="event.stopPropagation()">
                        ${modeSelect}
                    </div>
                </div>
                <div class="bot-actions" id="actions-${acc.id}">
                    ${actions}
                    <button class="btn btn-del" onclick="event.stopPropagation(); deleteBot('${acc.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        botGrid.insertAdjacentHTML('beforeend', html);
    });
}

// --- HÀM CALL API ---
async function fetchAccounts() {
    try {
        const res = await fetch(`${API_URL}/accounts`);
        const data = await res.json();
        renderBots(data);
    } catch (err) {
        appendLog('SYSTEM', 'Không thể kết nối đến API Server.', 'error');
    }
}

async function addAccount() {
    const user = newUsername.value.trim();
    const pass = newPass.value.trim();
    if (!user || !pass) return alert('Vui lòng nhập đủ thông tin!');

    await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, pass })
    });

    newUsername.value = '';
    newPass.value = '';
    fetchAccounts();
    appendLog('SYSTEM', `Đã thêm tài khoản: ${user}`, 'success');
}

async function startBot(id) {
    const mode = document.getElementById(`mode-${id}`).value;
    const afkSpotId = document.getElementById(`afkspot-${id}`).value;
    const pvp = document.getElementById(`pvp-${id}`).checked;
    const pvStart = parseInt(document.getElementById(`pvstart-${id}`).value) || 2;
    const pvEnd = parseInt(document.getElementById(`pvend-${id}`).value) || 5;

    const res = await fetch(`${API_URL}/bots/${id}/start`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, pvp, afkSpotId, pvStart, pvEnd })
    });
    const data = await res.json();
    if(data.success) fetchAccounts();
}

async function saveBotConfig(id, btn) {
    const mode = document.getElementById(`mode-${id}`).value;
    const afkSpotId = document.getElementById(`afkspot-${id}`).value;
    const pvp = document.getElementById(`pvp-${id}`).checked;
    const pvStart = parseInt(document.getElementById(`pvstart-${id}`).value) || 2;
    const pvEnd = parseInt(document.getElementById(`pvend-${id}`).value) || 5;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Lưu...';

    try {
        const res = await fetch(`${API_URL}/bots/${id}/config`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, pvp, afkSpotId, pvStart, pvEnd })
        });
        const data = await res.json();
        if (data.success) {
            btn.innerHTML = '✅ ĐÃ LƯU';
            btn.style.background = '#059669'; // Green success
            appendLog('SYSTEM', `[{${id}}] Áp dụng Mode: ${mode} | PvP: ${pvp ? 'Bật':'Tắt'}`, 'success');
        } else {
            btn.innerHTML = '❌ TỪ CHỐI';
            btn.style.background = '#ef4444'; // Red error
        }
    } catch (err) {
        btn.innerHTML = '❌ LỖI VĂNG';
        btn.style.background = '#ef4444';
        appendLog('SYSTEM', `[{${id}}] Quên bật Server. Hãy "node server.js" lại nha!`, 'error');
    }

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2500);
}

async function stopBot(id) {
    const res = await fetch(`${API_URL}/bots/${id}/stop`, { method: 'POST' });
    const data = await res.json();
    if(data.success) fetchAccounts();
}

async function deleteBot(id) {
    if (!confirm('Bạn có chắc xoá tài khoản này?')) return;
    await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
    fetchAccounts();
}

// --- LOGIC GIAO DIỆN CONSOLE ---
function appendLog(id, message, type = 'normal') {
    const time = new Date().toLocaleTimeString('vi-VN');
    let extraClass = type !== 'normal' ? type : '';

    // Nhận diện lỗi
    if (message.toLowerCase().includes('lỗi') || message.toLowerCase().includes('từ chối')) {
        extraClass = 'error';
    }

    // Nếu đang lọc log thì log mới tạo ra có class ẩn hay hiện luôn
    const isHidden = (selectedBotId !== null && id !== 'SYSTEM' && id !== selectedBotId) ? 'style="display: none;"' : '';
    const dataAttr = id !== 'SYSTEM' ? `data-bot-id="${id}"` : '';

    const html = `
        <div class="log-entry ${extraClass}" ${dataAttr} ${isHidden}>
            <span class="log-time">[${time}]</span>
            <span class="log-id">[${id}]</span>
            <span class="log-msg">${message}</span>
        </div>
    `;
    consoleWindow.insertAdjacentHTML('beforeend', html);
    consoleWindow.scrollTop = consoleWindow.scrollHeight; // Tự động cuộn xuống cuối
}

// --- LOGIC LỌC LOG (BẤM VÀO CARD) ---
function toggleSelectBot(id, username) {
    if (selectedBotId === id) {
        // Bấm lại lần nữa thì bỏ chọn (Xem lại tất cả log)
        selectedBotId = null;
        consoleTitle.innerHTML = `<i class="fa-solid fa-terminal"></i> LIVE CONSOLE (Tất Cả)`;
        chatInput.disabled = true;
        btnSendChat.disabled = true;
        chatInput.placeholder = "Chọn một thẻ Bot để gửi lệnh (VD: /pv 2)...";
    } else {
        // Chọn một bot
        selectedBotId = id;
        consoleTitle.innerHTML = `<i class="fa-solid fa-filter"></i> LỌC LOG: ${username}`;
        chatInput.disabled = false;
        btnSendChat.disabled = false;
        chatInput.placeholder = `Nhập lệnh cho ${username} rồi bấm Enter...`;
        chatInput.focus();
    }

    // Render lại danh sách thẻ (bằng thao tác DOM trực tiếp để tránh tải lại làm mất trạng thái nhập liệu đang dở)
    const allCards = document.querySelectorAll('.bot-card');
    allCards.forEach(card => card.classList.remove('selected'));
    if (selectedBotId !== null) {
        const selectedCard = document.getElementById(`card-${selectedBotId}`);
        if(selectedCard) selectedCard.classList.add('selected');
    }

    // Duyệt qua tất cả các log cũ để ẩn/hiện
    const allLogs = document.querySelectorAll('.log-entry[data-bot-id]');
    allLogs.forEach(log => {
        const logId = log.getAttribute('data-bot-id');
        if (selectedBotId === null) {
            log.style.display = 'block'; // Hiển thị hết
        } else {
            if (logId === selectedBotId) {
                log.style.display = 'block';
            } else {
                log.style.display = 'none';
            }
        }
    });
    consoleWindow.scrollTop = consoleWindow.scrollHeight;
}

// --- LẮNG NGHE SỰ KIỆN ---
btnAdd.addEventListener('click', addAccount);
btnClearLog.addEventListener('click', () => {
    consoleWindow.innerHTML = '<div class="log-entry system">[SYSTEM] Đã xoá sạch lịch sử Log.</div>';
});

// Logic bấm gửi Chat
async function handleSendChat() {
    const text = chatInput.value.trim();
    if (!text || !selectedBotId) return;

    chatInput.value = ''; // Xoá trắng
    await fetch(`${API_URL}/bots/${selectedBotId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
    });
}

btnSendChat.addEventListener('click', handleSendChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendChat();
});

// Nhận dữ liệu từ Server thông qua Websocket
socket.on('bot_log', (data) => {
    appendLog(data.id, data.message);
});

socket.on('bot_status', (data) => {
    fetchAccounts();
    if(data.status === 'online') {
        appendLog('SYSTEM', `[{${data.id}}] Đã online thành công!`, 'success');
    }
});

socket.on('accounts_ui_update', () => {
    // Tự động tải lại thẻ Bots nếu có cấu hình thay đổi từ người dùng khác
    fetchAccounts();
});

// BIẾN TOÀN CỤC CHỨA TỔNG TÀI SẢN
let globalInventory = {};

socket.on('bot_inventory_data', (data) => {
    // Cộng dồn tài sản từ các rương được báo cáo
    for (const [itemName, count] of Object.entries(data.inventory)) {
        globalInventory[itemName] = (globalInventory[itemName] || 0) + count;
    }
    updateAnalyticsUI();
});

function updateAnalyticsUI() {
    const container = document.getElementById('analyticsContent');
    const items = Object.entries(globalInventory);
    
    if (items.length === 0) {
        container.innerHTML = '<span class="empty-text">Chưa nội soi được rương nào... Đang chờ dữ liệu!</span>';
        return;
    }

    // Sắp xếp giảm dần theo số lượng
    items.sort((a, b) => b[1] - a[1]);

    const html = items.map(([name, count]) => {
        return `<div class="analytics-item">
                    <span class="item-name">${name}</span>
                    <span class="item-count">x${count}</span>
                </div>`;
    }).join('');

    container.innerHTML = html;
}

async function sendChatAll() {
    const input = document.getElementById('chatAllInput');
    const message = input.value.trim();
    if (!message) return;

    try {
        await fetch(`${API_URL}/bots/chat-all/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        appendLog('SERVER', `Đã GỬI LỆNH TỔNG: ${message}`, 'warning');
        input.value = '';
    } catch (err) {
        alert("Lỗi kết nối khi gửi lệnh bầy đàn!");
    }
}

// === LOGIC BẢNG VỊ TRÍ CHI TIẾT ===
// (Giữ nguyên logic cũ của Bảng rương đồ)
let isChestPanelOpen = false;
function toggleChestPanel() {
    isChestPanelOpen = !isChestPanelOpen;
    const panel = document.getElementById('chestTableWrapper');
    if (panel) panel.style.display = isChestPanelOpen ? 'block' : 'none';
}

let chestInventories = {}; // Lưu lịch sử rương mở gần nhất của từng Bot

socket.on('bot_chest_details', (data) => {
    chestInventories[data.id] = {
        title: data.title,
        items: data.items,
        timestamp: Date.now()
    };
    renderChestTable();
});

function renderChestTable() {
    const tbody = document.getElementById('chestTableData');
    if (!tbody) return;
    
    let html = '';
    const sortedBots = Object.keys(chestInventories).sort((a, b) => chestInventories[b].timestamp - chestInventories[a].timestamp);
    
    if (sortedBots.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 10px; color: #aaa;">Đang chờ Bot mở rương...</td></tr>`;
        return;
    }
    
    sortedBots.forEach(botId => {
        const chest = chestInventories[botId];
        html += `<tr style="background: rgba(255,255,255,0.05);"><td colspan="4" style="padding: 6px; color: #aaa; text-align: center;">--- Lần cuối của <b>${botId}</b>: <i>${chest.title || 'Kho'}</i> ---</td></tr>`;
        
        if (!chest.items || chest.items.length === 0) {
            html += `<tr><td colspan="4" style="text-align:center; padding: 6px;">Rương trống</td></tr>`;
        } else {
            chest.items.forEach(it => {
                html += `<tr style="border-bottom: 1px solid #333;">
                    <td style="padding: 6px; font-size: 13px; color: #ccc;">[${botId}]</td>
                    <td style="padding: 6px; color: #4ade80; font-weight: bold; text-align: center;">Slot ${it.slot}</td>
                    <td style="padding: 6px;">${it.name}</td>
                    <td style="padding: 6px; color: #fbbf24;">x${it.count}</td>
                </tr>`;
            });
        }
    });

    tbody.innerHTML = html;
}

// === QUẢN LÝ TỌA ĐỘ LOCATIONS ===
async function fetchLocations() {
    try {
        const res = await fetch(`${API_URL}/locations`);
        globalLocations = await res.json();
        renderLocations();
        // Sau khi đã có location, mới lấy danh sách account để map dữ liệu Dropdown
        fetchAccounts();
    } catch(err) {
        console.error("Lỗi tải toạ độ:", err);
        fetchAccounts(); // Fallback nếu fail
    }
}

function renderLocations() {
    const list = document.getElementById('locationList');
    if (!list) return;
    let html = '';
    
    if (globalLocations.npc_trade) {
        html += `<span style="background: #a855f7; color: white; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 5px;">
            🧙‍♂️ NPC: X:${globalLocations.npc_trade.x.toFixed(1)} Y:${globalLocations.npc_trade.y.toFixed(1)} Z:${globalLocations.npc_trade.z.toFixed(1)}
        </span>`;
    }

    if (globalLocations.afk_spots && globalLocations.afk_spots.length > 0) {
        globalLocations.afk_spots.forEach(spot => {
            html += `
            <span style="background: #2563eb; color: white; padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.2);">
                📍 ${spot.name} (${spot.x.toFixed(1)}, ${spot.y.toFixed(1)}, ${spot.z.toFixed(1)})
                <i class="fa-solid fa-xmark hover-red" style="cursor: pointer; opacity: 0.8; transition: 0.2s;" onclick="deleteLocation('${spot.id}')" title="Xoá"></i>
            </span>`;
        });
    }
    
    if (html === '') html = '<span style="color: #666; font-size: 13px;">Chưa có toạ độ nào trong kho lưu trữ.</span>';
    list.innerHTML = html;
}

async function addLocation() {
    const name = document.getElementById('locName').value.trim();
    const x = document.getElementById('locX').value;
    const y = document.getElementById('locY').value;
    const z = document.getElementById('locZ').value;
    
    if(!x || !y || !z) return alert("Vui lòng điền đủ toạ độ X, Y, Z!");
    
    await fetch(`${API_URL}/locations/afk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, x, y, z })
    });
    
    document.getElementById('locName').value = '';
    document.getElementById('locX').value = '';
    document.getElementById('locY').value = '';
    document.getElementById('locZ').value = '';
}

async function deleteLocation(id) {
    if(!confirm("Chắc chắn xoá toạ độ này?")) return;
    await fetch(`${API_URL}/locations/afk/${id}`, { method: 'DELETE' });
}

socket.on('locations_updated', (data) => {
    globalLocations = data;
    renderLocations();
    fetchAccounts(); // Render lại dropdowns của Bot Card
});

// Start fetching process
fetchLocations();
