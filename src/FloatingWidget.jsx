import { useState, useEffect, useRef } from "react";

const COLORS = [
  { pill: "#dce8db", dot: "#4a7a50", text: "#2d4a30" },
  { pill: "#d8e2f0", dot: "#4a6490", text: "#2d3e60" },
  { pill: "#f0dbd8", dot: "#c46048", text: "#803830" },
  { pill: "#f0e8d8", dot: "#c4904a", text: "#805830" },
  { pill: "#e4daf0", dot: "#8a5ca8", text: "#5a3a78" },
  { pill: "#d8ecec", dot: "#4a8a8a", text: "#2d5858" },
  { pill: "#f0ece0", dot: "#a08040", text: "#705828" },
  { pill: "#ecdce8", dot: "#a04878", text: "#702858" },
];
const getColor = (t) => COLORS[(t.colorIdx ?? 0) % COLORS.length];
const pad = (n) => String(n).padStart(2, "0");
const hms = (s) => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60); };

const PlayIcon = ({ size = 14, color = "#fff" }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M4 2.5L13 8L4 13.5V2.5Z" fill={color}/></svg>;
const PauseIcon = ({ size = 14, color = "#fff" }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="3.5" height="12" rx="1" fill={color}/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill={color}/></svg>;

const STYLE_ID = "__tempo_widget_styles";
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes tempo-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    input::placeholder { color: #6a6a72 !important; }
  `;
  document.head.appendChild(style);
}

export default function FloatingWidget() {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [data, setData] = useState({
    activeTaskName: null, activeTaskColor: null, activeTaskSecs: 0,
    isRunning: false, isAway: false, tasks: [],
  });
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [taskInput, setTaskInput] = useState("");
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const inputFocused = useRef(false);

  useEffect(() => {
    ensureStyles();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    if (window.tempo?.getDayData) window.tempo.getDayData().then((d) => { if (d) setData((prev) => ({ ...prev, ...d })); });
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    let u1 = null, u2 = null;
    if (window.tempo?.onTick) u1 = window.tempo.onTick((t) => setData((p) => ({ ...p, ...t })));
    if (window.tempo?.onStateUpdate) u2 = window.tempo.onStateUpdate((s) => setData((p) => ({ ...p, ...s })));
    return () => { if (typeof u1 === "function") u1(); if (typeof u2 === "function") u2(); };
  }, []);

  const expand = () => { if (!expanded) { setExpanded(true); window.tempo?.setWidgetExpanded?.(true); } };
  const collapse = () => { if (expanded && !inputFocused.current) { setExpanded(false); window.tempo?.setWidgetExpanded?.(false); } };
  const toggle = () => { if (expanded) collapse(); else expand(); };

  // Only collapse on click outside if input is not focused
  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        inputFocused.current = false;
        setExpanded(false);
        window.tempo?.setWidgetExpanded?.(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });

  // Don't collapse on blur if input is focused
  useEffect(() => {
    const h = () => { if (!inputFocused.current) collapse(); };
    window.addEventListener("blur", h);
    return () => window.removeEventListener("blur", h);
  });

  const { activeTaskName, activeTaskColor, activeTaskSecs, isRunning, isAway, tasks } = data;
  const hasActive = activeTaskName != null;
  const totalSecs = tasks.reduce((s, t) => s + (t.seconds || 0), 0);
  const isLight = expanded || hovered;

  const BG = isLight ? "#f7f5f0" : "#1a1a1f";
  const BORDER = isLight ? "#e0dcd4" : "#2a2a30";
  const TEXT1 = isLight ? "#1a1a18" : "#ffffff";
  const TEXT2 = isLight ? "#5c5c54" : "#a0a0a8";
  const TEXT3 = isLight ? "#9a9a92" : "#6a6a72";
  const GRN = "#3d5941";

  const handleAddTask = () => {
    if (taskInput.trim()) {
      window.tempo?.addTask?.(taskInput.trim());
      setTaskInput("");
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: 260, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: "'Inter', -apple-system, sans-serif", userSelect: "none", WebkitAppRegion: "no-drag", transition: "all 200ms ease" }}>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{ background: BG, borderRadius: 14, marginBottom: 4, overflow: "hidden", border: `1px solid ${BORDER}`, boxShadow: isLight ? "0 8px 32px rgba(0,0,0,0.08)" : "0 4px 20px rgba(0,0,0,0.5)" }}>

          {/* Away banner — always prominent when away */}
          {isAway && (
            <div style={{ padding: "10px 14px", background: isLight ? "#fef3c7" : "#3d3520", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 4.5v2.5l1.8 1"/></svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>You're Away</span>
              </div>
              <button onClick={() => window.tempo?.imBack?.()}
                style={{ padding: "5px 14px", background: "#f59e0b", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                I'm Back
              </button>
            </div>
          )}

          {/* Task list */}
          {tasks.length > 0 && (
            <div style={{ overflowY: "auto", maxHeight: 200, padding: "4px 0" }}>
              {tasks.map((task) => {
                const color = getColor(task);
                const isActive = task.isActive;
                const isHov = hoveredTask === task.id;
                const pct = totalSecs > 0 ? Math.round((task.seconds / totalSecs) * 100) : 0;
                return (
                  <div key={task.id}
                    onClick={() => window.tempo?.switchTask?.(task.id)}
                    onMouseEnter={() => setHoveredTask(task.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                    style={{
                      padding: "7px 14px", cursor: "pointer",
                      background: isHov ? (isLight ? "#f0ede6" : "#2a2a30") : "transparent",
                      borderLeft: isActive ? `2px solid ${color.dot}` : "2px solid transparent",
                      transition: "background 120ms ease", boxSizing: "border-box",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color.dot, flexShrink: 0, animation: isActive ? "tempo-pulse 2s ease-in-out infinite" : "none" }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400, color: TEXT1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.name}</span>
                      <span style={{ fontSize: 10, color: TEXT3, flexShrink: 0 }}>{pct}%</span>
                      <span style={{ fontSize: 10, color: isActive ? (isLight ? GRN : "#7ab87e") : TEXT3, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{hms(task.seconds)}</span>
                    </div>
                    <div style={{ height: 3, background: isLight ? "#e8e4dc" : "#333338", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color.dot, borderRadius: 2, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add task input */}
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              placeholder="Add task..."
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              onFocus={() => { inputFocused.current = true; }}
              onBlur={() => { inputFocused.current = false; }}
              onKeyDown={e => { if (e.key === "Enter") handleAddTask(); }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{
                flex: 1, background: isLight ? "#f0ede6" : "#2a2a30", border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: "8px 10px", color: TEXT1, fontSize: 12, outline: "none",
                fontFamily: "inherit", boxSizing: "border-box", minWidth: 0,
              }}
            />
            <button onClick={handleAddTask}
              style={{ width: 32, height: 32, background: GRN, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, lineHeight: 1 }}>
              +
            </button>
          </div>

          {/* Bottom actions — Away button prominent, no pause */}
          <div style={{ borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "6px 10px", gap: 6 }}>
            {/* Away / I'm Back */}
            {!isAway ? (
              <button onClick={() => window.tempo?.goAway?.()}
                onMouseEnter={() => setHoveredBtn("away")} onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  flex: 1, height: 34, borderRadius: 9,
                  background: hoveredBtn === "away" ? "#fde68a" : "#fef3c7",
                  border: "1.5px solid #f59e0b",
                  color: "#92400e", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 120ms ease", boxShadow: "0 1px 4px rgba(245,158,11,0.15)",
                }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#92400e" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v3.5l2 1.5"/>
                </svg>
                Take a Break
              </button>
            ) : (
              <button onClick={() => window.tempo?.imBack?.()}
                onMouseEnter={() => setHoveredBtn("back")} onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  flex: 1, height: 34, borderRadius: 9, border: "none",
                  background: hoveredBtn === "back" ? "#d97706" : "#f59e0b",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: "0 2px 8px rgba(245,158,11,0.3)", transition: "all 120ms ease",
                }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M8 3l5 5-5 5"/></svg>
                I'm Back
              </button>
            )}

            {/* Open main */}
            <button onClick={() => window.tempo?.openMainWindow?.()}
              onMouseEnter={() => setHoveredBtn("open")} onMouseLeave={() => setHoveredBtn(null)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`,
                background: hoveredBtn === "open" ? (isLight ? "#f0ede6" : "#2a2a30") : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms ease",
              }} title="Open SnapTrack">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill={TEXT2}/><rect x="9" y="2" width="5" height="5" rx="1" fill={TEXT2}/><rect x="2" y="9" width="5" height="5" rx="1" fill={TEXT2}/><rect x="9" y="9" width="5" height="5" rx="1" fill={TEXT2}/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Collapsed pill ── */}
      <div onClick={toggle}
        style={{
          height: 44, borderRadius: 12, padding: "0 14px",
          display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0,
          background: BG, border: `1px solid ${BORDER}`,
          boxShadow: isLight ? "0 4px 16px rgba(0,0,0,0.08)" : "0 4px 20px rgba(0,0,0,0.5)",
          transition: "all 200ms ease",
        }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden", marginRight: 8 }}>
          {hasActive && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: activeTaskColor?.dot ?? "#4a7a50", flexShrink: 0, marginRight: 8, animation: isRunning ? "tempo-pulse 2s ease-in-out infinite" : "none" }} />
          )}
          {hasActive ? (<>
            <span style={{ fontSize: 13, color: TEXT1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120, lineHeight: "44px", fontWeight: 500 }}>{activeTaskName}</span>
            <span style={{ fontSize: 13, color: TEXT2, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", marginLeft: 8, flexShrink: 0 }}>{hms(activeTaskSecs)}</span>
          </>) : (
            <span style={{ fontSize: 13, color: TEXT3 }}>No task</span>
          )}
        </div>

        {/* Away indicator on pill */}
        {isAway && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, marginRight: 6 }} />
        )}

        {/* Play/pause */}
        <button
          onClick={(e) => { e.stopPropagation(); window.tempo?.pauseResume?.(); }}
          onMouseEnter={() => setHoveredBtn("pill-play")} onMouseLeave={() => setHoveredBtn(null)}
          style={{
            width: 26, height: 26, borderRadius: 7, border: "none",
            background: hoveredBtn === "pill-play" ? (isLight ? "#e8e4dc" : "#2a2a30") : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, flexShrink: 0, transition: "background 120ms ease",
          }} title={isRunning ? "Pause" : "Resume"}>
          {isRunning ? <PauseIcon size={12} color={TEXT1} /> : <PlayIcon size={12} color={TEXT1} />}
        </button>
      </div>
    </div>
  );
}
