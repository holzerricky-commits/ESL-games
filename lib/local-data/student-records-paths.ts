import { join } from 'node:path'

/** Local teacher data (not for serverless deploys). */
export const STUDENT_RECORDS_DIR = join(/* turbopackIgnore: true */ process.cwd(), 'data', 'students')

export const STUDENTS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'students.json')

export const STUDENT_PROGRESS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'student-progress.json')

export const BOOK_ANNOTATIONS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'book-annotations.json')

export const WEEKLY_SCHEDULE_JSON_PATH = join(STUDENT_RECORDS_DIR, 'weekly-schedule.json')

export const CHALLENGE_DATA_JSON_PATH = join(STUDENT_RECORDS_DIR, 'challenge-data.json')

export const SAVED_WORDS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'saved-words.json')

export const LESSON_BOARD_LINKS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'lesson-board-links.json')

export const READER_PROGRESS_JSON_PATH = join(STUDENT_RECORDS_DIR, 'reader-progress.json')
