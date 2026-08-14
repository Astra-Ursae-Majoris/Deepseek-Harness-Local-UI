/** Server manager: probe, spawn, and stop the local DSH web server. */
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

export type ServerStatus = 'stopped' | 'starting' | 'running'

export interface ServerStartOptions {
  installDir: string
  port: number
  /** DSH_HOME override (tests use an isolated copy; production leaves it unset). */
  dshHome?: string | undefined
  onLog: (line: string) => void
  /** Called whenever the server leaves the running state (exit or stop). */
  onExit?: (() => void) | undefined
}

const READY_POLL_MS = 600
const READY_TIMEOUT_MS = 90_000

/** Probe one server URL; true when any HTTP response arrives. */
export async function probe(url: string, timeoutMs = 800): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
      return response.status >= 200 && response.status < 500
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

export class ServerManager {
  private child: ChildProcess | null = null
  private statusValue: ServerStatus = 'stopped'
  private lastPort = 0
  private lastUrl = ''

  get status(): ServerStatus {
    return this.statusValue
  }

  get url(): string {
    return this.lastUrl
  }

  /** Probe the configured address without touching a child process. */
  async isRunning(port: number): Promise<boolean> {
    return probe(`http://127.0.0.1:${port}/`)
  }

  /**
   * Re-evaluate the live status from the port: our own child wins; an
   * externally running server counts as running too, so the UI mirrors
   * reality instead of only tracking the child we spawned.
   */
  async refresh(port: number): Promise<ServerStatus> {
    if (this.child !== null) {
      this.statusValue = this.statusValue === 'starting' ? 'starting' : 'running'
      return this.statusValue
    }
    this.statusValue = (await this.isRunning(port)) ? 'running' : 'stopped'
    return this.statusValue
  }

  /** PID of the process listening on the port (external instance), or null. */
  findPortOwner(port: number): number | null {
    try {
      const lines = execFileSync('netstat', ['-ano', '-p', 'tcp'], { windowsHide: true, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(line => line.includes(`127.0.0.1:${port}`) && line.includes('LISTENING'))
      if (lines.length === 0) return null
      const pid = Number(lines[0]?.trim().split(/\s+/).at(-1))
      return Number.isInteger(pid) && pid > 0 ? pid : null
    } catch {
      return null
    }
  }

  /** Kill an external process owning the port, when it is a node server. */
  stopExternal(port: number): boolean {
    const pid = this.findPortOwner(port)
    if (pid === null) return false
    try {
      const name = execFileSync('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh'], {
        windowsHide: true,
        encoding: 'utf8',
      })
      if (!name.toLowerCase().includes('node.exe')) return false
      const result = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
      return result.status === 0
    } catch {
      return false
    }
  }

  /**
   * Start the DSH web server in the background and wait until it answers.
   * Fails loud (throws) when the install dir is invalid, the port is
   * occupied by something else, or readiness times out.
   */
  async start(options: ServerStartOptions): Promise<void> {
    if (this.child !== null) return
    this.statusValue = 'starting'
    this.lastPort = options.port
    this.lastUrl = `http://127.0.0.1:${options.port}`
    const bin = join(options.installDir, 'apps', 'cli', 'src', 'bin.ts')
    const args = ['--import', 'tsx/esm', bin, 'web', '--host', '127.0.0.1', '--port', String(options.port)]
    const child = spawn('node', args, {
      cwd: options.installDir,
      windowsHide: true,
      // Detached: the server outlives this app, so "keep running in the
      // background and exit" leaves a live service behind.
      detached: true,
      env: {
        ...process.env,
        ...(options.dshHome === undefined ? {} : { DSH_HOME: options.dshHome }),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    child.stdout?.on('data', (chunk: Buffer) => { options.onLog(chunk.toString()) })
    child.stderr?.on('data', (chunk: Buffer) => { options.onLog(chunk.toString()) })
    // The log pipes break when this app exits; the server must not crash on
    // the EPIPE. Swallow the stream errors (logs are best-effort anyway).
    child.stdout?.on('error', () => {})
    child.stderr?.on('error', () => {})
    child.on('exit', (code, signal) => {
      if (this.child === child) {
        this.child = null
        this.statusValue = 'stopped'
        options.onLog(`server exited (code ${String(code)} signal ${String(signal)})`)
        options.onExit?.()
      }
    })
    const deadline = Date.now() + READY_TIMEOUT_MS
    for (;;) {
      if (this.child === null) {
        this.statusValue = 'stopped'
        throw new Error('服务启动失败：进程提前退出，请查看日志')
      }
      if (await this.isRunning(options.port)) {
        this.statusValue = 'running'
        return
      }
      if (Date.now() > deadline) {
        this.stop()
        throw new Error(`服务启动超时（${READY_TIMEOUT_MS / 1000} 秒内未就绪）`)
      }
      await new Promise(resolve => setTimeout(resolve, READY_POLL_MS))
    }
  }

  /** Stop the server: our child tree when we own it, else the external port owner. */
  stop(port?: number): void {
    const child = this.child
    this.child = null
    this.statusValue = 'stopped'
    if (child !== null && child.pid !== undefined) {
      // Windows: kill the tree (the CLI spawns child workers).
      const result = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      if (result.error !== undefined || result.status !== 0) {
        // Fallback: signal the direct child.
        child.kill()
      }
      return
    }
    if (port !== undefined) this.stopExternal(port)
  }
}
