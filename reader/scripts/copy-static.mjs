// Copia os arquivos estáticos da janela (HTML/CSS) para dist/renderer.
import { copyFileSync, mkdirSync } from 'node:fs'
mkdirSync('dist/renderer', { recursive: true })
for (const file of ['index.html', 'styles.css']) copyFileSync(`src/renderer/${file}`, `dist/renderer/${file}`)
