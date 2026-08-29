import { cookies } from 'next/headers'
import { StudentsListPage } from '@/components/students/students-list-page'
import { readRosterPrefsFromDisk } from '@/lib/local-data/roster-prefs-disk-server'
import {
  parseStudentsRosterPrefsCookie,
  STUDENTS_ROSTER_PREFS_COOKIE,
} from '@/lib/students/students-roster-prefs'

export const dynamic = 'force-dynamic'

export default async function StudentsPage() {
  const cookieStore = await cookies()
  const fromCookie = parseStudentsRosterPrefsCookie(
    cookieStore.get(STUDENTS_ROSTER_PREFS_COOKIE)?.value,
  )
  const initialPrefs = fromCookie ?? (await readRosterPrefsFromDisk())

  return (
    <section>
      <StudentsListPage initialPrefs={initialPrefs} />
    </section>
  )
}
