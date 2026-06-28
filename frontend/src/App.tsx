import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal, Gamepad2, Play, Square, Pickaxe, Plus, Cpu, MapPin, Trash2, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BotAccount {
  id: string;
  username: string;
  status: string;
  mode: string;
  afkSpotId: string;
  pvpEnabled: boolean;
  autoReconnect?: boolean;
  uptimeStart?: number | null;
  uptimeOffset?: number;
}

interface LogEntry {
  id: string;
  message: string;
  type: string;
  time: string;
}

interface Location {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

export default function App() {
  const [_, setSocket] = useState<Socket | null>(null);
  const [accounts, setAccounts] = useState<BotAccount[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [newUsername, setNewUsername] = useState('');
  
  // Location form state
  const [locName, setLocName] = useState('');
  const [locX, setLocX] = useState('');
  const [locY, setLocY] = useState('');
  const [locZ, setLocZ] = useState('');

  // Server Config state
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState(25565);
  const [serverVersion, setServerVersion] = useState('');

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (startMs: number | null | undefined) => {
    if (!startMs) return '';
    const diff = now - startMs;
    if (diff < 0) return '';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  useEffect(() => {
    const s = io('/', { path: '/socket.io' });
    setSocket(s);

    s.on('bot_log', (data: any) => {
      setLogs((prev) => [...prev, { ...data, time: new Date().toLocaleTimeString('vi-VN') }]);
    });

    s.on('bot_status', () => fetchAccounts());
    s.on('bot_spawn_success', () => fetchAccounts());
    s.on('locations_updated', (data: any) => {
      setLocations(data.afk_spots || []);
      fetchAccounts();
    });

    return () => { s.disconnect(); };
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setServerHost(data.host || 'localhost');
      setServerPort(data.port || 25565);
      setServerVersion(data.version || '');
    } catch(e) {}
  };

  const saveConfig = async () => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: serverHost, port: serverPort, version: serverVersion || false })
    });
  };

  useEffect(() => {
    fetchAccounts();
    fetchLocations();
    fetchConfig();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (e) {}
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      setLocations(data.afk_spots || []);
    } catch (e) {}
  };

  const startBot = async (id: string, account: BotAccount) => {
    await fetch(`/api/bots/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: account.mode, pvp: account.pvpEnabled, afkSpotId: account.afkSpotId, autoReconnect: account.autoReconnect })
    });
    fetchAccounts();
  };

  const stopBot = async (id: string) => {
    await fetch(`/api/bots/${id}/stop`, { method: 'POST' });
    fetchAccounts();
  };

  const createAccount = async () => {
    if (!newUsername) return;
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, pass: '15112009' })
    });
    setNewUsername('');
    fetchAccounts();
  };

  const autoRank = async () => {
    await fetch('/api/accounts/autorank', { method: 'POST' });
    fetchAccounts();
  };

  const startAll = async () => {
    for (const acc of accounts) {
      if (acc.status !== 'online') {
        await startBot(acc.id, acc);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  const boostUptime = async (id: string, hours: number) => {
    await fetch(`/api/accounts/${id}/boost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours })
    });
    fetchAccounts();
  };

  const moveToTop = async (id: string) => {
    await fetch(`/api/accounts/${id}/top`, { method: 'POST' });
    fetchAccounts();
  };

  const addLocation = async () => {
    if (!locName || !locX || !locY || !locZ) return;
    await fetch('/api/locations/afk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: locName, x: parseFloat(locX), y: parseFloat(locY), z: parseFloat(locZ) })
    });
    setLocName(''); setLocX(''); setLocY(''); setLocZ('');
    fetchLocations();
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Xóa tọa độ này?')) return;
    await fetch(`/api/locations/afk/${id}`, { method: 'DELETE' });
    fetchLocations();
  };

  const updateBotLocalConfig = (id: string, field: keyof BotAccount, value: any) => {
    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, [field]: value } : acc));
  };

  const saveBotConfig = async (acc: BotAccount) => {
    await fetch(`/api/bots/${acc.id}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: acc.mode, pvp: acc.pvpEnabled, afkSpotId: acc.afkSpotId, autoReconnect: acc.autoReconnect })
    });
    fetchAccounts();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden flex flex-col p-6 gap-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1)_0%,transparent_50%)] pointer-events-none" />

      <header className="flex items-center gap-4 border-b border-white/5 pb-4 z-10">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
          <Pickaxe size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minecraft AFK Swarm</h1>
          <p className="text-sm text-zinc-400">Tactical Control Center &bull; Engine v2.0</p>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 z-10 min-h-0">
        <section className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          
          <div className="glass-panel p-4 rounded-xl flex items-end gap-3 shrink-0">
            <div className="flex-1">
              <label className="text-xs text-cyan-400 font-semibold mb-1 block">Server IP / Host</label>
              <input type="text" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none" value={serverHost} onChange={e => setServerHost(e.target.value)} />
            </div>
            <div className="w-24">
              <label className="text-xs text-cyan-400 font-semibold mb-1 block">Port</label>
              <input type="number" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none" value={serverPort} onChange={e => setServerPort(parseInt(e.target.value))} />
            </div>
            <div className="w-36">
              <label className="text-xs text-cyan-400 font-semibold mb-1 block">Version (để trống=Auto)</label>
              <input type="text" placeholder="vd: 1.20.1" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none" value={serverVersion} onChange={e => setServerVersion(e.target.value)} />
            </div>
            <button onClick={saveConfig} className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors h-[34px]">
              Lưu Cấu Hình
            </button>
          </div>
          
          {/* BOT INSTANCES */}
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Cpu size={18} className="text-emerald-400"/> Bot Instances
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={autoRank} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0">
                  👑 Auto-Rank Top 5
                </button>
                <button onClick={startAll} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0">
                  🚀 Launch Swarm
                </button>
                <input 
                  type="text" 
                  placeholder="New Bot Username"
                  className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500/50 transition-colors w-32"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <button onClick={createAccount} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors shrink-0">
                  <Plus size={16} /> Deploy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-2">
              <AnimatePresence>
                {accounts.map((acc, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={acc.id} 
                    className="glass-panel p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-lg flex items-center gap-2">
                            {acc.username}
                            <span className="relative flex h-2.5 w-2.5">
                              {acc.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${acc.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                            </span>
                          </h3>
                          {index > 0 && (
                            <button onClick={() => moveToTop(acc.id)} className="p-1 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 rounded transition-colors" title="Đưa lên Top 1">
                              <ArrowUp size={14} />
                            </button>
                          )}
                          {index === 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">TOP 1</span>}
                          {index > 0 && index < 5 && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">TOP {index + 1}</span>}
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                          ID: {acc.id} {acc.status === 'online' && acc.uptimeStart && ` • Uptime: ${formatUptime(acc.uptimeStart)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-zinc-300"
                          value={acc.mode || 'random'}
                          onChange={(e) => updateBotLocalConfig(acc.id, 'mode', e.target.value)}
                        >
                          <option value="random">🎲 Random AFK</option>
                          <option value="farm">⚔️ Auto Farm (Spawner)</option>
                        </select>
                        <div className="flex flex-col gap-1 shrink-0 justify-center min-w-[70px]">
                          <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-300">
                            <input
                              type="checkbox"
                              checked={acc.pvpEnabled}
                              onChange={(e) => updateBotLocalConfig(acc.id, 'pvpEnabled', e.target.checked)}
                              className="accent-red-500 rounded border-white/10 bg-zinc-900 w-3 h-3"
                            />
                            <span>⚔️ PvP</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-300">
                            <input
                              type="checkbox"
                              checked={acc.autoReconnect || false}
                              onChange={(e) => updateBotLocalConfig(acc.id, 'autoReconnect', e.target.checked)}
                              className="accent-emerald-500 rounded border-white/10 bg-zinc-900 w-3 h-3"
                            />
                            <span>🔄 Auto-RC</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-zinc-300"
                          value={acc.afkSpotId || ""}
                          onChange={(e) => updateBotLocalConfig(acc.id, 'afkSpotId', e.target.value)}
                        >
                          <option value="">-- Chọn Góc AFK --</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Hack (Giờ)"
                          className="w-24 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-zinc-300 focus:border-amber-500/50"
                          value={acc.uptimeOffset ? acc.uptimeOffset / 3600000 : ""}
                          onChange={(e) => boostUptime(acc.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <button
                        onClick={() => saveBotConfig(acc)}
                        className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg py-1.5 text-xs font-medium transition-colors"
                      >
                        💾 Lưu & Áp Dụng Config
                      </button>
                    </div>

                    <div className="flex gap-2 mt-auto pt-2">
                      {acc.status === 'online' ? (
                        <button onClick={() => stopBot(acc.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                          <Square size={16} fill="currentColor"/> Stop Engine
                        </button>
                      ) : (
                        <button onClick={() => startBot(acc.id, acc)} className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                          <Play size={16} fill="currentColor"/> Launch Bot
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {accounts.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-zinc-500 glass-panel rounded-xl border-dashed border border-white/10">
                  <Gamepad2 size={48} className="mb-4 opacity-20"/>
                  <p>No bots deployed yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* LOCATIONS */}
          <div className="glass-panel p-4 rounded-xl flex flex-col gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
              <MapPin size={16} /> AFK Locations Data
            </h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {locations.map(loc => (
                <div key={loc.id} className="bg-blue-500/20 border border-blue-500/30 text-blue-200 px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
                  <span>{loc.name} ({loc.x}, {loc.y}, {loc.z})</span>
                  <button onClick={() => deleteLocation(loc.id)} className="hover:text-red-400"><Trash2 size={12}/></button>
                </div>
              ))}
              {locations.length === 0 && <span className="text-zinc-500 text-xs italic">Chưa có toạ độ nào.</span>}
            </div>
            
            <div className="flex gap-2">
              <input type="text" placeholder="Tên bãi (vd: Bãi Cà Rốt)" className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-cyan-500/50" value={locName} onChange={e => setLocName(e.target.value)} />
              <input type="number" placeholder="X" className="w-16 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none" value={locX} onChange={e => setLocX(e.target.value)} />
              <input type="number" placeholder="Y" className="w-16 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none" value={locY} onChange={e => setLocY(e.target.value)} />
              <input type="number" placeholder="Z" className="w-16 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none" value={locZ} onChange={e => setLocZ(e.target.value)} />
              <button onClick={addLocation} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 px-3 rounded-lg text-xs font-medium transition-colors">Add</button>
            </div>
          </div>
        </section>

        <section className="flex flex-col min-h-0 glass-panel rounded-xl overflow-hidden">
          <div className="bg-zinc-900 border-b border-white/5 p-3 flex items-center gap-2">
            <Terminal size={18} className="text-cyan-400" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-300">TACTICAL CONSOLE</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 text-sm font-mono text-zinc-300">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 leading-relaxed">
                <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-cyan-200'}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
            {logs.length === 0 && <p className="text-zinc-600 text-center mt-10 italic">Awaiting telemetry...</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
