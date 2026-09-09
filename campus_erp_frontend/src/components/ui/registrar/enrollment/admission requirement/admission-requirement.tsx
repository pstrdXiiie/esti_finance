"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"

interface StudentCredentialRow {
  credential: string
  date_submitted: string | null
  encoder: string | null
}

interface StudentDoc {
  name: string
  credentials: StudentCredentialRow[]
}

interface SMSCredentialRow {
  name: string
  description: string
  is_initial: boolean | number
}

interface ChecklistEntry {
  checked: boolean
  dateSubmitted: string
}

/**
 * Admission Requirement tab: look up a student, check off which of the
 * school's required admission documents (SMS Credential — Certificate of
 * Good Moral Character, Form 137, etc.) they've submitted, and record the
 * date each was received. `Student.credentials` (SMS Student Credential
 * child table) has no independent CRUD of its own — saving always means
 * rebuilding the whole array from the local checklist and PUTting it back
 * onto the Student doc.
 */
export default function AdmissionRequirement() {
  const { user } = useAuth()
  const [student, setStudent] = useState<StudentOption | null>(null)
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntry>>({})

  const studentQuery = useQuery({
    queryKey: ["Student", "doc", student?.name],
    queryFn: () => frappe.getDoc<StudentDoc>("Student", student!.name),
    enabled: !!student,
  })

  const credentialsQuery = useQuery({
    queryKey: ["SMS Credential", "list"],
    queryFn: () =>
      frappe.list<SMSCredentialRow>("SMS Credential", {
        fields: ["name", "description", "is_initial"],
        order_by: "creation asc",
        limit_page_length: 100,
      }),
  })

  const credentialTypes = credentialsQuery.data ?? []

  // Derive the working checklist from the student's current credential rows
  // merged against the master credential-type list, the first time both
  // queries have settled for a given student — without a useEffect: React
  // explicitly supports adjusting state during rendering (see "Adjusting
  // state when a prop changes" in the React docs), and the guard against
  // `lastSyncedStudentName` makes this a one-time correction per student
  // change rather than a render loop. Same pattern as transferee-evaluation.tsx.
  const [lastSyncedStudentName, setLastSyncedStudentName] = useState<
    string | undefined
  >(undefined)

  const bothSettled = studentQuery.isSuccess && credentialsQuery.isSuccess

  if (student && bothSettled && lastSyncedStudentName !== student.name) {
    const merged: Record<string, ChecklistEntry> = {}
    for (const cred of credentialTypes) {
      const existing = studentQuery.data.credentials.find(
        (row) => row.credential === cred.name
      )
      merged[cred.name] = {
        checked: !!existing,
        dateSubmitted: existing?.date_submitted ?? "",
      }
    }
    setChecklist(merged)
    setLastSyncedStudentName(student.name)
  }

  if (!student && lastSyncedStudentName !== undefined) {
    setLastSyncedStudentName(undefined)
    setChecklist({})
  }

  const toggleChecked = (credentialName: string) => {
    setChecklist((prev) => ({
      ...prev,
      [credentialName]: {
        checked: !prev[credentialName]?.checked,
        dateSubmitted: prev[credentialName]?.dateSubmitted ?? "",
      },
    }))
  }

  const updateDateSubmitted = (credentialName: string, value: string) => {
    setChecklist((prev) => ({
      ...prev,
      [credentialName]: {
        checked: prev[credentialName]?.checked ?? false,
        dateSubmitted: value,
      },
    }))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const rebuilt = credentialTypes
        .filter((cred) => checklist[cred.name]?.checked)
        .map((cred) => ({
          credential: cred.name,
          date_submitted: checklist[cred.name]?.dateSubmitted || "",
          encoder: user?.user ?? "",
        }))
      return frappe.updateDoc("Student", student!.name, {
        credentials: rebuilt,
      })
    },
    onSuccess: () => {
      studentQuery.refetch()
      toast.success("Credentials updated")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // The credential TYPES (the table's rows) load independently of any
  // student — only the checked/date state per row depends on one being
  // resolved — so the real rows can render immediately instead of an empty
  // shell; only the checkbox/date inputs (and Save) are gated on `isReady`.
  const isReady = !!student && bothSettled

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="flex items-start w-full pb-5">
        <StudentSearch
          selected={student}
          onSelect={setStudent}
          idPrefix="admission-requirement"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Credential</TableHead>
              <TableHead>Date Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentialTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  {credentialsQuery.isLoading
                    ? "Loading…"
                    : "No credential types configured yet."}
                </TableCell>
              </TableRow>
            ) : (
              credentialTypes.map((cred) => {
                const entry = checklist[cred.name] ?? {
                  checked: false,
                  dateSubmitted: "",
                }
                return (
                  <TableRow key={cred.name}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        disabled={!isReady}
                        checked={entry.checked}
                        onChange={() => toggleChecked(cred.name)}
                        aria-label={`Toggle ${cred.description}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {cred.description}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        className="w-48"
                        disabled={!isReady || !entry.checked}
                        value={entry.dateSubmitted}
                        onChange={(e) =>
                          updateDateSubmitted(cred.name, e.target.value)
                        }
                        aria-label={`Date submitted for ${cred.description}`}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!student && (
        <p className="text-sm text-muted-foreground mt-2">
          Search for a student to edit their admission requirements.
        </p>
      )}
      {student && !bothSettled && (
        <p className="text-sm text-muted-foreground mt-2">Loading…</p>
      )}

      {isReady && credentialTypes.length > 0 && (
        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  )
}
