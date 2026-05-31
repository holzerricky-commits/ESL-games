/**
 * One-time dev script: compact bigram list for Writing Assist.
 * Run: node scripts/build-writing-assist-bigrams.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'node_modules/symspell-ts/data/frequency_bigramdictionary_en_243_342.txt')
const out = path.join(root, 'public/writing-assist/en-us-bigrams.json')

const MAX_PAIRS = 30000
const lines = fs.readFileSync(src, 'utf8').trim().split('\n')
const pairs = []

for (const line of lines) {
  const i = line.lastIndexOf(' ')
  if (i <= 0) continue
  const phrase = line.slice(0, i)
  const count = Number(line.slice(i + 1))
  if (!phrase || !Number.isFinite(count)) continue
  const words = phrase.split(/\s+/)
  if (words.length !== 2) continue
  pairs.push([words[0].toLowerCase(), words[1].toLowerCase(), count])
  if (pairs.length >= MAX_PAIRS) break
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(pairs))
console.log('Wrote', pairs.length, 'bigrams to', out, 'bytes', fs.statSync(out).size)
