/** Persistent app settings (userData/settings.json). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type CloseBehavior = 'ask' | 'stop' | 'keep'

export interface AppSettings {
  /** Port of the DSH web server (default 3080). */
  serverPort: number
  /** DSH install directory; null lets the app auto-detect. */
  installDir: string | null
  /** What closing the window does. */
  closeBehavior: CloseBehavior
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverPort: 3080,
  installDir: null,
  closeBehavior: 'ask',
}

export function settingsPath(userData: string): string {
  return join(userData, 'settings.json')
}

export function loadSettings(userData: string): AppSettings {
  try {
    const raw = readFileSync(settingsPath(userData), 'utf8') as string
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      serverPort: typeof parsed.serverPort === 'number' ? parsed.serverPort : DEFAULT_SETTINGS.serverPort,
      installDir: typeof parsed.installDir === 'string' ? parsed.installDir : null,
      closeBehavior: parsed.closeBehavior === 'stop' || parsed.closeBehavior === 'keep'
        ? parsed.closeBehavior
        : 'ask',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(userData: string, settings: AppSettings): void {
  const path = settingsPath(userData)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8')
}
