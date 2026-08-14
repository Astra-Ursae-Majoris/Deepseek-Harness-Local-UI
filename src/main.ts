/** DSH Desktop main process: window, server manager, gestures, security. */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, session, shell, Tray } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
import { classifyGesture, gestureHint, type GestureDirection } from './gestures.js'
import { detectInstallDir, isDshInstallDir } from './install-detect.js'
import { listProviderKeys, setProviderKey, unsetProviderKey } from './models.js'
import { ServerManager, type ServerStatus } from './server-manager.js'
import { loadSettings, saveSettings, type AppSettings } from './settings.js'
import { SIDEBAR_TOGGLE_JS, hintPillHtml } from './ui-bridge.js'
import { isAllowedAppUrl } from './url-policy.js'

const server = new ServerManager()
let settings: AppSettings = { ...loadSettings('') }
let mainWindow: BrowserWindow | null = null
let windowBounds: { width: number; height: number; x?: number; y?: number } | null = null
let tray: Tray | null = null
let serverLog: string[] = []
let installDir: string | null = null
let quitting = false

/** Resolve the install directory: stored choice, auto-detect, or null. */
function resolveInstallDir(): string | null {
  if (settings.installDir !== null && isDshInstallDir(settings.installDir)) return settings.installDir
  const detected = detectInstallDir()
  installDir = detected
  return detected
}

function currentUrl(): string {
  return `http://127.0.0.1:${settings.serverPort}/`
}

function log(line: string): void {
  serverLog = [...serverLog.slice(-200), line]
  mainWindow?.webContents.send('server:log', line)
}

function loadUi(): void {
  if (mainWindow === null) return
  const target = currentUrl()
  if (isAllowedAppUrl(target, settings.serverPort)) {
    void mainWindow.loadURL(target)
  } else {
    void mainWindow.loadFile(join(__dirname, 'welcome.html'))
  }
}

let modelWindow: BrowserWindow | null = null

/** Open (or focus) the model/API-key management window. */
function openModelWindow(): void {
  if (modelWindow !== null && !modelWindow.isDestroyed()) {
    modelWindow.show()
    modelWindow.focus()
    return
  }
  modelWindow = new BrowserWindow({
    width: 720,
    height: 620,
    minWidth: 520,
    minHeight: 420,
    title: '模型与 API 密钥管理',
    backgroundColor: '#f5f6f8',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  modelWindow.on('closed', () => { modelWindow = null })
  void modelWindow.loadFile(join(__dirname, 'model-manager.html'))
}

function createWindow(): void {
  const icon = join(__dirname, '..', 'assets', 'icon.png')
  const userData = app.getPath('userData')
  try {
    windowBounds = JSON.parse(readFileSync(join(userData, 'window.json'), 'utf8') as string) as typeof windowBounds
  } catch {
    windowBounds = null
  }
  mainWindow = new BrowserWindow({
    width: windowBounds?.width ?? 1200,
    height: windowBounds?.height ?? 800,
    ...(windowBounds?.x === undefined ? {} : { x: windowBounds.x }),
    ...(windowBounds?.y === undefined ? {} : { y: windowBounds.y }),
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness 桌面版',
    backgroundColor: '#f5f6f8',
    ...(existsSync(icon) ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow the boot navigation to our server; everything else opens outside.
    if (isAllowedAppUrl(url, settings.serverPort)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
  })

  // Deny every permission the page might request.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => { callback(false) })
  session.defaultSession.setPermissionCheckHandler(() => false)

  // Gestures from the preload: right-drag and side buttons.
  ipcMain.on('gesture', (_event, direction: GestureDirection) => {
    if (direction !== 'left' && direction !== 'right') return
    const wc = mainWindow?.webContents
    if (wc === undefined) return
    const hint = gestureHint(direction)
    void wc.executeJavaScript(`${SIDEBAR_TOGGLE_JS}; ${hint === null ? 'false' : hintPillHtml(hint)}`)
  })

  // Browser shortcuts the user does not want; keep reload/devtools/zoom.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const ctrl = input.control || input.meta
    if (!ctrl && !input.alt) return
    const key = input.key.toLowerCase()
    const blocked = ctrl && ['t', 'w', 'n', 'h', 'l'].includes(key)
    const blockedTab = ctrl && key === 'tab'
    const blockedDigits = ctrl && /^[1-9]$/.test(key)
    if (blocked || blockedTab || blockedDigits) {
      event.preventDefault()
      return
    }
    if (input.alt && (key === 'arrowleft' || key === 'arrowright')) {
      event.preventDefault()
      const wc = mainWindow?.webContents
      if (wc !== undefined) {
        const hint = key === 'arrowleft' ? '← 收起侧边栏' : '→ 展开侧边栏'
        void wc.executeJavaScript(`${SIDEBAR_TOGGLE_JS}; ${hintPillHtml(hint)}`)
      }
    }
  })

  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    void handleCloseRequest()
  })
  mainWindow.on('close', () => {
    if (mainWindow !== null && !mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds()
      windowBounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y }
      try {
        writeFileSync(join(app.getPath('userData'), 'window.json'), JSON.stringify(windowBounds), 'utf8')
      } catch {
        // Window-state persistence is best-effort.
      }
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })

  loadUi()
}

async function handleCloseRequest(): Promise<void> {
  if (mainWindow === null) return
  if (settings.closeBehavior === 'keep') {
    hideToTray()
    return
  }
  if (settings.closeBehavior === 'stop') {
    server.stop(settings.serverPort)
    quitApp()
    return
  }
  // Ask once, with an optional remember choice.
  const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['同时停止服务', '保持后台运行', '取消'],
    defaultId: 0,
    cancelId: 2,
    title: '退出 DeepSeek Harness 桌面版',
    message: '关闭窗口时如何处理后台服务？',
    detail: '选择"保持后台运行"后，应用会驻留系统托盘，浏览器仍可访问该服务。',
    checkboxLabel: '记住我的选择',
    checkboxChecked: false,
  })
  if (response === 2) return
  if (checkboxChecked) {
    settings = { ...settings, closeBehavior: response === 0 ? 'stop' : 'keep' }
    saveSettings(app.getPath('userData'), settings)
  }
  if (response === 0) server.stop(settings.serverPort)
  quitApp()
}

function hideToTray(): void {
  ensureTray()
  mainWindow?.hide()
}

function ensureTray(): void {
  if (tray !== null) return
  const iconPath = join(__dirname, '..', 'assets', 'icon.png')
  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('DeepSeek Harness 桌面版')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: '停止服务并退出', click: () => { server.stop(settings.serverPort); quitApp() } },
    { label: '保持服务后台运行并退出', click: () => { quitApp() } },
  ]))
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function quitApp(): void {
  quitting = true
  app.quit()
}

/** Short Chinese status label for menus and tray. */
function statusLabel(): string {
  if (server.status === 'running') return '服务运行中 ✅'
  if (server.status === 'starting') return '服务正在启动…'
  return '服务未运行'
}

/** Rebuild the application menu so the service items mirror live status. */
function buildMenu(): void {
  const running = server.status === 'running'
  const starting = server.status === 'starting'
  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '重新加载界面', accelerator: 'CmdOrCtrl+R', click: () => { mainWindow?.webContents.reload() } },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { server.stop(); quitApp() } },
      ],
    },
    {
      label: '模型',
      submenu: [
        { label: '模型与 API 密钥管理…', click: () => { openModelWindow() } },
      ],
    },
    {
      label: '服务',
      submenu: [
        { label: '● ' + statusLabel(), enabled: false },
        { type: 'separator' },
        { label: '启动服务', enabled: !running && !starting, click: () => { void startServerAndLoad() } },
        { label: '停止服务', enabled: running, click: () => { server.stop(settings.serverPort); refreshStatus(); notify('服务已停止') } },
        { label: '重启服务', enabled: running, click: () => { void restartServer() } },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: 'DeepSeek Harness 桌面版 0.1.0',
              detail: 'DSH Web GUI 的桌面壳：连接本地服务、手势操作、文件拖放。',
            })
          },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

/** Windows notification feedback for server actions. */
function notify(body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title: 'DeepSeek Harness 桌面版', body }).show()
  }
}

/** Refresh status surfaces (menu, tray, status IPC) after a change. */
function refreshStatus(): void {
  buildMenu()
  if (tray !== null) tray.setToolTip(`DeepSeek Harness 桌面版 — ${statusLabel()}`)
  mainWindow?.webContents.send('server:status-changed', { status: server.status, url: server.url || currentUrl() })
}

/** Probe the port and refresh every status surface with the real answer. */
async function probeAndRefreshStatus(): Promise<ServerStatus> {
  const status = await server.refresh(settings.serverPort)
  if (status !== server.status) {
    // The status setter in refresh() already updated server.status.
    refreshStatus()
  }
  return server.status
}

// Keep the menu/tray honest while the server changes behind our back.
setInterval(() => { void probeAndRefreshStatus() }, 3000)

async function startServerAndLoad(): Promise<void> {
  const dir = resolveInstallDir()
  if (dir === null) {
    const picked = await pickInstallDir()
    if (!picked.ok) return
  }
  const dir2 = resolveInstallDir()
  if (dir2 === null) return
  const alreadyUp = await probeAndRefreshStatus()
  if (alreadyUp === 'running') {
    notify('服务已在运行，已进入界面')
    loadUi()
    return
  }
  try {
    await server.start({ installDir: dir2, port: settings.serverPort, onLog: log, onExit: refreshStatus })
    notify('服务已启动：' + server.url)
    refreshStatus()
    loadUi()
  } catch (error) {
    refreshStatus()
    const message = error instanceof Error ? error.message : String(error)
    if (mainWindow !== null) {
      await mainWindow.webContents.executeJavaScript(
        `document.getElementById('msg') && (document.getElementById('msg').textContent = ${JSON.stringify(message)})`,
      )
    }
  }
}

async function restartServer(): Promise<void> {
  server.stop(settings.serverPort)
  await probeAndRefreshStatus()
  notify('正在重启服务…')
  await new Promise(resolve => setTimeout(resolve, 800))
  await startServerAndLoad()
}

async function pickInstallDir(): Promise<{ ok: boolean; dir?: string; message?: string }> {
  const result = await dialog.showOpenDialog({
    title: '选择 DSH 安装目录',
    properties: ['openDirectory'],
    defaultPath: installDir ?? app.getPath('home'),
  })
  const dir = result.filePaths[0]
  if (dir === undefined || dir === '') return { ok: false }
  if (!isDshInstallDir(dir)) {
    return { ok: false, message: '这不是有效的 DSH 安装目录（需包含 apps/cli 与 package.json）' }
  }
  settings = { ...settings, installDir: dir }
  saveSettings(app.getPath('userData'), settings)
  installDir = dir
  return { ok: true, dir }
}

// ---- Lifecycle ----

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    settings = loadSettings(app.getPath('userData'))
    installDir = resolveInstallDir()
    buildMenu()
    createWindow()
    // Auto-connect when the server is already running (the common case).
    void probeAndRefreshStatus().then(() => {
      if (server.status === 'running' && mainWindow !== null) loadUi()
    })
  })

  app.on('window-all-closed', () => {
    // Keep running in the tray when the server should stay up.
    if (server.status === 'running' || tray !== null) return
    app.quit()
  })

  app.on('before-quit', () => { quitting = true })
  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })
}

// ---- IPC ----

ipcMain.handle('server:status', () => ({
  status: server.status,
  url: server.url || currentUrl(),
  port: settings.serverPort,
}))

ipcMain.handle('server:start', async () => {
  try {
    await startServerAndLoad()
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('server:stop', () => {
  server.stop(settings.serverPort)
  void probeAndRefreshStatus()
  return { ok: true }
})

ipcMain.handle('server:pick-install-dir', async () => pickInstallDir())

ipcMain.handle('settings:set-close-behavior', (_event, behavior: 'ask' | 'stop' | 'keep') => {
  if (behavior === 'ask' || behavior === 'stop' || behavior === 'keep') {
    settings = { ...settings, closeBehavior: behavior }
    saveSettings(app.getPath('userData'), settings)
  }
})

ipcMain.handle('settings:get-close-behavior', () => settings.closeBehavior)

// ---- Model/API-key management ----

function serverBase(): string | null {
  if (server.status !== 'running') return null
  return `http://127.0.0.1:${settings.serverPort}`
}

ipcMain.handle('models:list', async () => {
  const base = serverBase()
  if (base === null) return { ok: false, error: { code: 'server-stopped', message: '服务未运行', details: {} } }
  return listProviderKeys(base)
})

ipcMain.handle('models:set-key', async (_event, ref: string, value: string) => {
  const base = serverBase()
  if (base === null) return { ok: false, error: { code: 'server-stopped', message: '服务未运行', details: {} } }
  if (typeof ref !== 'string' || typeof value !== 'string' || value === '') {
    return { ok: false, error: { code: 'bad-request', message: '密钥不能为空', details: {} } }
  }
  return setProviderKey(base, ref, value)
})

ipcMain.handle('models:unset-key', async (_event, ref: string) => {
  const base = serverBase()
  if (base === null) return { ok: false, error: { code: 'server-stopped', message: '服务未运行', details: {} } }
  if (typeof ref !== 'string') {
    return { ok: false, error: { code: 'bad-request', message: '无效的引用', details: {} } }
  }
  return unsetProviderKey(base, ref)
})
