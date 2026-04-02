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
const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return (
    pad(Math.floor(s / 3600)) +
    ":" +
    pad(Math.floor((s % 3600) / 60)) +
    ":" +
    pad(s % 60)
  );
};

export default function QuickSwitch() {
  const [data, setData] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [visible, setVisible] = useState(true);
  const dismissTimer = useRef(null);

  // Load JetBrains Mono font
  useEffect(() => {
    if (!document.querySelector('link[href*="JetBrains+Mono"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Get initial state
  useEffect(() => {
    if (window.tempo?.getDayData) {
      const initial = window.tempo.getDayData();
      if (initial) setData(initial);
    }
  }, []);

  // Subscribe to tick updates
  useEffect(() => {
    let cleanup;
    if (window.tempo?.onTick) {
      cleanup = window.tempo.onTick((tick) => {
        setData(tick);
      });
    }
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  // Subscribe to show events
  useEffect(() => {
    let cleanup;
    if (window.tempo?.onShowQuickSwitch) {
      cleanup = window.tempo.onShowQuickSwitch(() => {
        setVisible(true);
        if (window.tempo?.getDayData) {
          const fresh = window.tempo.getDayData();
          if (fresh) setData(fresh);
        }
      });
    }
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        window.tempo?.closeQuickSwitch();
        return;
      }

      const num = parseInt(e.key, 10);
      if (isNaN(num)) return;

      e.preventDefault();

      if (num === 0) {
        window.tempo?.pauseResume();
        dismissTimer.current = setTimeout(() => {
          window.tempo?.closeQuickSwitch();
        }, 150);
        return;
      }

      if (data?.tasks && num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < data.tasks.length) {
          window.tempo?.switchTask(data.tasks[idx].id);
          dismissTimer.current = setTimeout(() => {
            window.tempo?.closeQuickSwitch();
          }, 150);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [data]);

  const tasks = data?.tasks ?? [];

  return (
    <div style={styles.outer}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>Quick Switch</div>
        <div style={styles.subtitle}>
          Press 1–9 to switch task, 0 to pause/resume, Esc to dismiss
        </div>

        {/* Task list */}
        <div style={styles.taskList}>
          {tasks.map((task, i) => {
            if (i >= 9) return null;
            const color = getColor(task);
            const isActive = task.isActive;
            const isHovered = hoveredIdx === i;

            const rowStyle = {
              ...styles.taskRow,
              ...(isActive
                ? {
                    backgroundColor: "#f0f5f0",
                    borderLeft: `3px solid ${color.dot}`,
                    paddingLeft: 13,
                  }
                : {}),
              ...(isHovered && !isActive
                ? { backgroundColor: "#f4f1ea" }
                : {}),
            };

            return (
              <div
                key={task.id}
                style={rowStyle}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(-1)}
                onClick={() => {
                  window.tempo?.switchTask(task.id);
                  dismissTimer.current = setTimeout(() => {
                    window.tempo?.closeQuickSwitch();
                  }, 150);
                }}
              >
                <div style={styles.numberBadge}>{i + 1}</div>
                <div
                  style={{
                    ...styles.dot,
                    backgroundColor: color.dot,
                  }}
                />
                <div style={styles.taskName}>{task.name}</div>
                <div style={styles.taskTime}>{hms(task.seconds)}</div>
              </div>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div style={styles.bottomRow}>0 — Pause/Resume</div>
      </div>
    </div>
  );
}

const styles = {
  outer: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    userSelect: "none",
    animation: "quickSwitchFadeIn 200ms ease-out forwards",
  },
  card: {
    width: 560,
    height: 360,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    padding: 32,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1a18",
    marginBottom: 8,
    lineHeight: 1,
  },
  subtitle: {
    fontSize: 12,
    color: "#9a9a92",
    marginBottom: 24,
    lineHeight: 1,
  },
  taskList: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  taskRow: {
    height: 48,
    minHeight: 48,
    borderRadius: 12,
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    transition: "background-color 100ms ease",
    boxSizing: "border-box",
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#f4f1ea",
    fontWeight: 700,
    fontSize: 13,
    color: "#5c5c54",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  taskName: {
    fontSize: 14,
    color: "#1a1a18",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  taskTime: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 13,
    color: "#9a9a92",
    flexShrink: 0,
  },
  bottomRow: {
    textAlign: "right",
    fontSize: 12,
    color: "#9a9a92",
    paddingTop: 12,
    flexShrink: 0,
  },
};

// Inject keyframe animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes quickSwitchFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;
document.head.appendChild(styleSheet);
