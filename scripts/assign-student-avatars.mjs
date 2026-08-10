/**
 * Downloads DiceBear avatars for every student in data/students/students.json
 * when the PNG file is missing under public/student-avatars/.
 * Run: node scripts/assign-student-avatars.mjs
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const studentsPath = path.join(root, 'data', 'students', 'students.json')
const avatarsDir = path.join(root, 'public', 'student-avatars')

const STYLES = ['fun-emoji', 'lorelei', 'adventurer', 'adventurer-neutral', 'micah', 'big-smile']
const BACKGROUNDS = ['fff4e6', 'ffd5dc', 'e0f4ff', 'e8f5e9', 'f3e8ff', 'fff9c4', 'ffe0f0', 'e8eaf6', 'fce4ec', 'e0f2f1']

function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickFrom(items, hash) {
  return items[hash % items.length]
}

function buildSpec(studentId, name) {
  const key = `${studentId}:${name.trim().toLowerCase()}`
  const hash = hashString(key)
  return {
    style: pickFrom(STYLES, hash),
    seed: `${studentId}-${name.trim().toLowerCase().replace(/\s+/g, '-')}`,
    bg: pickFrom(BACKGROUNDS, hash >>> 8),
  }
}

function dicebearPngUrl({ style, seed, bg }) {
  const params = new URLSearchParams({
    seed,
    size: '256',
    backgroundColor: bg,
  })
  return `https://api.dicebear.com/9.x/${style}/png?${params}`
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function downloadAvatar(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(destPath, buf)
}

async function main() {
  await mkdir(avatarsDir, { recursive: true })
  const raw = await readFile(studentsPath, 'utf8')
  const students = JSON.parse(raw)
  if (!Array.isArray(students)) throw new Error('students.json must be an array')

  let updated = 0
  let skipped = 0
  for (const student of students) {
    if (!student?.id || !student?.name) continue
    const fileName = `${student.id}.png`
    const publicPath = `/student-avatars/${fileName}`
    const diskPath = path.join(avatarsDir, fileName)
    if (await fileExists(diskPath)) {
      if (student.avatarUrl !== publicPath) {
        student.avatarUrl = publicPath
        student.updatedAt = new Date().toISOString()
        updated += 1
      } else {
        skipped += 1
      }
      continue
    }

    const spec = buildSpec(student.id, student.name)
    const url = dicebearPngUrl(spec)
    console.log(`Downloading ${student.name} → ${fileName}`)
    await downloadAvatar(url, diskPath)
    student.avatarUrl = publicPath
    student.updatedAt = new Date().toISOString()
    updated += 1
  }

  await writeFile(studentsPath, JSON.stringify(students, null, 2), 'utf8')
  console.log(`Done. Updated ${updated} student(s), skipped ${skipped} existing file(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
