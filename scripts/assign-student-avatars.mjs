/**
 * Downloads cute DiceBear avatars and writes avatarUrl onto each student in data/students/students.json.
 * Run: node scripts/assign-student-avatars.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const studentsPath = path.join(root, 'data', 'students', 'students.json')
const avatarsDir = path.join(root, 'public', 'student-avatars')

/** style, seed, background hex (no #) — one cute look per student */
const AVATAR_BY_STUDENT_ID = {
  stu_po0okz4fmnqbgdqo: { style: 'fun-emoji', seed: 'bubi', bg: 'fff4e6' },
  stu_lu1ogztrmo5xlcr5: { style: 'lorelei', seed: 'cara', bg: 'ffd5dc' },
  stu_wu8oz216mo5xlnxl: { style: 'adventurer', seed: 'cassie', bg: 'e0f4ff' },
  stu_0ewx114emo5xlu68: { style: 'adventurer-neutral', seed: 'yushang', bg: 'e8f5e9' },
  stu_2pc6oefsmo5xm9cx: { style: 'lorelei', seed: 'eliana', bg: 'f3e8ff' },
  stu_niolc700mo5xmhlb: { style: 'micah', seed: 'linda', bg: 'fff9c4' },
  stu_whwsvzf9mo5xmo3n: { style: 'big-smile', seed: 'ella', bg: 'ffe0f0' },
}

function dicebearPngUrl({ style, seed, bg }) {
  const params = new URLSearchParams({
    seed,
    size: '256',
    backgroundColor: bg,
  })
  return `https://api.dicebear.com/9.x/${style}/png?${params}`
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
  for (const student of students) {
    const spec = AVATAR_BY_STUDENT_ID[student.id]
    if (!spec) continue
    const fileName = `${student.id}.png`
    const publicPath = `/student-avatars/${fileName}`
    const diskPath = path.join(avatarsDir, fileName)
    const url = dicebearPngUrl(spec)
    console.log(`Downloading ${student.name} → ${fileName}`)
    await downloadAvatar(url, diskPath)
    student.avatarUrl = publicPath
    student.updatedAt = new Date().toISOString()
    updated += 1
  }

  await writeFile(studentsPath, JSON.stringify(students, null, 2), 'utf8')
  console.log(`Done. Updated ${updated} student(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
