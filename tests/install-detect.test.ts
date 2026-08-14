import { describe, expect, it } from 'vitest'
import { candidateInstallDirs, isDshInstallDir } from '../src/install-detect.ts'
import { join } from 'node:path'

describe('isDshInstallDir', () => {
  it('accepts the bundled harness checkout', () => {
    expect(isDshInstallDir(join(process.cwd(), 'harness'))).toBe(true)
  })
  it('rejects random directories and missing manifests', () => {
    expect(isDshInstallDir(process.cwd())).toBe(false)
    expect(isDshInstallDir('Z:\\does-not-exist')).toBe(false)
  })
})

describe('candidateInstallDirs', () => {
  it('probes DSH_HOME first, then harness siblings of the app anchor', () => {
    const env = process.env.DSH_HOME
    process.env.DSH_HOME = 'C:\\env-harness'
    try {
      const candidates = candidateInstallDirs('C:\\apps\\desktop')
      expect(candidates[0]).toBe('C:\\env-harness')
      expect(candidates).toContain('C:\\apps\\desktop\\harness')
      expect(candidates).toContain('C:\\apps\\harness')
      expect(candidates).toContain('C:\\harness')
      expect(new Set(candidates).size).toBe(candidates.length) // deduplicated
    } finally {
      if (env === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = env
    }
  })
})
