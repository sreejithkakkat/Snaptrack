const {
  app, BrowserWindow, Tray, Menu, globalShortcut,
  ipcMain, nativeImage, screen, powerMonitor,
} = require("electron");
const path = require("path");
const fs = require("fs");

// ── Simple JSON Store ──────────────────────────────────────────────────────────
class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    try { this.data = JSON.parse(fs.readFileSync(filePath, "utf8")); } catch {}
  }
  get(key) { return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null; }
  set(key, value) { this.data[key] = value; this._save(); }
  delete(key) { delete this.data[key]; this._save(); }
  keys(prefix = "") { return Object.keys(this.data).filter(k => k.startsWith(prefix)); }
  _save() { try { fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2)); } catch {} }
}

// ── Globals ────────────────────────────────────────────────────────────────────
let store;
let tray;
let mainWindow, widgetWindow, quickSwitchWindow, startOfDayWindow, welcomeBackWindow;
let isQuitting = false;
let autoAwayTriggered = false;

const isDev = !app.isPackaged;
const VITE_URL = "http://localhost:5173";

// ── Helpers ────────────────────────────────────────────────────────────────────
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const pad = n => String(n).padStart(2, "0");
const hms = s => {
  s = Math.max(0, Math.floor(s));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const shortT = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m` : s > 0 ? `${s}s` : "";
};

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

// ── State management ───────────────────────────────────────────────────────────
function getDayKey(dateStr) { return `day:${dateStr || todayStr()}`; }

const EMPTY_DAY = { tasks: [], phase: "planning", activeTask: null, sessionStart: null, isAway: false, awayStart: null };

function loadDay(dateStr) {
  if (!store) return { ...EMPTY_DAY };
  return store.get(getDayKey(dateStr)) || { ...EMPTY_DAY };
}

function saveDay(data, dateStr) {
  if (!store) return;
  store.set(getDayKey(dateStr), data);
  if (!dateStr || dateStr === todayStr()) {
    broadcastState(data);
    updateTrayMenu(data);
  }
}

function broadcastState(data) {
  const payload = data || loadDay();
  const windows = [mainWindow, widgetWindow, quickSwitchWindow, startOfDayWindow, welcomeBackWindow];
  for (const w of windows) {
    if (w && !w.isDestroyed()) {
      try { w.webContents.send("state-update", payload); } catch {}
    }
  }
}

function flushActive(d) {
  if (!d.activeTask || !d.sessionStart) return d.tasks;
  const el = Math.floor((Date.now() - d.sessionStart) / 1000);
  return d.tasks.map(t => t.id === d.activeTask ? { ...t, seconds: t.seconds + el } : t);
}

function getLive(task, d) {
  if (!d.isAway && d.activeTask === task.id && d.sessionStart) {
    return task.seconds + Math.floor((Date.now() - d.sessionStart) / 1000);
  }
  return task.seconds;
}

// ── Window helpers ─────────────────────────────────────────────────────────────
async function loadWindowContent(win, htmlFile) {
  if (isDev) {
    const url = `${VITE_URL}/${htmlFile}`;
    for (let i = 0; i < 60; i++) {
      try { await win.loadURL(url); return; }
      catch { await new Promise(r => setTimeout(r, 500)); }
    }
  } else {
    await win.loadFile(path.join(__dirname, "dist", htmlFile));
  }
}

// ── Tray icon generation ───────────────────────────────────────────────────────
function createTrayIcon() {
  // 16x16 clock icon as base64 PNG
  // Generated: green circle with clock hands on transparent background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="7" fill="#3d5941"/>
    <circle cx="8" cy="8" r="5.5" fill="white"/>
    <line x1="8" y1="8" x2="8" y2="4.5" stroke="#3d5941" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="8" y1="8" x2="11" y2="9.5" stroke="#3d5941" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="8" cy="8" r="0.8" fill="#3d5941"/>
  </svg>`;

  // Convert SVG to data URL — we'll render via a hidden window
  return null; // Will be set async
}

async function generateTrayIconAsync() {
  const win = new BrowserWindow({
    show: false, width: 64, height: 64,
    webPreferences: { offscreen: true },
  });

  await win.loadURL(`data:text/html;charset=utf-8,
    <canvas id="c" width="32" height="32" style="background:transparent"></canvas>
    <script>
      const c=document.getElementById("c").getContext("2d");
      c.clearRect(0,0,32,32);
      c.beginPath();c.arc(16,16,14,0,Math.PI*2);c.fillStyle="#3d5941";c.fill();
      c.beginPath();c.arc(16,16,11,0,Math.PI*2);c.fillStyle="white";c.fill();
      c.strokeStyle="#3d5941";c.lineWidth=2.2;c.lineCap="round";
      c.beginPath();c.moveTo(16,16);c.lineTo(16,7);c.stroke();
      c.beginPath();c.moveTo(16,16);c.lineTo(22,19);c.stroke();
      c.beginPath();c.arc(16,16,1.5,0,Math.PI*2);c.fillStyle="#3d5941";c.fill();
    </script>
  `);

  await new Promise(r => setTimeout(r, 200));
  const image = await win.webContents.capturePage();
  win.destroy();
  return image.resize({ width: 16, height: 16 });
}

// ── Window creation ────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820,
    minWidth: 960, minHeight: 640,
    show: false,
    title: "SnapTrack",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  loadWindowContent(mainWindow, "index.html");
}

function createWidgetWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const margin = 20;
  const w = 260;
  const h = 44;

  widgetWindow = new BrowserWindow({
    width: w, height: h,
    x: sw - w - margin,
    y: sh - h - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  widgetWindow.setAlwaysOnTop(true, "screen-saver");
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  loadWindowContent(widgetWindow, "widget.html");
  widgetWindow.show();
}

function createQuickSwitchWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  quickSwitchWindow = new BrowserWindow({
    width: 600, height: 400,
    x: Math.round((sw - 600) / 2),
    y: Math.round((sh - 400) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  quickSwitchWindow.setAlwaysOnTop(true, "screen-saver");
  loadWindowContent(quickSwitchWindow, "quickswitch.html");
}

function createStartOfDayWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  startOfDayWindow = new BrowserWindow({
    width: 440, height: 380,
    x: Math.round((sw - 440) / 2),
    y: Math.round((sh - 380) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindowContent(startOfDayWindow, "startofday.html");
}

function createWelcomeBackWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  welcomeBackWindow = new BrowserWindow({
    width: 380, height: 200,
    x: Math.round((sw - 380) / 2),
    y: Math.round((sh - 200) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindowContent(welcomeBackWindow, "welcomeback.html");
}

// ── IPC handlers ───────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle("get-day-data", (_e, key) => {
    if (key) return store.get(key) || null;
    return loadDay();
  });

  ipcMain.handle("save-day-data", (_e, key, data) => {
    store.set(key, data);
    // If saving today, broadcast
    if (key === getDayKey()) broadcastState(data);
    updateTrayMenu(key === getDayKey() ? data : null);
    return true;
  });

  ipcMain.handle("list-days", (_e, prefix) => {
    return store.keys(prefix || "day:");
  });

  ipcMain.handle("switch-task", (_e, id) => {
    let d = loadDay();
    if (d.isAway) { d = { ...d, isAway: false, awayStart: null }; autoAwayTriggered = false; }
    const now = Date.now();
    const flushed = flushActive(d);
    const alreadyActive = d.activeTask === id;
    const next = {
      ...d,
      tasks: flushed.map(t => t.id === id && !alreadyActive ? { ...t, switches: (t.switches || 0) + 1 } : t),
      activeTask: alreadyActive ? null : id,
      sessionStart: alreadyActive ? null : now,
    };
    saveDay(next);
    return next;
  });

  ipcMain.handle("pause-resume", () => {
    let d = loadDay();
    if (d.isAway) { d = { ...d, isAway: false, awayStart: null }; autoAwayTriggered = false; }
    const now = Date.now();
    let next;
    if (d.activeTask && d.sessionStart) {
      next = { ...d, tasks: flushActive(d), sessionStart: null };
    } else if (d.activeTask) {
      next = { ...d, sessionStart: now };
    } else if (d.tasks.length) {
      next = { ...d, activeTask: d.tasks[0].id, sessionStart: now };
    } else {
      return d;
    }
    saveDay(next);
    return next;
  });

  ipcMain.handle("go-away", () => {
    const d = loadDay();
    const next = {
      ...d,
      tasks: flushActive(d),
      sessionStart: null,
      isAway: true,
      awayStart: Date.now(),
    };
    saveDay(next);
    return next;
  });

  ipcMain.handle("im-back", () => {
    const d = loadDay();
    const next = {
      ...d,
      isAway: false,
      awayStart: null,
      sessionStart: d.activeTask ? Date.now() : null,
    };
    saveDay(next);
    autoAwayTriggered = false;
    return next;
  });

  ipcMain.handle("add-task", (_e, name) => {
    if (!name || !name.trim()) return loadDay();
    const d = loadDay();
    const newTask = {
      id: Date.now().toString(),
      name: name.trim(),
      seconds: 0,
      colorIdx: d.tasks.length % COLORS.length,
    };
    const next = { ...d, tasks: [...d.tasks, newTask] };
    saveDay(next);
    return next;
  });

  ipcMain.handle("add-task-to-date", (_e, dateStr, name, groupId) => {
    if (!name || !name.trim()) return null;
    const d = loadDay(dateStr);
    const newTask = {
      id: `${Date.now()}_${dateStr}`,
      name: name.trim(),
      seconds: 0,
      colorIdx: d.tasks.length % COLORS.length,
      ...(groupId ? { groupId } : {}),
    };
    const next = { ...d, tasks: [...d.tasks, newTask] };
    saveDay(next, dateStr);
    return next;
  });

  ipcMain.handle("get-group-total", (_e, groupId) => {
    if (!groupId) return null;
    const keys = store.keys("day:");
    let totalSeconds = 0, dayCount = 0;
    for (const k of keys) {
      const d = store.get(k);
      if (!d?.tasks) continue;
      for (const t of d.tasks) {
        if (t.groupId === groupId) {
          totalSeconds += t.seconds;
          dayCount++;
        }
      }
    }
    return { totalSeconds, dayCount };
  });

  ipcMain.handle("start-work", () => {
    const d = loadDay();
    if (!d.tasks.length) return d;
    const next = {
      ...d,
      phase: "working",
      activeTask: d.tasks[0].id,
      sessionStart: Date.now(),
    };
    saveDay(next);
    return next;
  });

  ipcMain.handle("wrap-up-day", () => {
    const d = loadDay();
    const next = {
      ...d,
      tasks: flushActive(d),
      phase: "wrapped",
      activeTask: null,
      sessionStart: null,
      isAway: false,
      awayStart: null,
    };
    saveDay(next);
    return next;
  });

  ipcMain.handle("edit-task-time", (_e, taskId, newSeconds) => {
    const d = loadDay();
    const wasRunning = d.activeTask === taskId && d.sessionStart && !d.isAway;
    const next = {
      ...d,
      tasks: flushActive(d).map(t => t.id === taskId ? { ...t, seconds: Math.max(0, newSeconds) } : t),
      sessionStart: wasRunning ? Date.now() : d.sessionStart,
    };
    saveDay(next);
    return next;
  });

  // Window management
  ipcMain.handle("open-main-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle("hide-main-window", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  });

  ipcMain.handle("close-quickswitch", () => {
    if (quickSwitchWindow && !quickSwitchWindow.isDestroyed()) quickSwitchWindow.hide();
  });

  ipcMain.handle("close-startofday", () => {
    if (startOfDayWindow && !startOfDayWindow.isDestroyed()) startOfDayWindow.hide();
  });

  ipcMain.handle("close-welcomeback", () => {
    if (welcomeBackWindow && !welcomeBackWindow.isDestroyed()) welcomeBackWindow.hide();
  });

  ipcMain.handle("widget-set-expanded", (_e, expanded) => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const margin = 20;
    const w = 260;
    let h = 44;
    if (expanded) {
      const d = loadDay();
      const taskCount = d.tasks.length || 1;
      // 44 pill + 4 gap + away banner(~40) + (taskCount * 38) rows + 42 input row + 44 action bar + 8 padding
      h = Math.min(420, 44 + 4 + 40 + taskCount * 38 + 42 + 44 + 8);
    }
    widgetWindow.setBounds({
      x: sw - w - margin,
      y: sh - h - margin,
      width: w,
      height: h,
    });
  });
}

// ── Tray ───────────────────────────────────────────────────────────────────────
function updateTrayMenu(dayData) {
  if (!tray) return;
  const d = dayData || loadDay();
  const activeTask = d.tasks.find(t => t.id === d.activeTask);
  const isRunning = !!(d.activeTask && d.sessionStart && !d.isAway);

  // Update tooltip
  if (activeTask) {
    const secs = getLive(activeTask, d);
    tray.setToolTip(`SnapTrack — ${activeTask.name} ${hms(secs)}`);
  } else {
    tray.setToolTip("SnapTrack — No active task");
  }

  // Context menu
  const taskItems = d.tasks.map(t => ({
    label: `${d.activeTask === t.id ? "  " : "   "} ${t.name}  ${shortT(getLive(t, d))}`,
    type: "checkbox",
    checked: d.activeTask === t.id,
    click: () => {
      ipcMain.emit("switch-task-internal", t.id);
      const day = loadDay();
      if (day.isAway) return;
      const flushed = flushActive(day);
      const alreadyActive = day.activeTask === t.id;
      saveDay({
        ...day,
        tasks: flushed,
        activeTask: alreadyActive ? null : t.id,
        sessionStart: alreadyActive ? null : Date.now(),
      });
    },
  }));

  const template = [];

  if (activeTask) {
    template.push({
      label: `${activeTask.name} — ${hms(getLive(activeTask, d))}`,
      enabled: false,
    });
    template.push({ type: "separator" });
  }

  if (taskItems.length > 0) {
    template.push(...taskItems);
    template.push({ type: "separator" });
  }

  template.push({
    label: isRunning ? "Pause" : "Resume",
    click: () => {
      const day = loadDay();
      if (day.isAway) return;
      const now = Date.now();
      let next;
      if (day.activeTask && day.sessionStart) {
        next = { ...day, tasks: flushActive(day), sessionStart: null };
      } else if (day.activeTask) {
        next = { ...day, sessionStart: now };
      } else if (day.tasks.length) {
        next = { ...day, activeTask: day.tasks[0].id, sessionStart: now };
      } else return;
      saveDay(next);
    },
  });

  template.push({
    label: d.isAway ? "I'm Back" : "Away",
    click: () => {
      const day = loadDay();
      if (day.isAway) {
        saveDay({ ...day, isAway: false, awayStart: null, sessionStart: day.activeTask ? Date.now() : null });
        autoAwayTriggered = false;
      } else {
        saveDay({ ...day, tasks: flushActive(day), sessionStart: null, isAway: true, awayStart: Date.now() });
      }
    },
  });

  template.push({ type: "separator" });

  template.push({
    label: "Open SnapTrack",
    click: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    },
  });

  template.push({
    label: "Quit",
    click: () => {
      isQuitting = true;
      app.quit();
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ── Global shortcuts ───────────────────────────────────────────────────────────
function registerShortcuts() {
  // Ctrl+Shift+Space — Quick Switch
  globalShortcut.register("Ctrl+Shift+Space", () => {
    if (quickSwitchWindow && !quickSwitchWindow.isDestroyed()) {
      if (quickSwitchWindow.isVisible()) {
        quickSwitchWindow.hide();
      } else {
        quickSwitchWindow.webContents.send("show-quickswitch");
        quickSwitchWindow.show();
        quickSwitchWindow.focus();
      }
    }
  });

  // Ctrl+Shift+T — Toggle pause/resume
  globalShortcut.register("Ctrl+Shift+T", () => {
    const d = loadDay();
    if (d.isAway) return;
    const now = Date.now();
    let next;
    if (d.activeTask && d.sessionStart) {
      next = { ...d, tasks: flushActive(d), sessionStart: null };
    } else if (d.activeTask) {
      next = { ...d, sessionStart: now };
    } else if (d.tasks.length) {
      next = { ...d, activeTask: d.tasks[0].id, sessionStart: now };
    } else return;
    saveDay(next);
  });

  // Ctrl+Shift+A — Toggle away
  globalShortcut.register("Ctrl+Shift+A", () => {
    const d = loadDay();
    if (d.isAway) {
      saveDay({ ...d, isAway: false, awayStart: null, sessionStart: d.activeTask ? Date.now() : null });
      autoAwayTriggered = false;
    } else {
      saveDay({ ...d, tasks: flushActive(d), sessionStart: null, isAway: true, awayStart: Date.now() });
    }
  });
}

// ── Auto-away detection ────────────────────────────────────────────────────────
function setupAutoAway() {
  // Lock screen / suspend → go away
  powerMonitor.on("lock-screen", () => {
    const d = loadDay();
    if (!d.isAway && d.activeTask) {
      autoAwayTriggered = true;
      saveDay({ ...d, tasks: flushActive(d), sessionStart: null, isAway: true, awayStart: Date.now() });
    }
  });

  powerMonitor.on("suspend", () => {
    const d = loadDay();
    if (!d.isAway && d.activeTask) {
      autoAwayTriggered = true;
      saveDay({ ...d, tasks: flushActive(d), sessionStart: null, isAway: true, awayStart: Date.now() });
    }
  });

  // Unlock / resume → show welcome back if was auto-away
  powerMonitor.on("unlock-screen", () => showWelcomeBackIfNeeded());
  powerMonitor.on("resume", () => showWelcomeBackIfNeeded());

  // Idle detection — poll every 30 seconds
  setInterval(() => {
    const idleSecs = powerMonitor.getSystemIdleTime();
    if (idleSecs >= 600) { // 10 minutes
      const d = loadDay();
      if (!d.isAway && d.activeTask && d.sessionStart) {
        autoAwayTriggered = true;
        saveDay({ ...d, tasks: flushActive(d), sessionStart: null, isAway: true, awayStart: Date.now() });
      }
    }
  }, 30000);
}

function showWelcomeBackIfNeeded() {
  if (!autoAwayTriggered) return;
  const d = loadDay();
  if (!d.isAway) return;

  const activeTask = d.tasks.find(t => t.id === d.activeTask);
  if (welcomeBackWindow && !welcomeBackWindow.isDestroyed()) {
    welcomeBackWindow.webContents.send("auto-away-return", {
      taskName: activeTask ? activeTask.name : null,
    });
    welcomeBackWindow.show();
    welcomeBackWindow.focus();
  }
}

// ── Timer interval ─────────────────────────────────────────────────────────────
function startTimer() {
  setInterval(() => {
    const d = loadDay();
    const activeTask = d.tasks.find(t => t.id === d.activeTask);
    const isRunning = !!(d.activeTask && d.sessionStart && !d.isAway);

    // Update tray tooltip
    if (tray && activeTask) {
      const secs = getLive(activeTask, d);
      tray.setToolTip(`SnapTrack — ${activeTask.name} ${hms(secs)}`);
    }

    // Broadcast tick to widget for live timer
    const tickPayload = {
      activeTaskName: activeTask ? activeTask.name : null,
      activeTaskColor: activeTask ? getColor(activeTask) : null,
      activeTaskSecs: activeTask ? getLive(activeTask, d) : 0,
      isRunning,
      isAway: d.isAway,
      tasks: d.tasks.map(t => ({
        id: t.id,
        name: t.name,
        seconds: getLive(t, d),
        colorIdx: t.colorIdx,
        isActive: t.id === d.activeTask,
      })),
    };

    const windows = [widgetWindow, quickSwitchWindow];
    for (const w of windows) {
      if (w && !w.isDestroyed()) {
        try { w.webContents.send("tick", tickPayload); } catch {}
      }
    }
  }, 1000);
}

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Init store
  const storePath = path.join(app.getPath("userData"), "tempo-data.json");
  store = new JsonStore(storePath);

  // Set up IPC before creating windows
  setupIPC();

  // Generate tray icon
  let trayIcon;
  try {
    trayIcon = await generateTrayIconAsync();
  } catch {
    // Fallback: 16x16 empty icon
    trayIcon = nativeImage.createEmpty();
  }

  // Create tray
  tray = new Tray(trayIcon);
  tray.setToolTip("SnapTrack — Time Tracker");
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  updateTrayMenu();

  // Create windows
  createMainWindow();
  createWidgetWindow();
  createQuickSwitchWindow();
  createStartOfDayWindow();
  createWelcomeBackWindow();

  // Register global shortcuts
  registerShortcuts();

  // Auto-away detection
  setupAutoAway();

  // Start timer
  startTimer();

  // Always show main window on startup
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  }
});

app.on("window-all-closed", () => {
  // Don't quit on window close
});

app.on("before-quit", () => {
  isQuitting = true;
  try {
    const d = loadDay();
    if (d.activeTask && d.sessionStart) {
      saveDay({ ...d, tasks: flushActive(d), sessionStart: null });
    }
  } catch {}
  try { globalShortcut.unregisterAll(); } catch {}
});

// Single instance lock — must be before whenReady
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
