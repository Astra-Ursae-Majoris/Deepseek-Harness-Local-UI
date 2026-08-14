/** DSH installation detection and validation. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Candidate DSH checkouts probed in order:
 * 1. The DSH_HOME environment variable.
 * 2. A harness/ checkout bundled next to this desktop app (repo layout:
 *    Deepseek-Harness-Local-UI desktop + harness/ sibling, or harness/
 *    next to the app executable).
 * 3. The conventional C:/harness location (Windows).
 */
export function candidateInstallDirs(appDir?: string): string[] {
  const candidates: string[] = []
  const envHome = process.env.DSH_HOME
  if (envHome) candidates.push(envHome)
  const anchors = [
    appDir,
    appDir ? dirname(appDir) : undefined,
    dirname(fileURLToPath(import.meta.url)),
    process.cwd(),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)
  for (const anchor of anchors) {
    candidates.push(join(anchor, 'harness'))
    candidates.push(join(anchor, 'deepseek-harness-master'))
  }
  candidates.push('C:\\harness')
  return [...new Set(candidates)]
}

/**
 * Whether a directory looks like a runnable DSH checkout: the root
 * package.json names the dsh root and the CLI source/bin entry exists.
 */
export function isDshInstallDir(dir: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: unknown }
    if (manifest.name !== '@deepseek-ai/dsh-root') return false
    return existsSync(join(dir, 'apps', 'cli', 'src', 'bin.ts'))
      || existsSync(join(dir, 'apps', 'cli', 'lib', 'index.js'))
  } catch {
    return false
  }
}

/** First existing candidate, or null when none validates. */
export function detectInstallDir(candidates?: readonly string[]): string | null {
  for (const dir of candidates ?? candidateInstallDirs()) {
    if (isDshInstallDir(dir)) return dir
  }
  return null
}
