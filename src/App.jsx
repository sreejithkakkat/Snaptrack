import { useState, useEffect, useRef } from "react";

// ── utils ──────────────────────────────────────────────────────────────────────
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const pad = n => String(n).padStart(2, "0");
const hms = s => { s = Math.max(0, Math.floor(s)); return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`; };
const shortT = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h?`${h}h ${m}m`:m?`${m}m`:s>0?`${s}s`:"—"; };

const COLORS = [
  { pill:"#dce8db", dot:"#4a7a50", text:"#2d4a30" },
  { pill:"#d8e2f0", dot:"#4a6490", text:"#2d3e60" },
  { pill:"#f0dbd8", dot:"#c46048", text:"#803830" },
  { pill:"#f0e8d8", dot:"#c4904a", text:"#805830" },
  { pill:"#e4daf0", dot:"#8a5ca8", text:"#5a3a78" },
  { pill:"#d8ecec", dot:"#4a8a8a", text:"#2d5858" },
  { pill:"#f0ece0", dot:"#a08040", text:"#705828" },
  { pill:"#ecdce8", dot:"#a04878", text:"#702858" },
];
const getColor = t => COLORS[(t.colorIdx ?? 0) % COLORS.length];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS  = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

const parseTimeInput = (str) => {
  str = str.trim();
  const hmsMatch = str.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hmsMatch) return parseInt(hmsMatch[1])*3600 + parseInt(hmsMatch[2])*60 + parseInt(hmsMatch[3]);
  const ms = str.match(/^(\d+):(\d{1,2})$/);
  if (ms) return parseInt(ms[1])*60 + parseInt(ms[2]);
  const n = parseFloat(str);
  if (!isNaN(n)) return Math.round(n * 60);
  return null;
};

// ── storage (Electron IPC via window.tempo) ───────────────────────────────────
const dbGet = async (k) => {
  try { return await window.tempo.getDayData(k); } catch { return null; }
};
const dbSet = async (k, v) => {
  try { await window.tempo.saveDayData(k, v); } catch {}
};
const dbList = async (p) => {
  try { return await window.tempo.listDays(p); } catch { return []; }
};

// ── design tokens ──────────────────────────────────────────────────────────────
const BG="#eae6de", SBG="#dedad0", WH="#ffffff", S2="#f4f1ea";
const GRN="#3d5941", GRNL="#d4e2d5";
const T1="#1a1a18", T2="#5c5c54", T3="#9a9a92", BD="#d8d4c8";

// ── small reusable components ──────────────────────────────────────────────────
function Dot({ color, pulse=false }) {
  return (
    <div style={{
      width:8, height:8, borderRadius:"50%", background:color,
      flexShrink:0, animation: pulse ? "pu 2.2s ease infinite" : "none"
    }} />
  );
}

function IcoDash() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"/>
    <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5"/>
    <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5"/>
    <rect x="9" y="9" width="5.5" height="5.5" rx="1.5"/>
  </svg>;
}
function IcoCal() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="3" width="12" height="11" rx="2"/>
    <line x1="2" y1="7" x2="14" y2="7"/>
    <line x1="5.5" y1="1.5" x2="5.5" y2="4.5"/>
    <line x1="10.5" y1="1.5" x2="10.5" y2="4.5"/>
  </svg>;
}

// ── inline time editor ─────────────────────────────────────────────────────────
function EditableTime({ seconds, onSave, style: outerStyle }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const inputRef = useRef(null);

  const startEdit = () => {
    setVal(hms(seconds));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const parsed = parseTimeInput(val);
    if (parsed !== null) onSave(parsed);
    setEditing(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        style={{ fontFamily:"'JetBrains Mono',monospace", fontSize: outerStyle?.fontSize || 12, width:80, background:S2, border:`1px solid ${BD}`, borderRadius:6, padding:"2px 6px", outline:"none", color:T1, ...outerStyle }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      style={{ cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", ...outerStyle }}
      title="Click to edit time"
    >
      {hms(seconds)}
    </span>
  );
}

// ── CtrlBtn ─────────────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width:44, height:44, borderRadius:"50%", border:`1.5px solid ${BD}`, background: hov ? S2 : "transparent", cursor:"pointer", color: hov ? T1 : T2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
      {children}
    </button>
  );
}

// ── MultiDatePicker ────────────────────────────────────────────────────────────
function MultiDatePicker({ selected, onToggle, month, onMonthChange, onConfirm, onClose, taskName }) {
  const { y, m } = month;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInM  = new Date(y, m + 1, 0).getDate();
  const cells    = [...Array(firstDay).fill(null), ...Array.from({ length: daysInM }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevM = () => onMonthChange(m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 });
  const nextM = () => onMonthChange(m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 });
  const today = todayStr();

  return (
    <div style={{ position:"absolute", top:"100%", right:0, marginTop:6, width:280, background:WH, border:`1px solid ${BD}`, borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:100, padding:14, fontFamily:"'Inter',sans-serif" }}
      onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prevM} style={{ width:24, height:24, borderRadius:6, border:`1px solid ${BD}`, background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2 }}>
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 2L3.5 5l3 3"/></svg>
        </button>
        <span style={{ fontSize:13, fontWeight:600, color:T1 }}>{MONTHS[m]} {y}</span>
        <button onClick={nextM} style={{ width:24, height:24, borderRadius:6, border:`1px solid ${BD}`, background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2 }}>
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3.5 2l3 3-3 3"/></svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:4 }}>
        {["S","M","T","W","T","F","S"].map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:600, color:T3, padding:"2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((dayNum, i) => {
          if (!dayNum) return <div key={i} style={{ width:34, height:30 }} />;
          const ds = `${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
          const isSel = selected.includes(ds);
          const isToday = ds === today;
          return (
            <button key={i} onClick={() => onToggle(ds)}
              style={{
                width:34, height:30, borderRadius:8, border:"none",
                background: isSel ? GRN : "transparent",
                color: isSel ? "#fff" : isToday ? GRN : T1,
                fontWeight: isSel || isToday ? 700 : 400,
                fontSize:12, cursor:"pointer", position:"relative",
                transition:"all 0.12s",
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = GRNL; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              {dayNum}
              {isSel && (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ position:"absolute", bottom:1, right:3 }}>
                  <path d="M2 5l2.5 2.5L8 3"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, paddingTop:10, borderTop:`1px solid ${BD}` }}>
        <span style={{ fontSize:12, color:T2 }}>{selected.length} day{selected.length !== 1 ? "s" : ""} selected</span>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onClose}
            style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${BD}`, borderRadius:8, color:T2, fontSize:12, cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(taskName, selected)} disabled={!selected.length || !taskName?.trim()}
            style={{ padding:"6px 12px", background: selected.length && taskName?.trim() ? GRN : S2, border:"none", borderRadius:8, color: selected.length && taskName?.trim() ? "#fff" : T3, fontSize:12, fontWeight:600, cursor: selected.length && taskName?.trim() ? "pointer" : "default" }}>
            Add to {selected.length} day{selected.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [day, setDay]     = useState({ tasks:[], phase:"planning", activeTask:null, sessionStart:null, isAway:false, awayStart:null });
  const [ready, setReady] = useState(false);
  const [tick,  setTick]  = useState(0);
  const [nav,   setNav]   = useState("home");
  const [confirmReset, setConfirmReset] = useState(false);

  // calendar
  const [calData, setCalData] = useState({});
  const [calY,    setCalY]    = useState(new Date().getFullYear());
  const [calM,    setCalM]    = useState(new Date().getMonth());
  const [selD,    setSelD]    = useState(null);

  // home view local state
  const [taskIn, setTaskIn] = useState("");
  const [editId, setEditId] = useState(null);
  const [editV,  setEditV]  = useState("");
  const taskInputRef = useRef(null);

  // date strip window offset (in weeks from selectedDate-centered)
  const [dateStripOffset, setDateStripOffset] = useState(0);

  // multi-date picker state
  const [showMultiDate, setShowMultiDate] = useState(false);
  const [multiDates, setMultiDates] = useState([]);
  const [mdMonth, setMdMonth] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });

  // group totals cache
  const [groupTotals, setGroupTotals] = useState({});

  // load fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // initial load
  useEffect(() => {
    (async () => {
      const saved = await dbGet(`day:${todayStr()}`);
      if (saved) setDay(saved);
      setReady(true);
    })();
  }, []);

  // load data when selectedDate changes
  useEffect(() => {
    (async () => {
      const saved = await dbGet(`day:${selectedDate}`);
      setDay(saved || { tasks:[], phase:"planning", activeTask:null, sessionStart:null, isAway:false, awayStart:null });
    })();
  }, [selectedDate]);

  // listen for state updates from Electron
  useEffect(() => {
    const unsub = window.tempo.onStateUpdate((data) => {
      if (data && data.tasks && selectedDate === todayStr()) {
        setDay(data);
      }
    });
    return () => { if (unsub) unsub(); };
  }, [selectedDate]);

  // tick every second for live timer
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── day persistence ────────────────────────────────────────────────────────
  const persist = (next) => {
    setDay(next);
    dbSet(`day:${selectedDate}`, next);
  };

  // ── time helpers ───────────────────────────────────────────────────────────
  const getLive = (task, d) => {
    const snap = d || day;
    // Only count live time if viewing today
    if (selectedDate === todayStr() && !snap.isAway && snap.activeTask === task.id && snap.sessionStart) {
      return task.seconds + Math.floor((Date.now() - snap.sessionStart) / 1000);
    }
    return task.seconds;
  };

  const flushActive = (d) => {
    if (!d.activeTask || !d.sessionStart) return d.tasks;
    // Only flush live time if we're on today
    if (selectedDate !== todayStr()) return d.tasks;
    const el = Math.floor((Date.now() - d.sessionStart) / 1000);
    return d.tasks.map(t => t.id === d.activeTask ? { ...t, seconds: t.seconds + el } : t);
  };

  // ── actions ────────────────────────────────────────────────────────────────
  const addTask = (name) => {
    if (!name || !name.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      name: name.trim(),
      seconds: 0,
      colorIdx: day.tasks.length % COLORS.length,
    };
    persist({ ...day, tasks: [...day.tasks, newTask] });
  };

  const editTask = (id, name) => {
    if (!name || !name.trim()) return;
    persist({ ...day, tasks: day.tasks.map(t => t.id === id ? { ...t, name: name.trim() } : t) });
  };

  const deleteTask = (id) => {
    const flushed = flushActive(day);
    const wasActive = day.activeTask === id;
    persist({
      ...day,
      tasks: flushed.filter(t => t.id !== id),
      activeTask:   wasActive ? null : day.activeTask,
      sessionStart: wasActive ? null : day.sessionStart,
    });
  };

  const startWork = () => {
    if (selectedDate !== todayStr()) return;
    if (!day.tasks.length) return;
    const first = day.tasks[0];
    persist({ ...day, phase:"working", activeTask:first.id, sessionStart:Date.now(), tasks: day.tasks.map(t => t.id === first.id ? { ...t, switches: (t.switches || 0) + 1 } : t) });
  };

  const switchTask = (id) => {
    if (selectedDate !== todayStr()) return;
    if (day.isAway) { imBack(); }
    const now = Date.now();
    const flushed = flushActive(day);
    const alreadyActive = day.activeTask === id;
    persist({
      ...day,
      tasks:        flushed.map(t => t.id === id && !alreadyActive ? { ...t, switches: (t.switches || 0) + 1 } : t),
      activeTask:   alreadyActive ? null : id,
      sessionStart: alreadyActive ? null : now,
    });
  };

  const pauseResume = () => {
    if (selectedDate !== todayStr()) return;
    if (day.isAway) { imBack(); return; }
    const now = Date.now();
    if (day.activeTask && day.sessionStart) {
      persist({ ...day, tasks: flushActive(day), sessionStart: null });
    } else if (day.activeTask) {
      persist({ ...day, sessionStart: now });
    } else if (day.tasks.length) {
      persist({ ...day, activeTask: day.tasks[0].id, sessionStart: now });
    }
  };

  const skipTask = () => {
    if (selectedDate !== todayStr()) return;
    if (!day.tasks.length) return;
    const idx  = day.tasks.findIndex(t => t.id === day.activeTask);
    const next = day.tasks[(idx + 1) % day.tasks.length];
    persist({ ...day, tasks: flushActive(day).map(t => t.id === next.id ? { ...t, switches: (t.switches || 0) + 1 } : t), activeTask: next.id, sessionStart: Date.now() });
  };

  const resetTask = () => {
    if (selectedDate !== todayStr()) return;
    if (!day.activeTask) return;
    const running = !!(day.activeTask && day.sessionStart && !day.isAway);
    persist({ ...day, tasks: day.tasks.map(t => t.id === day.activeTask ? { ...t, seconds:0 } : t), sessionStart: running ? Date.now() : null });
    setConfirmReset(false);
  };

  const goAway = () => {
    if (selectedDate !== todayStr()) return;
    persist({ ...day, tasks: flushActive(day), sessionStart: null, isAway: true, awayStart: Date.now() });
  };

  const imBack = () => {
    if (selectedDate !== todayStr()) return;
    persist({ ...day, isAway: false, awayStart: null, sessionStart: day.activeTask ? Date.now() : null });
  };

  const wrapUpDay = () => {
    if (selectedDate !== todayStr()) return;
    persist({
      ...day,
      tasks: flushActive(day),
      phase: "wrapped",
      activeTask: null,
      sessionStart: null,
      isAway: false,
      awayStart: null,
    });
  };

  const resumeWork = () => {
    if (selectedDate !== todayStr()) return;
    persist({ ...day, phase: "working" });
  };

  const editTaskTime = (id, newSeconds) => {
    const wasRunning = day.activeTask === id && day.sessionStart && !day.isAway;
    persist({
      ...day,
      tasks: flushActive(day).map(t => t.id === id ? { ...t, seconds: Math.max(0, newSeconds) } : t),
      sessionStart: wasRunning ? Date.now() : day.sessionStart,
    });
  };

  const addTaskToDay = async (dateStr, name) => {
    if (!name || !name.trim()) return;
    const key = `day:${dateStr}`;
    const existing = await dbGet(key) || { tasks:[], phase:"planning", activeTask:null, sessionStart:null, isAway:false, awayStart:null };
    const newTask = { id: Date.now().toString(), name: name.trim(), seconds: 0, colorIdx: existing.tasks.length % COLORS.length };
    const updated = { ...existing, tasks: [...existing.tasks, newTask] };
    await dbSet(key, updated);
    setCalData(prev => ({ ...prev, [dateStr]: updated }));
    if (dateStr === todayStr()) setDay(updated);
  };

  const deleteTaskFromDay = async (dateStr, taskId) => {
    const key = `day:${dateStr}`;
    const existing = await dbGet(key);
    if (!existing) return;
    const updated = { ...existing, tasks: existing.tasks.filter(t => t.id !== taskId) };
    await dbSet(key, updated);
    setCalData(prev => ({ ...prev, [dateStr]: updated }));
    if (dateStr === todayStr()) setDay(updated);
  };

  const addTaskToMultipleDates = async (name, dates) => {
    if (!name?.trim() || !dates.length) return;
    const groupId = dates.length > 1 ? `grp_${Date.now()}` : null;
    for (const dateStr of dates) {
      const result = await window.tempo.addTaskToDate(dateStr, name.trim(), groupId);
      if (dateStr === selectedDate && result) setDay(result);
    }
    setShowMultiDate(false);
    setMultiDates([]);
    setTaskIn("");
    if (groupId) refreshGroupTotals();
  };

  const refreshGroupTotals = async () => {
    const ids = new Set();
    day.tasks.forEach(t => { if (t.groupId) ids.add(t.groupId); });
    if (ids.size === 0) return;
    const totals = {};
    for (const gid of ids) {
      try {
        const r = await window.tempo.getGroupTotal(gid);
        if (r) totals[gid] = r;
      } catch {}
    }
    setGroupTotals(totals);
  };

  // refresh group totals when day data changes
  useEffect(() => {
    refreshGroupTotals();
  }, [selectedDate, day.tasks.length]);

  const openCalendar = async () => {
    const keys = await dbList("day:");
    const res  = {};
    for (const k of keys) {
      const d = await dbGet(k);
      if (d) res[k.replace("day:", "")] = d;
    }
    res[todayStr()] = day;
    setCalData(res);
    setNav("calendar");
  };

  const prevMonth = () => {
    if (calM === 0) { setCalM(11); setCalY(y => y - 1); } else { setCalM(m => m - 1); }
    setSelD(null);
  };
  const nextMonth = () => {
    if (calM === 11) { setCalM(0); setCalY(y => y + 1); } else { setCalM(m => m + 1); }
    setSelD(null);
  };
  const goToday = () => {
    setCalY(new Date().getFullYear());
    setCalM(new Date().getMonth());
    setSelD(todayStr());
  };

  // ── home view handlers ─────────────────────────────────────────────────────
  const handleAdd = () => {
    const val = taskIn.trim();
    if (!val) return;
    addTask(val);
    setTaskIn("");
    taskInputRef.current?.focus();
  };

  const handleEditSave = () => {
    if (editV.trim()) editTask(editId, editV);
    setEditId(null);
    setEditV("");
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const activeTask = day.tasks.find(t => t.id === day.activeTask) ?? null;
  const isRunning  = !!(day.activeTask && day.sessionStart && !day.isAway);
  const total      = day.tasks.reduce((s, t) => s + getLive(t, day), 0);
  const awaySecs   = day.isAway && day.awayStart ? Math.floor((Date.now() - day.awayStart) / 1000) : 0;
  const h          = new Date().getHours();
  const greeting   = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const activeSecs = activeTask ? getLive(activeTask, day) : 0;
  const isViewingToday = selectedDate === todayStr();

  // ── date strip helpers ─────────────────────────────────────────────────────
  const getDateStripDays = () => {
    const center = new Date(selectedDate + "T12:00:00");
    const offsetMs = dateStripOffset * 7 * 24 * 60 * 60 * 1000;
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(center.getTime() + offsetMs + i * 24 * 60 * 60 * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      days.push({
        dateStr: `${y}-${m}-${day}`,
        dayOfWeek: dayNames[d.getDay()],
        dayNum: d.getDate(),
      });
    }
    return days;
  };

  const stripDays = getDateStripDays();

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:BG, fontFamily:"'Inter',sans-serif", color:T1 }}>
      <style>{`
        @keyframes pu { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.75)} }
        @keyframes fu { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fi { from{opacity:0} to{opacity:1} }
        * { box-sizing:border-box; }
        input { font-family:'Inter',sans-serif; }
        input::placeholder { color:${T3}; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:${BD}; border-radius:3px; }
        .nb:hover { background:${GRNL} !important; color:${GRN} !important; }
        .nbActive { background:${GRNL}; color:${GRN}; font-weight:600; }
        .task-card:hover .task-actions { opacity: 1 !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width:220, background:SBG, borderRight:`1px solid ${BD}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
        {/* logo */}
        <div style={{ padding:"28px 20px 24px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:GRN, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="white" strokeWidth="1.5"/>
              <path d="M9 9V6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 9l2.8 1.6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:18, color:T1, letterSpacing:"-0.3px" }}>SnapTrack</div>
          </div>
        </div>

        {/* nav */}
        <nav style={{ flex:1, padding:"0 12px" }}>
          {[
            { id:"home", label:"Home", icon:<IcoDash />,  action: () => setNav("home") },
            { id:"calendar",  label:"Calendar",  icon:<IcoCal />,   action: openCalendar },
          ].map(item => (
            <button
              key={item.id}
              className={nav === item.id ? "nbActive" : "nb"}
              onClick={item.action}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, border:"none", background: nav===item.id ? GRNL : "transparent", color: nav===item.id ? GRN : T2, fontSize:14, fontWeight: nav===item.id ? 600 : 400, cursor:"pointer", marginBottom:2, transition:"all 0.15s", textAlign:"left" }}>
              <span style={{ opacity: nav===item.id ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {!ready && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:GRN, animation:"pu 1.2s ease infinite" }} />
          </div>
        )}

        {ready && nav === "home" && (
          <div style={{ padding:"36px 44px", flex:1, animation:"fu 0.3s ease" }}>
            {/* ── 1. Header row with date picker ── */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
              <div>
                <h1 style={{ fontSize:26, fontWeight:700, margin:0, marginBottom:6, letterSpacing:"-0.6px" }}>
                  {greeting}
                </h1>
                <p style={{ margin:0, fontSize:14, color:T3 }}>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}
                  {!isViewingToday && (
                    <span style={{ marginLeft:8, fontSize:12, color:GRN, fontWeight:600, cursor:"pointer" }} onClick={() => { setSelectedDate(todayStr()); setDateStripOffset(0); }}>
                      Back to today
                    </span>
                  )}
                </p>
              </div>

              {/* Date strip */}
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <button
                  onClick={() => setDateStripOffset(o => o - 1)}
                  style={{ width:28, height:36, borderRadius:8, border:`1px solid ${BD}`, background:WH, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2, transition:"background 0.15s", flexShrink:0 }}
                  onMouseEnter={e => e.currentTarget.style.background=GRNL}
                  onMouseLeave={e => e.currentTarget.style.background=WH}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 2L3.5 5l3 3"/></svg>
                </button>
                {stripDays.map(sd => {
                  const isSel = sd.dateStr === selectedDate;
                  const isToday = sd.dateStr === todayStr();
                  return (
                    <button
                      key={sd.dateStr}
                      onClick={() => { setSelectedDate(sd.dateStr); setDateStripOffset(0); }}
                      style={{
                        width:44, height:36, borderRadius:10, border: isSel ? "none" : `1px solid ${BD}`,
                        background: isSel ? GRN : WH,
                        color: isSel ? "#fff" : T2,
                        fontWeight: isSel ? 700 : 400,
                        fontSize:10, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        gap:1, transition:"all 0.15s", position:"relative", flexShrink:0, padding:0,
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background=GRNL; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background=WH; }}
                    >
                      <span style={{ fontSize:9, fontWeight:500, lineHeight:1, letterSpacing:"0.02em" }}>{sd.dayOfWeek}</span>
                      <span style={{ fontSize:12, fontWeight: isSel ? 700 : 500, lineHeight:1 }}>{sd.dayNum}</span>
                      {isToday && !isSel && (
                        <div style={{ position:"absolute", bottom:2, width:4, height:4, borderRadius:"50%", background:GRN }} />
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => setDateStripOffset(o => o + 1)}
                  style={{ width:28, height:36, borderRadius:8, border:`1px solid ${BD}`, background:WH, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2, transition:"background 0.15s", flexShrink:0 }}
                  onMouseEnter={e => e.currentTarget.style.background=GRNL}
                  onMouseLeave={e => e.currentTarget.style.background=WH}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3.5 2l3 3-3 3"/></svg>
                </button>
              </div>
            </div>

            {/* ── Working / Wrapped phase layout ── */}
            {(day.phase === "working" || day.phase === "wrapped") && (<>
              {/* Top row: Timer block + stat cards */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, marginBottom:20 }}>
                {/* Timer block */}
                <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:18, padding:"32px 36px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:220 }}>
                  {day.phase === "wrapped" ? (
                    <>
                      <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke={GRN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:12 }}>
                        <path d="M4 10l4 4 8-9"/>
                      </svg>
                      <div style={{ fontSize:18, fontWeight:700, color:GRN, marginBottom:6 }}>Day Complete</div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:42, fontWeight:700, color:T1, letterSpacing:"-2px", marginBottom:16 }}>{hms(total)}</div>
                      <button onClick={resumeWork}
                        style={{ padding:"10px 24px", background:GRN, border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", boxShadow:"0 4px 14px rgba(61,89,65,0.28)" }}
                        onMouseEnter={e => e.currentTarget.style.opacity="0.88"}
                        onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                        Resume Working
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Active task name */}
                      <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", color:T3, marginBottom:12, textTransform:"uppercase", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {activeTask ? activeTask.name : "No active task"}
                      </div>

                      {/* Big timer */}
                      {day.isAway ? (
                        <div style={{ fontSize:18, fontWeight:700, color:"#f59e0b", background:"#fef3c7", padding:"8px 20px", borderRadius:10, marginBottom:20 }}>Away</div>
                      ) : (
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:56, fontWeight:700, color: isRunning ? T1 : T3, letterSpacing:"-3px", lineHeight:1, marginBottom:24 }}>
                          {(() => { const parts = hms(activeSecs).split(":"); return <>{parts[0]}<span style={{ color:T3, margin:"0 4px" }}>:</span>{parts[1]}<span style={{ color:T3, margin:"0 4px" }}>:</span>{parts[2]}</>; })()}
                        </div>
                      )}

                      {/* Controls row */}
                      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                        {day.isAway ? (
                          <button onClick={imBack}
                            style={{ padding:"12px 32px", background:"#f59e0b", border:"none", borderRadius:14, color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", boxShadow:"0 6px 20px rgba(245,158,11,0.4)", display:"flex", alignItems:"center", gap:8, transition:"transform 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.transform="scale(1.04)"}
                            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M8 3l5 5-5 5"/></svg>
                            I'm Back
                          </button>
                        ) : (
                          <>
                            <button onClick={goAway}
                              style={{ height:48, padding:"0 24px", borderRadius:14, background:"#fef3c7", border:"2px solid #f59e0b", color:"#b45309", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s", boxShadow:"0 2px 8px rgba(245,158,11,0.15)" }}
                              onMouseEnter={e => { e.currentTarget.style.background="#fde68a"; e.currentTarget.style.boxShadow="0 4px 16px rgba(245,158,11,0.3)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background="#fef3c7"; e.currentTarget.style.boxShadow="0 2px 8px rgba(245,158,11,0.15)"; }}>
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round">
                                <circle cx="9" cy="9" r="7"/><path d="M9 5.5v3.5l2.5 1.5"/>
                              </svg>
                              Take a Break
                            </button>
                            <CtrlBtn onClick={skipTask}>
                              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 4.5l7 4.5-7 4.5V4.5z"/><line x1="14" y1="4.5" x2="14" y2="13.5"/>
                              </svg>
                            </CtrlBtn>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right stat cards */}
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Active card */}
                  <div style={{ background:GRN, borderRadius:18, padding:"20px 22px", flex:1, position:"relative", overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3.5L11 5l-2.8 2.3.9 3.7L6 9l-3.1 2 .9-3.7L1 5l3.5-.5z" fill="#fbbf24"/></svg>
                      <span style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)" }}>Active</span>
                    </div>
                    <div style={{ fontSize:36, fontWeight:700, color:"#fff" }}>{day.tasks.filter(t => getLive(t, day) > 0).length}</div>
                  </div>
                  {/* Hours card */}
                  <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:18, padding:"20px 22px", flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3.5L11 5l-2.8 2.3.9 3.7L6 9l-3.1 2 .9-3.7L1 5l3.5-.5z" fill={T3}/></svg>
                      <span style={{ fontSize:11, fontWeight:600, color:T3 }}>Hours</span>
                    </div>
                    <div style={{ fontSize:36, fontWeight:700, color:T1 }}>{(Math.round(total / 360) / 10).toFixed(1)}</div>
                  </div>
                  {/* Wrap Up button */}
                  {day.phase === "working" && (
                    <button onClick={wrapUpDay}
                      style={{ width:"100%", padding:"14px", background:WH, border:`1px solid ${BD}`, borderRadius:14, color:T2, fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background=GRNL; e.currentTarget.style.color=GRN; }}
                      onMouseLeave={e => { e.currentTarget.style.background=WH; e.currentTarget.style.color=T2; }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7l3 3 5-6"/></svg>
                      Wrap Up Day
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row: Current Sprint + Daily Flow */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20 }}>
                {/* Current Sprint block */}
                <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:18, padding:"22px 24px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:T1 }}>Current Sprint</span>
                    <span style={{ fontSize:11, fontWeight:600, color:T3, background:S2, borderRadius:8, padding:"4px 10px", letterSpacing:"0.04em" }}>EST. {shortT(total).toUpperCase()}</span>
                  </div>

                  {/* Task pills */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
                    {day.tasks.map(task => {
                      const c = getColor(task);
                      const isActive = day.activeTask === task.id;
                      return (
                        <button key={task.id}
                          onClick={() => { if (isViewingToday && day.phase === "working") switchTask(task.id); }}
                          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:20, border: isActive ? `2px solid ${c.dot}` : `1px solid ${BD}`, background: isActive ? c.pill : WH, cursor: (isViewingToday && day.phase === "working") ? "pointer" : "default", fontSize:13, fontWeight: isActive ? 600 : 400, color: isActive ? c.text : T2, transition:"all 0.15s" }}>
                          <div style={{ width:7, height:7, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
                          {task.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div style={{ height:1, background:BD, marginBottom:16 }} />

                  {/* Task progress rows */}
                  {day.tasks.map(task => {
                    const c = getColor(task);
                    const secs = getLive(task, day);
                    const pct = total > 0 ? (secs / total) * 100 : 0;
                    const isActive = day.activeTask === task.id;

                    return (
                      <div key={task.id} className="task-card" style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <div style={{ width:7, height:7, borderRadius:"50%", background:c.dot, flexShrink:0, animation: isActive && isRunning ? "pu 2.2s ease infinite" : "none" }} />
                          <span style={{ fontSize:13, fontWeight: isActive ? 600 : 400, color:T1, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</span>
                          <span style={{ fontSize:11, color:T3, flexShrink:0 }}>{Math.round(pct)}%</span>
                          <div className="editable-time-zone" onClick={e => e.stopPropagation()}>
                            <EditableTime seconds={secs} onSave={(s) => editTaskTime(task.id, s)} style={{ fontSize:12, color: isActive ? GRN : T3, fontWeight: isActive ? 600 : 400 }} />
                          </div>
                          {/* Edit/delete */}
                          <div className="task-actions" style={{ display:"flex", gap:3, opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>
                            <button className="task-action-btn" onClick={() => { setEditId(task.id); setEditV(task.name); }}
                              style={{ width:24, height:24, background:"transparent", border:`1px solid ${BD}`, borderRadius:6, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor=T2; e.currentTarget.style.color=T1; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                              <svg width="9" height="9" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 1l2 2-5.5 5.5H2.5V7L8 1z"/></svg>
                            </button>
                            <button className="task-action-btn" onClick={() => deleteTask(task.id)}
                              style={{ width:24, height:24, background:"transparent", border:`1px solid ${BD}`, borderRadius:6, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                              <svg width="9" height="9" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l9 9M10 1L1 10"/></svg>
                            </button>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height:5, background:S2, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:c.dot, borderRadius:3, transition:"width 0.8s ease" }} />
                        </div>
                        {/* Group total */}
                        {task.groupId && groupTotals[task.groupId] && groupTotals[task.groupId].dayCount > 1 && (
                          <div style={{ fontSize:10, color:T3, marginTop:4, display:"flex", alignItems:"center", gap:4 }}>
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5"/><line x1="1.5" y1="5.5" x2="10.5" y2="5.5"/></svg>
                            <span>Total across {groupTotals[task.groupId].dayCount} days: {shortT(groupTotals[task.groupId].totalSeconds)}</span>
                          </div>
                        )}
                        {/* Inline edit */}
                        {editId === task.id && (
                          <div style={{ marginTop:6 }}>
                            <input autoFocus value={editV} onChange={e => setEditV(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditId(null); }}
                              onBlur={handleEditSave}
                              style={{ width:"100%", background:S2, border:`1px solid ${BD}`, borderRadius:8, padding:"6px 10px", outline:"none", color:T1, fontSize:13 }} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add task input */}
                  <div style={{ display:"flex", gap:8, marginTop:6, position:"relative" }}>
                    <input ref={taskInputRef} placeholder="Add a task..." value={taskIn}
                      onChange={e => setTaskIn(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                      style={{ flex:1, background:S2, border:`1px solid ${BD}`, borderRadius:10, padding:"10px 14px", outline:"none", color:T1, fontSize:13 }} />
                    <button onClick={handleAdd}
                      style={{ width:36, height:36, background:GRN, border:"none", borderRadius:10, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:20, lineHeight:1 }}
                      onMouseEnter={e => e.currentTarget.style.opacity="0.85"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>+</button>
                    <button onClick={() => { setShowMultiDate(!showMultiDate); setMultiDates([selectedDate]); setMdMonth({ y: new Date().getFullYear(), m: new Date().getMonth() }); }}
                      title="Add to multiple days"
                      style={{ width:36, height:36, background:"transparent", border:`1px solid ${BD}`, borderRadius:10, color: showMultiDate ? GRN : T2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor=GRN; e.currentTarget.style.color=GRN; }}
                      onMouseLeave={e => { if (!showMultiDate) { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T2; } }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5.5" y1="1.5" x2="5.5" y2="4.5"/><line x1="10.5" y1="1.5" x2="10.5" y2="4.5"/></svg>
                    </button>
                    {showMultiDate && (
                      <MultiDatePicker selected={multiDates}
                        onToggle={(ds) => setMultiDates(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds])}
                        month={mdMonth} onMonthChange={setMdMonth}
                        onConfirm={addTaskToMultipleDates}
                        onClose={() => { setShowMultiDate(false); setMultiDates([]); }}
                        taskName={taskIn} />
                    )}
                  </div>
                </div>

                {/* Daily Flow block */}
                <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:18, padding:"22px 22px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:T1 }}>Daily Flow</span>
                    <span style={{ fontSize:11, color:T3 }}>{day.tasks.reduce((s, t) => s + (t.switches || 0), 0)} switches</span>
                  </div>
                  {day.tasks.map(task => {
                    const c = getColor(task);
                    const isActive = day.activeTask === task.id;
                    const secs = getLive(task, day);
                    const sw = task.switches || 0;
                    return (
                      <div key={task.id}
                        onClick={() => { if (isViewingToday && day.phase === "working") switchTask(task.id); }}
                        style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:12, marginBottom:6, cursor: (isViewingToday && day.phase === "working") ? "pointer" : "default", background: isActive ? `${c.pill}60` : "transparent", transition:"all 0.15s" }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = S2; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:c.dot, flexShrink:0, marginTop:5, animation: isActive && isRunning ? "pu 2.2s ease infinite" : "none" }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight: isActive ? 600 : 400, color:T1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</div>
                          <div style={{ fontSize:11, color:T3, marginTop:2, display:"flex", alignItems:"center", gap:6 }}>
                            {isActive && <span style={{ color:c.text, fontWeight:600 }}>Active</span>}
                            {isActive && <span>·</span>}
                            <span>{shortT(secs)} tracked</span>
                            {sw > 0 && <span>·</span>}
                            {sw > 0 && (
                              <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2 4h8M6 4l2.5-2.5M2 8h8M6 8l-2.5 2.5"/></svg>
                                {sw}x
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>)}

            {/* ── Planning phase layout ── */}
            {day.phase === "planning" && (
              <div style={{ maxWidth:600 }}>
                {/* Add task input */}
                <div style={{ display:"flex", gap:10, background:WH, border:`1px solid ${BD}`, borderRadius:12, padding:"12px 16px", marginBottom:16, position:"relative" }}>
                  <input ref={taskInputRef} placeholder="Add a task..." value={taskIn}
                    onChange={e => setTaskIn(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", color:T1, fontSize:14 }} />
                  <button onClick={handleAdd}
                    style={{ width:34, height:34, background:GRN, border:"none", borderRadius:9, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22, lineHeight:1 }}
                    onMouseEnter={e => e.currentTarget.style.opacity="0.85"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>+</button>
                  <button onClick={() => { setShowMultiDate(!showMultiDate); setMultiDates([selectedDate]); setMdMonth({ y: new Date().getFullYear(), m: new Date().getMonth() }); }}
                    title="Add to multiple days"
                    style={{ width:34, height:34, background:"transparent", border:`1px solid ${BD}`, borderRadius:9, color: showMultiDate ? GRN : T2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=GRN; e.currentTarget.style.color=GRN; }}
                    onMouseLeave={e => { if (!showMultiDate) { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T2; } }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="2"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5.5" y1="1.5" x2="5.5" y2="4.5"/><line x1="10.5" y1="1.5" x2="10.5" y2="4.5"/></svg>
                  </button>
                  {showMultiDate && (
                    <MultiDatePicker selected={multiDates}
                      onToggle={(ds) => setMultiDates(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds])}
                      month={mdMonth} onMonthChange={setMdMonth}
                      onConfirm={addTaskToMultipleDates}
                      onClose={() => { setShowMultiDate(false); setMultiDates([]); }}
                      taskName={taskIn} />
                  )}
                </div>

                {/* Empty state */}
                {day.tasks.length === 0 && (
                  <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:16, padding:"48px 24px", textAlign:"center" }}>
                    <div style={{ fontSize:15, fontWeight:500, color:T2, marginBottom:4 }}>No tasks yet</div>
                    <div style={{ fontSize:13, color:T3 }}>Type a task above and press Enter or +</div>
                  </div>
                )}

                {/* Task cards (planning) */}
                {day.tasks.map(task => {
                  const c = getColor(task);
                  const secs = getLive(task, day);
                  const isEdit = editId === task.id;
                  return (
                    <div key={task.id} className="task-card"
                      style={{ background:WH, border:`1px solid ${BD}`, borderRadius:14, padding:"14px 18px", marginBottom:10, transition:"all 0.15s" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          {isEdit ? (
                            <input autoFocus value={editV} onChange={e => setEditV(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditId(null); }}
                              onBlur={handleEditSave}
                              style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:T1, fontSize:15 }} />
                          ) : (
                            <div style={{ fontSize:15, color:T1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</div>
                          )}
                          {task.groupId && groupTotals[task.groupId] && groupTotals[task.groupId].dayCount > 1 && (
                            <div style={{ fontSize:11, color:T3, marginTop:2, display:"flex", alignItems:"center", gap:4 }}>
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="1.5" y="2.5" width="9" height="8" rx="1.5"/><line x1="1.5" y1="5.5" x2="10.5" y2="5.5"/></svg>
                              <span>Across {groupTotals[task.groupId].dayCount} days</span>
                            </div>
                          )}
                        </div>
                        {/* Time (for non-today dates) */}
                        {!isViewingToday && (
                          <div className="editable-time-zone" onClick={e => e.stopPropagation()}>
                            <EditableTime seconds={secs} onSave={(s) => editTaskTime(task.id, s)} style={{ fontSize:14, color:T3 }} />
                          </div>
                        )}
                        <div className="task-actions" style={{ display:"flex", gap:4, opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>
                          <button className="task-action-btn" onClick={() => { setEditId(task.id); setEditV(task.name); }}
                            style={{ width:28, height:28, background:"transparent", border:`1px solid ${BD}`, borderRadius:7, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor=T2; e.currentTarget.style.color=T1; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 1l2 2-5.5 5.5H2.5V7L8 1z"/></svg>
                          </button>
                          <button className="task-action-btn" onClick={() => deleteTask(task.id)}
                            style={{ width:28, height:28, background:"transparent", border:`1px solid ${BD}`, borderRadius:7, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l9 9M10 1L1 10"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Start Working / Viewing badge */}
                {isViewingToday && (
                  <button onClick={() => { if (day.tasks.length) startWork(); }}
                    style={{ width:"100%", padding:"15px", height:48, background: day.tasks.length ? GRN : S2, border:`1px solid ${day.tasks.length ? "transparent" : BD}`, borderRadius:14, color: day.tasks.length ? "#fff" : T3, fontSize:15, fontWeight:600, cursor: day.tasks.length ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", gap:9, boxShadow: day.tasks.length ? "0 4px 14px rgba(61,89,65,0.28)" : "none", marginTop:8 }}
                    onMouseEnter={e => { if (day.tasks.length) e.currentTarget.style.opacity="0.88"; }}
                    onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                    Start Working
                    {day.tasks.length > 0 && <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11"/></svg>}
                  </button>
                )}
                {!isViewingToday && day.tasks.length > 0 && (
                  <div style={{ width:"100%", padding:"14px", background:S2, border:`1px solid ${BD}`, borderRadius:14, color:T3, fontSize:14, fontWeight:500, textAlign:"center", marginTop:8 }}>
                    Viewing {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {ready && nav === "calendar" && (
          <CalendarView
            calData={calData}
            calY={calY}
            calM={calM}
            selD={selD}
            onPrev={prevMonth}
            onNext={nextMonth}
            onToday={goToday}
            onSelectDay={setSelD}
            onAddTaskToDay={addTaskToDay}
            onDeleteTaskFromDay={deleteTaskFromDay}
          />
        )}
      </main>
    </div>
  );
}

// ── Calendar view ───────────────────────────────────────────────────────────────
function CalendarView({ calData, calY, calM, selD, onPrev, onNext, onToday, onSelectDay, onAddTaskToDay, onDeleteTaskFromDay }) {
  const [calTaskIn, setCalTaskIn] = useState("");
  const calInputRef = useRef(null);

  const handleCalAdd = () => {
    if (!calTaskIn.trim() || !selD) return;
    onAddTaskToDay(selD, calTaskIn.trim());
    setCalTaskIn("");
    calInputRef.current?.focus();
  };

  const firstDay = new Date(calY, calM, 1).getDay();
  const daysInM  = new Date(calY, calM + 1, 0).getDate();
  const cells    = [...Array(firstDay).fill(null), ...Array.from({ length: daysInM }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const getTotal = d => d?.tasks?.reduce((s, t) => s + (t.seconds || 0), 0) || 0;
  const todayData = calData[todayStr()];
  const viewData  = selD ? calData[selD] : null;

  return (
    <div style={{ display:"flex", flex:1, minHeight:0, animation:"fu 0.3s ease" }}>
      {/* calendar grid */}
      <div style={{ flex:1, padding:"36px 28px 36px 44px", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
          <h1 style={{ fontSize:26, fontWeight:700, margin:0, letterSpacing:"-0.5px" }}>{MONTHS[calM]} {calY}</h1>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={onToday}
              style={{ padding:"8px 16px", background:GRN, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", boxShadow:"0 3px 10px rgba(61,89,65,0.28)" }}>
              Today
            </button>
            <button onClick={onPrev}
              style={{ width:32, height:32, borderRadius:8, border:`1px solid ${BD}`, background:WH, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2, transition:"background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background=S2}
              onMouseLeave={e => e.currentTarget.style.background=WH}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7.5 2L3.5 5.5l4 3.5"/></svg>
            </button>
            <button onClick={onNext}
              style={{ width:32, height:32, borderRadius:8, border:`1px solid ${BD}`, background:WH, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T2, transition:"background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background=S2}
              onMouseLeave={e => e.currentTarget.style.background=WH}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3.5 2l4 3.5-4 3.5"/></svg>
            </button>
          </div>
        </div>

        <div style={{ border:`1px solid ${BD}`, borderRadius:16, overflow:"hidden", background:WH }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${BD}`, background:S2 }}>
            {WDAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:T3, letterSpacing:"0.08em", padding:"10px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
            {cells.map((dayNum, i) => {
              const col  = i % 7;
              const isLastRow = i >= cells.length - 7;
              const bR   = col < 6 ? `1px solid ${BD}` : "none";
              const bB   = isLastRow ? "none" : `1px solid ${BD}`;

              if (!dayNum) return <div key={i} style={{ minHeight:100, borderRight:bR, borderBottom:bB, background:S2 }} />;

              const ds      = `${calY}-${String(calM+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
              const data    = calData[ds];
              const totalS  = getTotal(data);
              const isToday = ds === todayStr();
              const isFut   = ds > todayStr();
              const hasData = (data?.tasks?.length ?? 0) > 0;
              const isSel   = selD === ds;
              const clickable = true;

              return (
                <div key={i}
                  onClick={() => onSelectDay(isSel ? null : ds)}
                  style={{ minHeight:100, borderRight:bR, borderBottom:bB, padding:"10px", cursor:"pointer", background: isSel ? "#f0f5f0" : WH, transition:"background 0.12s", position:"relative" }}
                  onMouseEnter={e => e.currentTarget.style.background="#f8faf8"}
                  onMouseLeave={e => { e.currentTarget.style.background = isSel ? "#f0f5f0" : WH; }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight: isToday ? 700 : 400, color: isToday ? "#fff" : isFut ? T3 : T2, background: isToday ? GRN : "transparent", width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {dayNum}
                    </span>
                    {isToday && <span style={{ fontSize:10, fontWeight:600, color:GRN, background:GRNL, borderRadius:6, padding:"2px 7px" }}>Today</span>}
                  </div>
                  {hasData && (
                    <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                      {data.tasks.slice(0, 3).map((t, ti) => {
                        const c = getColor(t);
                        return <div key={ti} style={{ width:6, height:6, borderRadius:"50%", background:c.dot }} />;
                      })}
                    </div>
                  )}
                  {hasData && totalS > 0 && (
                    <div style={{ position:"absolute", bottom:8, left:10, fontSize:10, color:T3, fontFamily:"'JetBrains Mono',monospace" }}>
                      {shortT(totalS)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* right panel */}
      <div style={{ width:280, borderLeft:`1px solid ${BD}`, padding:"36px 20px", flexShrink:0, overflowY:"auto" }}>
        {/* upcoming focus */}
        {todayData?.activeTask && (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:T3, marginBottom:12 }}>UPCOMING FOCUS</div>
            {todayData.tasks.filter(t => t.id === todayData.activeTask).map(t => {
              const c = getColor(t);
              return (
                <div key={t.id} style={{ background:WH, border:`1px solid ${BD}`, borderRadius:14, padding:"14px", display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:GRN, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#fff" }}>
                    <div style={{ fontSize:8, fontWeight:700 }}>{MONTHS[new Date().getMonth()].slice(0,3).toUpperCase()}</div>
                    <div style={{ fontSize:16, fontWeight:700, lineHeight:1.1 }}>{new Date().getDate()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T1, marginBottom:4 }}>{t.name}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <Dot color={c.dot} pulse />
                      <span style={{ fontSize:11, color:T3 }}>Active now</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* task queue */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:T3, marginBottom:12 }}>
            {viewData ? `${new Date(selD + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" })} — TASKS` : "TODAY'S QUEUE"}
          </div>

          {/* Add task input for selected day */}
          {selD && (
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
              <input
                ref={calInputRef}
                placeholder="Add task..."
                value={calTaskIn}
                onChange={e => setCalTaskIn(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCalAdd(); }}
                style={{ flex:1, background:WH, border:`1px solid ${BD}`, borderRadius:8, padding:"8px 10px", outline:"none", color:T1, fontSize:12 }}
              />
              <button onClick={handleCalAdd}
                style={{ width:30, height:30, background:GRN, border:"none", borderRadius:8, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18, lineHeight:1 }}>
                +
              </button>
            </div>
          )}

          {((selD ? viewData : todayData)?.tasks ?? []).length > 0 ? (
            (selD ? viewData : todayData).tasks.map(t => {
              const c = getColor(t);
              return (
                <div key={t.id} style={{ background:WH, border:`1px solid ${BD}`, borderRadius:12, padding:"11px 14px", marginBottom:7, display:"flex", alignItems:"center", gap:10 }}>
                  <Dot color={c.dot} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:T1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</div>
                    {t.seconds > 0 && <div style={{ fontSize:11, color:T3, marginTop:1 }}>{shortT(t.seconds)} tracked</div>}
                  </div>
                  {selD && selD >= todayStr() && (
                    <button onClick={() => onDeleteTaskFromDay(selD, t.id)}
                      style={{ width:22, height:22, background:"transparent", border:`1px solid ${BD}`, borderRadius:6, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize:12, color:T3, textAlign:"center", padding:"20px 0" }}>{selD ? "No tasks yet — add one above" : "No tasks"}</div>
          )}
        </div>

        {/* selected day breakdown */}
        {selD && calData[selD] && (() => {
          const d      = calData[selD];
          const totalS = getTotal(d);
          return (
            <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:14, padding:"16px" }}>
              <div style={{ fontSize:12, fontWeight:600, color:T2, marginBottom:12 }}>
                {new Date(selD + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" })} · {shortT(totalS)} total
              </div>
              {d.tasks.map(t => {
                const c   = getColor(t);
                const pct = totalS > 0 ? Math.round((t.seconds / totalS) * 100) : 0;
                return (
                  <div key={t.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                      <Dot color={c.dot} />
                      <span style={{ fontSize:12, color:T2, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T3, flexShrink:0 }}>{shortT(t.seconds)}</span>
                    </div>
                    <div style={{ height:4, background:S2, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${pct}%`, height:"100%", background:c.dot, borderRadius:2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
