'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StudentsSearchBar } from '@/components/students/students-search-bar'
import { StudentCard } from '@/components/students/student-card'
import { StudentsEmptyState } from '@/components/students/students-empty-state'
import { getStudentsListView } from '@/lib/students/selectors'
import type { StudentListItemView } from '@/lib/students/types'

export function StudentsListPage() {
  const [query, setQuery] = useState('')
  const students: StudentListItemView[] = getStudentsListView()

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students
    return students.filter((student) => student.name.toLowerCase().includes(normalized))
  }, [students, query])

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <Button className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]">
          <Plus size={16} />
          Add Student
        </Button>
      </div>

      <StudentsSearchBar value={query} onChange={setQuery} count={filteredStudents.length} />

      {filteredStudents.length === 0 ? (
        <StudentsEmptyState hasSearch={query.trim().length > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      )}
    </>
  )
}
