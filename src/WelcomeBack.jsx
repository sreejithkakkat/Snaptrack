import { useState, useEffect } from "react";

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

const fadeKeyframes = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

const styleTag = document.createElement("style");
styleTag.textContent = fadeKeyframes;
document.head.appendChild(styleTag);

export default function WelcomeBack() {
  const [taskName, setTaskName] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.tempo.onAutoAwayReturn((data) => {
      setTaskName(data?.taskName || null);
    });
    // Trigger fade-in on mount
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleResume = () => {
    window.tempo.imBack();
    window.tempo.closeWelcomeBack();
  };

  const handleNotNow = () => {
    window.tempo.closeWelcomeBack();
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
      width: 340,
      background: "#ffffff",
      borderRadius: 16,
      boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      padding: 28,
      boxSizing: "border-box",
      textAlign: "center",
      animation: visible ? "fadeInUp 0.35s ease-out forwards" : "none",
      opacity: visible ? 1 : 0,
    },
    icon: {
      fontSize: 28,
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      color: "#1a1a18",
      margin: "0 0 6px 0",
    },
    subtitle: {
      fontSize: 13,
      color: "#9a9a92",
      margin: 0,
    },
    taskInfo: {
      fontSize: 13,
      color: "#5c5c54",
      marginTop: 8,
    },
    taskNameBold: {
      fontWeight: 600,
    },
    buttonsRow: {
      display: "flex",
      justifyContent: "center",
      gap: 10,
      marginTop: 20,
    },
    secondaryBtn: {
      background: "transparent",
      border: "1px solid #d8d4c8",
      borderRadius: 10,
      padding: "9px 20px",
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
      padding: "9px 20px",
      color: "#ffffff",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
    },
  };

  return (
    <div style={styles.outer}>
      <div style={styles.card}>
        <div style={styles.icon}>👋</div>
        <h1 style={styles.title}>Welcome back!</h1>
        <p style={styles.subtitle}>Away time was not counted.</p>
        {taskName && (
          <p style={styles.taskInfo}>
            Resume working on <span style={styles.taskNameBold}>{taskName}</span>?
          </p>
        )}
        <div style={styles.buttonsRow}>
          <button style={styles.secondaryBtn} onClick={handleNotNow}>
            Not now
          </button>
          <button style={styles.primaryBtn} onClick={handleResume}>
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
