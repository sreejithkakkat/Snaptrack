import { useState, useEffect, useRef } from "react";

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

export default function StartOfDay() {
  const [yesterdayTasks, setYesterdayTasks] = useState([]);
  const [addedTasks, setAddedTasks] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    window.tempo.onYesterdayTasks((tasks) => {
      setYesterdayTasks(tasks || []);
    });
  }, []);

  const addTask = (name) => {
    const trimmed = name.trim();
    if (!trimmed || addedTasks.includes(trimmed)) return;
    setAddedTasks((prev) => [...prev, trimmed]);
    window.tempo.addTask(trimmed);
  };

  const removeTask = (name) => {
    setAddedTasks((prev) => prev.filter((t) => t !== name));
    if (!addedTasks.includes(name)) return;
    // Re-add to yesterday chips if it came from there
    setYesterdayTasks((prev) => {
      if (!prev.includes(name)) return [...prev, name];
      return prev;
    });
  };

  const handleChipClick = (name) => {
    setYesterdayTasks((prev) => prev.filter((t) => t !== name));
    addTask(name);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      addTask(inputValue);
      setInputValue("");
    }
  };

  const handleStartFresh = () => {
    window.tempo.openMainWindow();
    window.tempo.closeStartOfDay();
  };

  const handleLetsGo = () => {
    window.tempo.startWork();
    window.tempo.openMainWindow();
    window.tempo.closeStartOfDay();
  };

  const styles = {
    outer: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      fontFamily: "'Inter', sans-serif",
      userSelect: "none",
    },
    card: {
      width: 400,
      background: "#ffffff",
      borderRadius: 20,
      boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
      padding: 32,
      boxSizing: "border-box",
    },
    header: {
      fontSize: 22,
      fontWeight: 700,
      color: "#1a1a18",
      margin: 0,
    },
    subtitle: {
      fontSize: 13,
      color: "#9a9a92",
      marginTop: 4,
      marginBottom: 20,
    },
    yesterdayLabel: {
      fontSize: 10,
      textTransform: "uppercase",
      color: "#9a9a92",
      marginBottom: 8,
      letterSpacing: "0.5px",
    },
    chipsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      background: "#f4f1ea",
      border: "1px solid #d8d4c8",
      borderRadius: 999,
      padding: "6px 14px",
      fontSize: 12,
      color: "#5c5c54",
      cursor: "pointer",
      transition: "background 0.15s",
      outline: "none",
      fontFamily: "'Inter', sans-serif",
    },
    taskList: {
      listStyle: "none",
      margin: "0 0 12px 0",
      padding: 0,
    },
    taskItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      fontSize: 14,
      color: "#1a1a18",
    },
    taskDot: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#3d5941",
      flexShrink: 0,
    },
    taskName: {
      flex: 1,
    },
    taskRemove: {
      background: "transparent",
      border: "none",
      fontSize: 14,
      color: "#9a9a92",
      cursor: "pointer",
      padding: "0 4px",
      lineHeight: 1,
      fontFamily: "'Inter', sans-serif",
    },
    input: {
      width: "100%",
      border: "1px solid #d8d4c8",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif",
      color: "#1a1a18",
      marginBottom: 20,
    },
    bottomRow: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
    },
    secondaryBtn: {
      background: "transparent",
      border: "1px solid #d8d4c8",
      borderRadius: 10,
      padding: "10px 20px",
      color: "#5c5c54",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      fontWeight: 500,
    },
    primaryBtn: {
      background: "#3d5941",
      border: "none",
      borderRadius: 10,
      padding: "10px 20px",
      color: "#ffffff",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      transition: "opacity 0.15s",
    },
    primaryBtnDisabled: {
      background: "#3d5941",
      border: "none",
      borderRadius: 10,
      padding: "10px 20px",
      color: "#ffffff",
      fontSize: 14,
      fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      opacity: 0.4,
      cursor: "not-allowed",
    },
  };

  return (
    <div style={styles.outer}>
      <div style={styles.card}>
        <h1 style={styles.header}>{getGreeting()}</h1>
        <p style={styles.subtitle}>What's on your plate today?</p>

        {yesterdayTasks.length > 0 && (
          <div>
            <div style={styles.yesterdayLabel}>Yesterday's tasks</div>
            <div style={styles.chipsRow}>
              {yesterdayTasks.map((task) => (
                <button
                  key={task}
                  style={styles.chip}
                  onMouseEnter={(e) => (e.target.style.background = "#eae6de")}
                  onMouseLeave={(e) => (e.target.style.background = "#f4f1ea")}
                  onClick={() => handleChipClick(task)}
                >
                  {task}
                </button>
              ))}
            </div>
          </div>
        )}

        {addedTasks.length > 0 && (
          <ul style={styles.taskList}>
            {addedTasks.map((task) => (
              <li key={task} style={styles.taskItem}>
                <span style={styles.taskDot} />
                <span style={styles.taskName}>{task}</span>
                <button
                  style={styles.taskRemove}
                  onClick={() => removeTask(task)}
                  title="Remove task"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          placeholder="Add a new task..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div style={styles.bottomRow}>
          <button style={styles.secondaryBtn} onClick={handleStartFresh}>
            Start fresh
          </button>
          <button
            style={
              addedTasks.length > 0
                ? styles.primaryBtn
                : styles.primaryBtnDisabled
            }
            disabled={addedTasks.length === 0}
            onClick={handleLetsGo}
          >
            Let's go
          </button>
        </div>
      </div>
    </div>
  );
}
