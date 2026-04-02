const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tempo", {
  // Storage
  getDayData: (key) => ipcRenderer.invoke("get-day-data", key),
  saveDayData: (key, data) => ipcRenderer.invoke("save-day-data", key, data),
  listDays: (prefix) => ipcRenderer.invoke("list-days", prefix),

  // Actions (widget / quickswitch → main process → all windows)
  switchTask: (id) => ipcRenderer.invoke("switch-task", id),
  pauseResume: () => ipcRenderer.invoke("pause-resume"),
  goAway: () => ipcRenderer.invoke("go-away"),
  imBack: () => ipcRenderer.invoke("im-back"),
  addTask: (name) => ipcRenderer.invoke("add-task", name),
  addTaskToDate: (dateStr, name, groupId) => ipcRenderer.invoke("add-task-to-date", dateStr, name, groupId),
  getGroupTotal: (groupId) => ipcRenderer.invoke("get-group-total", groupId),
  startWork: () => ipcRenderer.invoke("start-work"),

  // Window management
  openMainWindow: () => ipcRenderer.invoke("open-main-window"),
  hideMainWindow: () => ipcRenderer.invoke("hide-main-window"),
  closeQuickSwitch: () => ipcRenderer.invoke("close-quickswitch"),
  closeStartOfDay: () => ipcRenderer.invoke("close-startofday"),
  closeWelcomeBack: () => ipcRenderer.invoke("close-welcomeback"),
  setWidgetExpanded: (expanded) => ipcRenderer.invoke("widget-set-expanded", expanded),

  // Events from main process
  onStateUpdate: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("state-update", handler);
    return () => ipcRenderer.removeListener("state-update", handler);
  },
  onTick: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("tick", handler);
    return () => ipcRenderer.removeListener("tick", handler);
  },
  onShowQuickSwitch: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("show-quickswitch", handler);
    return () => ipcRenderer.removeListener("show-quickswitch", handler);
  },
  onYesterdayTasks: (cb) => {
    const handler = (_e, tasks) => cb(tasks);
    ipcRenderer.on("yesterday-tasks", handler);
    return () => ipcRenderer.removeListener("yesterday-tasks", handler);
  },
  onAutoAwayReturn: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("auto-away-return", handler);
    return () => ipcRenderer.removeListener("auto-away-return", handler);
  },
});
