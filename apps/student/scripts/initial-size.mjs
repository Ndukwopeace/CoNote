/**
 * Fails when the JavaScript the browser downloads at startup is over budget. size-limit measures
 * only the entry file, but the build splits shared code into chunks that index.html preloads, so
 * the real startup cost is the entry plus those chunks. Lazy route chunks and the Supabase chunk
 * are not in index.html and are not counted: they load only when needed.
 */

// Reading the built page and files.
import { readFileSync } from 'node:fs'
// Compressing, to measure what the network would carry.
import { gzipSync } from 'node:zlib'

// The budget, in kilobytes of gzipped JavaScript. Matches the entry-chunk budget in .size-limit.json.
const BUDGET_KB = 250

// The built page lists the entry script and the chunks it preloads.
const html = readFileSync('dist/index.html', 'utf8')
// Every script address the page loads at startup, once each.
const files = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]*\.js)"/g)].map((m) => m[1]))

// Add up the compressed size of each file.
let totalBytes = 0
for (const file of files) totalBytes += gzipSync(readFileSync(`dist/${file}`)).length

// Kilobytes with one decimal, as size-limit prints them.
const totalKb = Math.round((totalBytes / 1024) * 10) / 10
console.log(
  `Initial JavaScript (entry + preloaded chunks): ${String(totalKb)} kB gzipped, limit ${String(BUDGET_KB)} kB, ${String(files.size)} files`,
)

// Over budget: fail the build.
if (totalKb > BUDGET_KB) {
  console.error('Over budget.')
  process.exit(1)
}
