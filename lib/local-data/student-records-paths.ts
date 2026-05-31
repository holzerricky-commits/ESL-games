import { join } from 'node:path'

/** Local teacher data (not for serverless deploys). */
export const STUDENT_RECORDS_DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data', 'students')

export const STUDENTS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'students.json')

export const STUDENT_PROGRESS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'student-progress.json')
