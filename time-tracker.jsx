import { useState, useEffect, useRef } from "react";

// ── utils ──────────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
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

// ── storage ────────────────────────────────────────────────────────────────────
const useCloudStorage = () => typeof window !== "undefined" && window.storage != null;
const dbGet  = async k => {
  try {
    if (useCloudStorage()) { const r=await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
    const v = localStorage.getItem(k); return v ? JSON.parse(v) : null;
  } catch { return null; }
};
const dbSet  = async (k,v) => {
  try {
    if (useCloudStorage()) { await window.storage.set(k, JSON.stringify(v)); return; }
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const dbList = async p => {
  try {
    if (useCloudStorage()) { const r=await window.storage.list(p); return r ? r.keys : []; }
    return Object.keys(localStorage).filter(k => k.startsWith(p));
  } catch { return []; }
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
function IcoTask() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="3" y1="4.5" x2="13" y2="4.5"/>
    <line x1="3" y1="8" x2="13" y2="8"/>
    <line x1="3" y1="11.5" x2="9" y2="11.5"/>
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

// ── root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [day, setDay]     = useState({ tasks:[], phase:"planning", activeTask:null, sessionStart:null, isAway:false, awayStart:null });
  const [ready, setReady] = useState(false);
  const [tick,  setTick]  = useState(0);
  const [nav,   setNav]   = useState("tasks");

  // calendar
  const [calData, setCalData] = useState({});
  const [calY,    setCalY]    = useState(new Date().getFullYear());
  const [calM,    setCalM]    = useState(new Date().getMonth());
  const [selD,    setSelD]    = useState(null);

  // load fonts + saved day
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);

    (async () => {
      const saved = await dbGet(`day:${todayStr()}`);
      if (saved) {
        setDay(saved);
        if (saved.phase === "working") setNav("dashboard");
      }
      setReady(true);
    })();
  }, []);

  // tick every second for live timer
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── day persistence ────────────────────────────────────────────────────────
  const persist = (next) => {
    setDay(next);
    dbSet(`day:${todayStr()}`, next); // fire-and-forget, errors swallowed inside dbSet
  };

  // ── time helpers ───────────────────────────────────────────────────────────
  // Always pass the current day snapshot explicitly – no closure over day
  const getLive = (task, d) => {
    const snap = d || day;
    if (!snap.isAway && snap.activeTask === task.id && snap.sessionStart) {
      return task.seconds + Math.floor((Date.now() - snap.sessionStart) / 1000);
    }
    return task.seconds;
  };

  const flushActive = (d) => {
    if (!d.activeTask || !d.sessionStart) return d.tasks;
    const el = Math.floor((Date.now() - d.sessionStart) / 1000);
    return d.tasks.map(t => t.id === d.activeTask ? { ...t, seconds: t.seconds + el } : t);
  };

  // ── actions  ────────────────────────────────────────────────────────────────
  // addTask receives the name as a parameter (no closure over state)
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
    if (!day.tasks.length) return;
    persist({ ...day, phase:"working", activeTask:day.tasks[0].id, sessionStart:Date.now() });
    setNav("dashboard");
  };

  const newTimer = () => {
    // Go to tasks view – if already working, just navigate; tasks can be managed there
    setNav("tasks");
  };

  const switchTask = (id) => {
    if (day.isAway) return;
    const now = Date.now();
    const flushed = flushActive(day);
    const alreadyActive = day.activeTask === id;
    persist({
      ...day,
      tasks:        flushed,
      activeTask:   alreadyActive ? null : id,
      sessionStart: alreadyActive ? null : now,
    });
  };

  const pauseResume = () => {
    if (day.isAway) return;
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
    if (!day.tasks.length) return;
    const idx  = day.tasks.findIndex(t => t.id === day.activeTask);
    const next = day.tasks[(idx + 1) % day.tasks.length];
    persist({ ...day, tasks: flushActive(day), activeTask: next.id, sessionStart: Date.now() });
  };

  const resetTask = () => {
    if (!day.activeTask) return;
    const running = !!(day.activeTask && day.sessionStart && !day.isAway);
    persist({ ...day, tasks: day.tasks.map(t => t.id === day.activeTask ? { ...t, seconds:0 } : t), sessionStart: running ? Date.now() : null });
  };

  const goAway = () => {
    persist({ ...day, tasks: flushActive(day), sessionStart: null, isAway: true, awayStart: Date.now() });
  };

  const imBack = () => {
    persist({ ...day, isAway: false, awayStart: null, sessionStart: day.activeTask ? Date.now() : null });
  };

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

  // ── derived ────────────────────────────────────────────────────────────────
  const activeTask = day.tasks.find(t => t.id === day.activeTask) ?? null;
  const isRunning  = !!(day.activeTask && day.sessionStart && !day.isAway);
  const total      = day.tasks.reduce((s, t) => s + getLive(t, day), 0);
  const awaySecs   = day.isAway && day.awayStart ? Math.floor((Date.now() - day.awayStart) / 1000) : 0;
  const h          = new Date().getHours();
  const greeting   = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

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
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width:240, background:SBG, borderRight:`1px solid ${BD}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
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
            <div style={{ fontWeight:700, fontSize:18, color:T1, letterSpacing:"-0.3px" }}>Tempo</div>
            <div style={{ fontSize:8.5, color:T3, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginTop:1 }}>The Sophisticated Concierge</div>
          </div>
        </div>

        {/* nav */}
        <nav style={{ flex:1, padding:"0 12px" }}>
          {[
            { id:"dashboard", label:"Dashboard", icon:<IcoDash />,  action: () => setNav("dashboard") },
            { id:"tasks",     label:"Tasks",     icon:<IcoTask />,  action: () => setNav("tasks") },
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

        {/* new timer button */}
        <div style={{ padding:"0 16px 16px" }}>
          <button
            onClick={newTimer}
            style={{ width:"100%", padding:"13px 0", background:GRN, border:"none", borderRadius:14, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(61,89,65,0.3)", transition:"opacity 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <line x1="6.5" y1="1.5" x2="6.5" y2="11.5"/>
              <line x1="1.5" y1="6.5" x2="11.5" y2="6.5"/>
            </svg>
            New Timer
          </button>
        </div>

        {/* bottom links */}
        <div style={{ borderTop:`1px solid ${BD}`, padding:"12px 12px 20px" }}>
          {["Settings", "Help"].map(label => (
            <button key={label}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderRadius:10, border:"none", background:"transparent", color:T3, fontSize:13, cursor:"pointer", textAlign:"left", transition:"color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = T2}
              onMouseLeave={e => e.currentTarget.style.color = T3}>
              {label === "Settings" ? "⚙" : "?"} {label}
            </button>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", marginTop:4 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:GRN, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="6" r="3" stroke="white" strokeWidth="1.3"/>
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:T1 }}>You</div>
              <div style={{ fontSize:11, color:T3 }}>Today's session</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {!ready && (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:GRN, animation:"pu 1.2s ease infinite" }} />
          </div>
        )}
        {ready && nav === "tasks" && (
          <TasksView
            day={day}
            onAddTask={addTask}
            onEditTask={editTask}
            onDeleteTask={deleteTask}
            onStartWork={startWork}
            getLive={(task) => getLive(task, day)}
            total={total}
            tick={tick}
          />
        )}
        {ready && nav === "dashboard" && (
          <DashboardView
            day={day}
            activeTask={activeTask}
            total={total}
            tick={tick}
            getLive={(task) => getLive(task, day)}
            awaySecs={awaySecs}
            isRunning={isRunning}
            greeting={greeting}
            onPauseResume={pauseResume}
            onSkip={skipTask}
            onReset={resetTask}
            onGoAway={goAway}
            onImBack={imBack}
            onSwitchTask={switchTask}
            onGoToTasks={() => setNav("tasks")}
          />
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
          />
        )}
      </main>
    </div>
  );
}

// ── Tasks view ──────────────────────────────────────────────────────────────────
// taskIn state lives HERE (local) to avoid closure issues in parent
function TasksView({ day, onAddTask, onEditTask, onDeleteTask, onStartWork, getLive, total, tick }) {
  const [taskIn, setTaskIn] = useState("");
  const [editId, setEditId] = useState(null);
  const [editV,  setEditV]  = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleAdd = () => {
    const val = taskIn.trim();
    if (!val) return;
    onAddTask(val);
    setTaskIn("");
    inputRef.current?.focus();
  };

  const handleEditSave = () => {
    if (editV.trim()) onEditTask(editId, editV);
    setEditId(null);
    setEditV("");
  };

  return (
    <div style={{ padding:"36px 44px", maxWidth:720, animation:"fu 0.3s ease" }}>
      {/* header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
        <div>
          <h1 style={{ fontSize:30, fontWeight:700, margin:0, marginBottom:6, letterSpacing:"-0.6px" }}>
            {day.phase === "planning" ? "Plan Your Day" : "Today's Tasks"}
          </h1>
          <p style={{ margin:0, fontSize:14, color:T3 }}>
            {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}
          </p>
        </div>
        {day.phase === "working" && total > 0 && (
          <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:14, padding:"12px 18px", textAlign:"right" }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:T3, marginBottom:3 }}>TOTAL TODAY</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:700, color:GRN }}>{hms(total)}</div>
          </div>
        )}
      </div>

      {/* add task input */}
      <div style={{ display:"flex", gap:10, marginBottom:20, background:WH, border:`1px solid ${BD}`, borderRadius:14, padding:"12px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <input
          ref={inputRef}
          placeholder="Add a task to your sprint…"
          value={taskIn}
          onChange={e => setTaskIn(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          style={{ flex:1, background:"transparent", border:"none", outline:"none", color:T1, fontSize:14 }}
        />
        <button
          onClick={handleAdd}
          style={{ width:34, height:34, background:GRN, border:"none", borderRadius:9, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22, lineHeight:1 }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          +
        </button>
      </div>

      {/* task list */}
      {day.tasks.length === 0 && (
        <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:16, padding:"48px 24px", textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:500, color:T2, marginBottom:4 }}>No tasks yet</div>
          <div style={{ fontSize:13, color:T3 }}>Type a task above and press Enter or +</div>
        </div>
      )}

      {day.tasks.length > 0 && (
        <div style={{ marginBottom:28 }}>
          {day.tasks.map(task => {
            const c        = getColor(task);
            const isActive = day.activeTask === task.id;
            const secs     = getLive(task);
            const isEdit   = editId === task.id;

            return (
              <div key={task.id} style={{ background:WH, border:`1px solid ${isActive ? GRN+"55" : BD}`, borderRadius:14, padding:"14px 18px", marginBottom:8, display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:"fu 0.2s ease" }}>
                <Dot color={c.dot} pulse={isActive} />

                {isEdit ? (
                  <input
                    autoFocus
                    value={editV}
                    onChange={e => setEditV(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditId(null); }}
                    onBlur={handleEditSave}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", color:T1, fontSize:14 }}
                  />
                ) : (
                  <span style={{ flex:1, fontSize:14, color:T1, fontWeight: isActive ? 500 : 400 }}>{task.name}</span>
                )}

                {day.phase === "working" && secs > 0 && (
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T3, flexShrink:0 }}>{hms(secs)}</span>
                )}

                <button
                  onClick={() => { setEditId(task.id); setEditV(task.name); }}
                  style={{ width:30, height:30, background:"transparent", border:`1px solid ${BD}`, borderRadius:8, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=T2; e.currentTarget.style.color=T1; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7.5 1l2 2-5.5 5.5H2.5V7L8 1z"/></svg>
                </button>

                <button
                  onClick={() => onDeleteTask(task.id)}
                  style={{ width:30, height:30, background:"transparent", border:`1px solid ${BD}`, borderRadius:8, color:T3, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=BD; e.currentTarget.style.color=T3; }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l9 9M10 1L1 10"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* start working */}
      {day.phase === "planning" && (
        <button
          onClick={() => { if (day.tasks.length) onStartWork(); }}
          style={{ width:"100%", padding:"15px", background: day.tasks.length ? GRN : S2, border:`1px solid ${day.tasks.length ? "transparent" : BD}`, borderRadius:14, color: day.tasks.length ? "#fff" : T3, fontSize:15, fontWeight:600, cursor: day.tasks.length ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", gap:9, boxShadow: day.tasks.length ? "0 4px 14px rgba(61,89,65,0.28)" : "none", transition:"all 0.2s" }}
          onMouseEnter={e => { if (day.tasks.length) e.currentTarget.style.opacity="0.88"; }}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          Start Working
          {day.tasks.length > 0 && (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ── Dashboard view ──────────────────────────────────────────────────────────────
function DashboardView({ day, activeTask, total, tick, getLive, awaySecs, isRunning, greeting, onPauseResume, onSkip, onReset, onGoAway, onImBack, onSwitchTask, onGoToTasks }) {
  const activeSecs = activeTask ? getLive(activeTask) : 0;

  return (
    <div style={{ padding:"36px 44px", flex:1, animation:"fu 0.3s ease" }}>
      {/* header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:700, margin:0, marginBottom:6, letterSpacing:"-0.5px" }}>Focus Session</h1>
          <p style={{ margin:0, fontSize:14, color:T2 }}>{greeting}. Let's make today productive.</p>
        </div>
        {day.isAway ? (
          <button onClick={onImBack}
            style={{ padding:"9px 20px", background:"#f59e0b", border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 12px rgba(245,158,11,0.3)" }}>
            I'm Back
          </button>
        ) : (
          <button onClick={onGoAway}
            style={{ padding:"9px 16px", background:WH, border:`1px solid ${BD}`, borderRadius:10, color:T2, fontSize:13, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background="#fff8e6"; e.currentTarget.style.color="#b45309"; }}
            onMouseLeave={e => { e.currentTarget.style.background=WH; e.currentTarget.style.color=T2; }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5"/><path d="M6.5 4v2.5l1.5 1"/>
            </svg>
            Away
          </button>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
        {/* left */}
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

          {/* timer card */}
          <div style={{ background:WH, borderRadius:20, padding:"36px 32px", boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:`1px solid ${BD}`, position:"relative", overflow:"hidden" }}>
            {day.isAway && (
              <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.96)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:10, borderRadius:20, animation:"fi 0.2s ease" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em", color:"#f59e0b", marginBottom:16 }}>AWAY</div>
                <div style={{ fontSize:13, color:T3, marginBottom:32 }}>Away time is not counted</div>
                <button onClick={onImBack}
                  style={{ padding:"11px 32px", background:"#f59e0b", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  I'm Back
                </button>
              </div>
            )}
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.22em", color:T3, marginBottom:18 }}>
                {activeTask ? activeTask.name.toUpperCase() : "DEEP WORK TIMER"}
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:80, fontWeight:700, color:T1, letterSpacing:"-4px", lineHeight:1, marginBottom:36 }}>
                {hms(activeSecs)}
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:18 }}>
                {/* reset */}
                <CtrlBtn onClick={onReset}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a7 7 0 1 0 1.8-4.7M2 4.5V9h4.5"/>
                  </svg>
                </CtrlBtn>
                {/* play/pause */}
                <button onClick={onPauseResume}
                  style={{ width:66, height:66, borderRadius:"50%", background:GRN, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 6px 20px rgba(61,89,65,0.38)", transition:"transform 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.transform="scale(1.06)"}
                  onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                  {isRunning ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="5" y="4" width="4.5" height="16" rx="2"/><rect x="14.5" y="4" width="4.5" height="16" rx="2"/></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 5.5l12 6.5L7 18.5V5.5z"/></svg>
                  )}
                </button>
                {/* skip */}
                <CtrlBtn onClick={onSkip}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 4.5l7 4.5-7 4.5V4.5z"/><line x1="14" y1="4.5" x2="14" y2="13.5"/>
                  </svg>
                </CtrlBtn>
              </div>
            </div>
          </div>

          {/* current sprint */}
          {day.tasks.length > 0 ? (
            <div style={{ background:WH, borderRadius:20, padding:"22px 26px", boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:`1px solid ${BD}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:600, color:T1 }}>Current Sprint</div>
                <div style={{ fontSize:11, fontWeight:600, color:T2, background:S2, border:`1px solid ${BD}`, borderRadius:6, padding:"3px 9px" }}>
                  EST. {shortT(total).toUpperCase()}
                </div>
              </div>
              {/* pills */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: total > 0 ? 20 : 0 }}>
                {day.tasks.map(task => {
                  const c    = getColor(task);
                  const isA  = day.activeTask === task.id;
                  return (
                    <button key={task.id} onClick={() => onSwitchTask(task.id)}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background: isA ? c.pill : S2, border:`1px solid ${isA ? c.dot+"55" : BD}`, borderRadius:999, cursor:"pointer", fontSize:13, color: isA ? c.text : T2, fontWeight: isA ? 500 : 400, transition:"all 0.18s" }}
                      onMouseEnter={e => { if (!isA) { e.currentTarget.style.background=c.pill; e.currentTarget.style.color=c.text; } }}
                      onMouseLeave={e => { if (!isA) { e.currentTarget.style.background=S2;     e.currentTarget.style.color=T2;     } }}>
                      <Dot color={c.dot} pulse={isA} />
                      {task.name}
                    </button>
                  );
                })}
              </div>
              {/* breakdown bars */}
              {total > 0 && (
                <div style={{ borderTop:`1px solid ${BD}`, paddingTop:16 }}>
                  {day.tasks.map(task => {
                    const c    = getColor(task);
                    const secs = getLive(task);
                    const pct  = total > 0 ? (secs / total) * 100 : 0;
                    const isA  = day.activeTask === task.id;
                    return (
                      <div key={task.id} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <Dot color={c.dot} />
                            <span style={{ fontSize:13, color: isA ? T1 : T2, fontWeight: isA ? 500 : 400 }}>{task.name}</span>
                          </div>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <span style={{ fontSize:11, color:T3 }}>{Math.round(pct)}%</span>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T2 }}>{hms(secs)}</span>
                          </div>
                        </div>
                        <div style={{ height:5, background:S2, borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:c.dot, borderRadius:3, transition:"width 0.8s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:WH, borderRadius:20, padding:"32px", border:`1px solid ${BD}`, textAlign:"center" }}>
              <p style={{ color:T3, fontSize:13, margin:"0 0 14px" }}>No tasks in this session</p>
              <button onClick={onGoToTasks}
                style={{ padding:"9px 20px", background:GRN, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Add Tasks →
              </button>
            </div>
          )}
        </div>

        {/* right column */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ background:GRN, borderRadius:18, padding:"20px 16px", boxShadow:"0 4px 14px rgba(61,89,65,0.28)" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginBottom:8 }}>⚡ Active</div>
              <div style={{ fontSize:28, fontWeight:700, color:"#fff", letterSpacing:"-0.5px" }}>{day.tasks.filter(t => getLive(t) > 5).length}</div>
            </div>
            <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:18, padding:"20px 16px" }}>
              <div style={{ fontSize:11, color:T3, marginBottom:8 }}>✦ Hours</div>
              <div style={{ fontSize:28, fontWeight:700, color:T1, letterSpacing:"-0.5px" }}>{(Math.round(total / 360) / 10).toFixed(1)}</div>
            </div>
          </div>

          <div style={{ background:WH, border:`1px solid ${BD}`, borderRadius:20, padding:"22px 20px", flex:1 }}>
            <div style={{ fontSize:15, fontWeight:600, color:T1, marginBottom:18 }}>Daily Flow</div>
            {day.tasks.filter(t => getLive(t) > 0).length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px 0", color:T3, fontSize:13 }}>Start a task to see your flow</div>
            ) : (
              day.tasks.filter(t => getLive(t) > 0).map((task, idx, arr) => {
                const c    = getColor(task);
                const isA  = day.activeTask === task.id;
                const secs = getLive(task);
                return (
                  <div key={task.id} style={{ display:"flex", gap:12 }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:c.pill, border:`1.5px solid ${c.dot}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <Dot color={c.dot} pulse={isA} />
                      </div>
                      {idx < arr.length - 1 && <div style={{ width:1, flex:1, background:BD, margin:"4px 0", minHeight:12 }} />}
                    </div>
                    <div style={{ paddingBottom: idx < arr.length - 1 ? 16 : 0, paddingTop:4 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:T1 }}>{task.name}</div>
                      <div style={{ fontSize:11, color:T3, marginTop:2 }}>{isA ? "Active · " : ""}{shortT(secs)} tracked</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
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
      style={{ width:50, height:50, borderRadius:"50%", border:`1.5px solid ${BD}`, background: hov ? S2 : "transparent", cursor:"pointer", color: hov ? T1 : T2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
      {children}
    </button>
  );
}

// ── Calendar view ───────────────────────────────────────────────────────────────
function CalendarView({ calData, calY, calM, selD, onPrev, onNext, onToday, onSelectDay }) {
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
          <h1 style={{ fontSize:28, fontWeight:700, margin:0, letterSpacing:"-0.5px" }}>{MONTHS[calM]} {calY}</h1>
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
              const clickable = hasData && !isFut;

              return (
                <div key={i}
                  onClick={() => { if (clickable) onSelectDay(isSel ? null : ds); }}
                  style={{ minHeight:100, borderRight:bR, borderBottom:bB, padding:"10px", cursor: clickable ? "pointer" : "default", background: isSel ? "#f0f5f0" : WH, transition:"background 0.12s", position:"relative" }}
                  onMouseEnter={e => { if (clickable) e.currentTarget.style.background="#f8faf8"; }}
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
            {viewData ? "SELECTED DAY" : "TODAY'S QUEUE"}
          </div>
          {((viewData || todayData)?.tasks ?? []).length > 0 ? (
            (viewData || todayData).tasks.map(t => {
              const c = getColor(t);
              return (
                <div key={t.id} style={{ background:WH, border:`1px solid ${BD}`, borderRadius:12, padding:"11px 14px", marginBottom:7, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${BD}`, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:T1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</div>
                    {t.seconds > 0 && <div style={{ fontSize:11, color:T3, marginTop:1 }}>{shortT(t.seconds)} tracked</div>}
                  </div>
                  <Dot color={c.dot} />
                </div>
              );
            })
          ) : (
            <div style={{ fontSize:12, color:T3, textAlign:"center", padding:"20px 0" }}>No tasks</div>
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

        {/* ambient */}
        <div style={{ marginTop:20, borderRadius:16, height:120, background:`linear-gradient(135deg,${GRNL},${GRN})`, display:"flex", alignItems:"flex-end", padding:"14px" }}>
          <span style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.85)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
            {MONTHS[new Date().getMonth()]} Ambience
          </span>
        </div>
      </div>
    </div>
  );
}
