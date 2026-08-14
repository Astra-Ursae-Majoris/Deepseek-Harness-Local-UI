// Copies non-TS assets into dist/ after tsc.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
mkdirSync(dist, { recursive: true })
copyFileSync(join(here, '..', 'src', 'welcome.html'), join(dist, 'welcome.html'))
copyFileSync(join(here, '..', 'src', 'model-manager.html'), join(dist, 'model-manager.html'))
console.log('copied welcome.html + model-manager.html -> dist/')
