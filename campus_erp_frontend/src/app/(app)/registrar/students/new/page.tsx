"use client"

import { useState, type ReactNode, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { formatAcademicYearLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldLabel } from "@base-ui/react";

interface LookupRow {
  name: string
}

interface ProgramRow {
  name: string
  program_name: string
}

interface AcademicYearRow {
  name: string
  academic_year_name: string
}

interface CurriculumRow {
  name: string
  curriculum_code: string
  curriculum_year: string | null
}

interface SMSCredentialRow {
  name: string
  description: string
}

interface CreateStudentResult {
  name: string
}

interface BasicInfoState {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  rfid: string
  student_email_id: string
  student_mobile_number: string
  date_of_birth: string
  gender: string
  nationality: string
  religion: string
  birth_place: string
  address_line_1: string
  town: string
  province: string
  city: string
  country: string
}

const INITIAL_BASIC_INFO: BasicInfoState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  rfid: "",
  student_email_id: "",
  student_mobile_number: "",
  date_of_birth: "",
  gender: "",
  nationality: "",
  religion: "",
  birth_place: "",
  address_line_1: "",
  town: "",
  province: "",
  city: "",
  country: "",
}

interface AcademicInfoState {
  lrn: string
  elementary: string
  year_elementary: string
  secondary: string
  year_secondary: string
  tertiary: string
  year_tertiary: string
  prev_course: string
  transferee: boolean
  graduated: boolean
  year_graduated: string
  last_course_attended: string
  year_last_attended: string
  general_average: string
  pr_no: string
}

const INITIAL_ACADEMIC_INFO: AcademicInfoState = {
  lrn: "",
  elementary: "",
  year_elementary: "",
  secondary: "",
  year_secondary: "",
  tertiary: "",
  year_tertiary: "",
  prev_course: "",
  transferee: false,
  graduated: false,
  year_graduated: "",
  last_course_attended: "",
  year_last_attended: "",
  general_average: "",
  pr_no: "",
}

interface GuardianState {
  name: string
  mobile: string
  occupation: string
  address: string
}

const INITIAL_GUARDIAN: GuardianState = {
  name: "",
  mobile: "",
  occupation: "",
  address: "",
}

interface GuardianInfoState {
  father: GuardianState
  mother: GuardianState
}

interface CurriculumDetailsState {
  course: string
  curriculum: string
  year_level: string
}

const INITIAL_CURRICULUM_DETAILS: CurriculumDetailsState = {
  course: "",
  curriculum: "",
  year_level: "1",
}

const STEPS = ["Personal Information", "Credentials", "Enrollment"]

/** Small local label+control wrapper — only consumer is this page. */
function Field({
  id,
  label,
  children,
  inline = false,
}: {
  id: string
  label: string
  children: ReactNode
  inline?: boolean
}) {
  return (
    <div
      className={inline ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2" : "grid gap-1.5"}
    >
      <label htmlFor={id} className={inline ? "whitespace-nowrap" : ""}>
        {label}
      </label>
      <div className={inline ? "min-w-0" : ""}>{children}</div>
    </div>
  )
}

/** Age isn't a stored field anywhere — derived from Date of Birth for the
 * Enrollment step's read-only summary only. */
function computeAge(dateOfBirth: string): string {
  if (!dateOfBirth) return "—"
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return "—"
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age >= 0 ? String(age) : "—"
}

/**
 * New Student wizard: a 3-step form (Basic Information, Academic Information,
 * Guardian Information) that collects everything needed to create a Student
 * record — plus the same admission-credentials checklist as the Admission
 * Requirement tab (built fresh here since this is always a blank slate, not
 * an existing student's saved rows) — and submits it all in one RPC call to
 * campus_erp.api.registrar.create_student. Reached from the Students list's
 * "Add Students" button.
 */
export default function NewStudentPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)

  const [basicInfo, setBasicInfo] = useState<BasicInfoState>(INITIAL_BASIC_INFO)
  const [academicInfo, setAcademicInfo] = useState<AcademicInfoState>(
    INITIAL_ACADEMIC_INFO
  )
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [curriculumDetails, setCurriculumDetails] = useState<CurriculumDetailsState>(
    INITIAL_CURRICULUM_DETAILS
  )
  const [academicYear, setAcademicYear] = useState("")
  const [guardianInfo, setGuardianInfo] = useState<GuardianInfoState>({
    father: { ...INITIAL_GUARDIAN },
    mother: { ...INITIAL_GUARDIAN },
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("")

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const gendersQuery = useQuery({
    queryKey: ["Gender", "list", "new-student"],
    queryFn: () =>
      frappe.list<LookupRow>("Gender", {
        filters: [["name", "in", ["Male", "Female"]]],
        fields: ["name"],
        limit_page_length: 100,
      }),
  })

  const programsQuery = useQuery({
    queryKey: ["Program", "list", "new-student"],
    queryFn: () =>
      frappe.list<ProgramRow>("Program", {
        fields: ["name", "program_name"],
        limit_page_length: 500,
      }),
  })

  const academicYearsQuery = useQuery({
    queryKey: ["Academic Year", "list", "new-student"],
    queryFn: () =>
      frappe.list<AcademicYearRow>("Academic Year", {
        fields: ["name", "academic_year_name"],
        order_by: "year_start_date desc",
      }),
  })

  if (!academicYear && academicYearsQuery.data?.[0]) {
    setAcademicYear(academicYearsQuery.data[0].name)
  }
  const currentAcademicYearLabel =
    formatAcademicYearLabel(
      academicYearsQuery.data?.find((ay) => ay.name === academicYear)?.academic_year_name
    ) || (academicYearsQuery.isLoading ? "Loading…" : "—")

  const curriculaQuery = useQuery({
    queryKey: ["SMS Curriculum", "list", "new-student", curriculumDetails.course],
    queryFn: () =>
      frappe.list<CurriculumRow>("SMS Curriculum", {
        filters: [["course", "=", curriculumDetails.course]],
        fields: ["name", "curriculum_code", "curriculum_year"],
        limit_page_length: 100,
      }),
    enabled: !!curriculumDetails.course,
  })

  const countriesQuery = useQuery({
    queryKey: ["Country", "list", "new-student"],
    queryFn: () =>
      frappe.list<LookupRow>("Country", {
        fields: ["name"],
        limit_page_length: 300,
      }),
  })

  const religionsQuery = useQuery({
    queryKey: ["SMS Code", "list", "Religion", "new-student"],
    queryFn: () =>
      frappe.list<LookupRow>("SMS Code", {
        filters: [["code_type", "=", "Religion"]],
        fields: ["name"],
        limit_page_length: 100,
      }),
  })

  const credentialsQuery = useQuery({
    queryKey: ["SMS Credential", "list", "new-student"],
    queryFn: () =>
      frappe.list<SMSCredentialRow>("SMS Credential", {
        fields: ["name", "description"],
        order_by: "creation asc",
        limit_page_length: 100,
      }),
  })

  const credentialTypes = credentialsQuery.data ?? []

  const studentNumberPreviewQuery = useQuery({
    queryKey: ["student-number-preview", academicInfo.transferee],
    queryFn: () =>
      frappe.call<string>("campus_erp.registrar.student_number.preview_student_number", {
        transferee: academicInfo.transferee ? 1 : 0,
      }),
  })

  const toggleCredentialChecked = (credentialName: string) => {
    setChecklist((prev) => ({
      ...prev,
      [credentialName]: !prev[credentialName],
    }))
  }

  const createStudentMutation = useMutation({
    mutationFn: async () => {
      let imageUrl: string | undefined
      if (photoFile) {
        const uploaded = await frappe.uploadFile(photoFile, { isPrivate: true })
        imageUrl = uploaded.file_url
      }

      const student: Record<string, unknown> = {
        ...(imageUrl ? { image: imageUrl } : {}),
        first_name: basicInfo.first_name,
        middle_name: basicInfo.middle_name,
        last_name: basicInfo.last_name,
        suffix: basicInfo.suffix,
        student_email_id: basicInfo.student_email_id,
        student_mobile_number: basicInfo.student_mobile_number,
        date_of_birth: basicInfo.date_of_birth,
        gender: basicInfo.gender,
        nationality: basicInfo.nationality,
        religion: basicInfo.religion,
        birth_place: basicInfo.birth_place,
        address_line_1: basicInfo.address_line_1,
        town: basicInfo.town,
        province: basicInfo.province,
        city: basicInfo.city,
        country: basicInfo.country,
        lrn: academicInfo.lrn,
        elementary: academicInfo.elementary,
        year_elementary: academicInfo.year_elementary,
        secondary: academicInfo.secondary,
        year_secondary: academicInfo.year_secondary,
        tertiary: academicInfo.tertiary,
        year_tertiary: academicInfo.year_tertiary,
        prev_course: academicInfo.prev_course,
        transferee: academicInfo.transferee ? 1 : 0,
        graduated: academicInfo.graduated ? 1 : 0,
        year_graduated: academicInfo.year_graduated,
        last_course_attended: academicInfo.last_course_attended,
        year_last_attended: academicInfo.year_last_attended,
        general_average: academicInfo.general_average,
        pr_no: academicInfo.pr_no,
      }

      const credentials = credentialTypes
        .filter((cred) => checklist[cred.name])
        .map((cred) => ({ credential: cred.name }))

      const result = await frappe.call<CreateStudentResult>(
        "campus_erp.api.registrar.create_student",
        {
          payload: {
            student,
            father_name: guardianInfo.father.name,
            father_mobile: guardianInfo.father.mobile,
            father_occupation: guardianInfo.father.occupation,
            father_address: guardianInfo.father.address,
            mother_name: guardianInfo.mother.name,
            mother_mobile: guardianInfo.mother.mobile,
            mother_occupation: guardianInfo.mother.occupation,
            mother_address: guardianInfo.mother.address,
            rfid: basicInfo.rfid || undefined,
            credentials,
          },
        }
      )

      if (curriculumDetails.course) {
        if (!academicYear) {
          toast.error("Program Enrollment not created — School Year is required")
        } else {
          try {
            await frappe.createDoc("Program Enrollment", {
              student: result.name,
              program: curriculumDetails.course,
              academic_year: academicYear,
              curriculum: curriculumDetails.curriculum || undefined,
              year_level: curriculumDetails.year_level
                ? Number(curriculumDetails.year_level)
                : undefined,
              enrollment_date: new Date().toISOString().slice(0, 10),
            })
          } catch (enrollmentError) {
            toast.error(
              `Student created, but Program Enrollment failed: ${getErrorMessage(enrollmentError)}`
            )
          }
        }
      }

      return result
    },
    onSuccess: () => {
      toast.success("Student created")
      router.push("/registrar/students")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const canProceedStep1 =
    basicInfo.first_name.trim() !== "" && basicInfo.student_email_id.trim() !== ""

  const fullName =
    [basicInfo.first_name, basicInfo.middle_name, basicInfo.last_name, basicInfo.suffix]
      .filter((part) => part.trim() !== "")
      .join(" ") || "—"

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col gap-3">
      <Link
        href="/registrar/students"
        className="text-sm text-muted-foreground hover:underline w-fit shrink-0"
      >
        ← Back to Students
      </Link>

      <div className="shrink-0 rounded-2xl border border-border p-3">
        <h1 className="mb-2 text-lg font-semibold">Add Student</h1>
        <div className="flex items-start">
          {STEPS.map((label, idx) => (
            <div
              key={label}
              className={`flex items-start ${idx < STEPS.length - 1 ? "flex-1" : ""}`}
            >
              <div className="flex flex-col items-center gap-2">
                {idx <= currentStep ? (
                  <div
                    className={`h-5 w-5 shrink-0 rounded-full bg-primary ${
                      idx === currentStep ? "ring-4 ring-primary/20" : ""
                    }`}
                  />
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                )}
                <span
                  className={`w-35 text-center text-xs font-medium ${
                    idx <= currentStep ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-2 mt-[10px] h-0.5 flex-1 ${
                    idx <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border p-5">
        <div className="min-h-0 flex-1 overflow-hidden">
        {currentStep === 0 && 
          <div className="grid h-full grid-rows-[1fr_auto] gap-3">
            <div className="grid content-start gap-2 overflow-y-auto">
            <div className="flex gap-4 items-start">
              <label
                htmlFor="new-student-photo"
                className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground"
              >
                {photoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreviewUrl}
                    alt="Student photo preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "No Photo"
                )}
                <input
                  id="new-student-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
              <div className="flex flex-1 flex-col gap-2">
                <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Field id="new-student-first-name" label="First Name">
                    <Input
                      id="new-student-first-name"
                      value={basicInfo.first_name}
                      onChange={(e) =>
                        setBasicInfo((prev) => ({ ...prev, first_name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field id="new-student-last-name" label="Last Name">
                    <Input
                      id="new-student-last-name"
                      value={basicInfo.last_name}
                      onChange={(e) =>
                        setBasicInfo((prev) => ({ ...prev, last_name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field id="new-student-middle-name" label="Middle Name">
                    <Input
                      id="new-student-middle-name"
                      value={basicInfo.middle_name}
                      onChange={(e) =>
                        setBasicInfo((prev) => ({ ...prev, middle_name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field id="new-student-suffix" label="Suffix">
                    <Input
                      className="w-[100px]"
                      id="new-student-suffix"
                      value={basicInfo.suffix}
                      onChange={(e) =>
                        setBasicInfo((prev) => ({ ...prev, suffix: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 mt-5">
              <div className="relative gap-4">
                <div className="relative rounded-md border p-3 pt-4 mb-5">
                  <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                    Contact Details
                  </span>
                  <div className="flex gap-4">
                    <Field id="new-student-email" label="Email Address">
                      <Input
                        id="new-student-email"
                        type="email"
                        value={basicInfo.student_email_id}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            student_email_id: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field id="new-student-mobile" label="Phone Number">
                      <Input
                        id="new-student-mobile"
                        value={basicInfo.student_mobile_number}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            student_mobile_number: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="relative rounded-md border p-3 pt-4 mb-5">
                  <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                    Emergency Contact
                  </span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <h3 className="text-sm font-semibold">Father&apos;s Info</h3>
                      <Field id="new-student-father-name" label="Full Name">
                        <Input
                          id="new-student-father-name"
                          value={guardianInfo.father.name}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              father: { ...prev.father, name: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-father-mobile" label="Mobile Number">
                        <Input
                          id="new-student-father-mobile"
                          value={guardianInfo.father.mobile}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              father: { ...prev.father, mobile: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-father-occupation" label="Occupation">
                        <Input
                          id="new-student-father-occupation"
                          value={guardianInfo.father.occupation}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              father: { ...prev.father, occupation: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-father-address" label="Address">
                        <Input
                          id="new-student-father-address"
                          value={guardianInfo.father.address}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              father: { ...prev.father, address: e.target.value },
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid gap-2">
                      <h3 className="text-sm font-semibold">Mother&apos;s Info</h3>
                      <Field id="new-student-mother-name" label="Full Name">
                        <Input
                          id="new-student-mother-name"
                          value={guardianInfo.mother.name}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              mother: { ...prev.mother, name: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-mother-mobile" label="Mobile Number">
                        <Input
                          id="new-student-mother-mobile"
                          value={guardianInfo.mother.mobile}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              mother: { ...prev.mother, mobile: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-mother-occupation" label="Occupation">
                        <Input
                          id="new-student-mother-occupation"
                          value={guardianInfo.mother.occupation}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              mother: { ...prev.mother, occupation: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field id="new-student-mother-address" label="Address">
                        <Input
                          id="new-student-mother-address"
                          value={guardianInfo.mother.address}
                          onChange={(e) =>
                            setGuardianInfo((prev) => ({
                              ...prev,
                              mother: { ...prev.mother, address: e.target.value },
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="relative rounded-md border p-3 pt-4 mb-5">
                  <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                    Signature
                  </span>
                  <div className="flex gap-4">
                      <Input
                        id="new-student-signature"
                        type="file">
                      </Input>
                  </div>
                </div>
              </div>


              <div className="relative rounded-md border p-3 pt-4 h-full">
                <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                  Other Information
                </span>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                    <Field id="new-student-dob" label="Date of Birth">
                      <Input
                        id="new-student-dob"
                        type="date"
                        value={basicInfo.date_of_birth}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            date_of_birth: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field id="new-student-religion" label="Religion">
                      <Select
                        value={basicInfo.religion}
                        onValueChange={(v) =>
                          setBasicInfo((prev) => ({ ...prev, religion: v ?? "" }))
                        }
                      >
                        <SelectTrigger id="new-student-religion" className="w-full">
                          <SelectValue placeholder="Select Religion" />
                        </SelectTrigger>
                        <SelectContent>
                          {(religionsQuery.data ?? []).map((r) => (
                            <SelectItem key={r.name} value={r.name}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="new-student-citizenship" label="Citizenship">
                      <Input
                        id="new-student-citizenship"
                        value={basicInfo.nationality}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            nationality: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <Field id="new-student-gender" label="Gender">
                      <Select
                        value={basicInfo.gender}
                        onValueChange={(v) =>
                          setBasicInfo((prev) => ({ ...prev, gender: v ?? "" }))
                        }
                      >
                        <SelectTrigger id="new-student-gender" className="w-full">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {(gendersQuery.data ?? []).map((g) => (
                            <SelectItem key={g.name} value={g.name}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="new-student-birth-place" label="Birth Place">
                      <Input
                        id="new-student-birth-place"
                        value={basicInfo.birth_place}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            birth_place: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex flex-col gap-x-3 gap-y-2">
                    <Field id="new-student-address" label="Street / Sitio / Brgy.">
                      <Input
                        id="new-student-address"
                        value={basicInfo.address_line_1}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({
                            ...prev,
                            address_line_1: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field id="new-student-town" label="Town">
                      <Input
                        id="new-student-town"
                        value={basicInfo.town}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({ ...prev, town: e.target.value }))
                        }
                      />
                    </Field>
                    <Field id="new-student-city" label="City">
                      <Input
                        id="new-student-city"
                        value={basicInfo.city}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({ ...prev, city: e.target.value }))
                        }
                      />
                    </Field>
                    <Field id="new-student-province" label="Province">
                      <Input
                        id="new-student-province"
                        value={basicInfo.province}
                        onChange={(e) =>
                          setBasicInfo((prev) => ({ ...prev, province: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setCurrentStep(1)}
              >
                Next
              </Button>
            </div>
          </div>
        }

        {currentStep === 1 && (
          <div className="grid h-full grid-rows-[1fr_auto] gap-2">
            <div className="grid content-start gap-3 overflow-y-auto md:grid-cols-2">
              <div className="grid content-start gap-2">
                <Field id="new-student-lrn" label="LRN">
                  <Input
                    id="new-student-lrn"
                    value={academicInfo.lrn}
                    onChange={(e) =>
                      setAcademicInfo((prev) => ({ ...prev, lrn: e.target.value }))
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field id="new-student-elementary" label="Elementary">
                    <Input
                      id="new-student-elementary"
                      value={academicInfo.elementary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          elementary: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-year-elementary" label="Year Graduated">
                    <Input
                      id="new-student-year-elementary"
                      value={academicInfo.year_elementary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          year_elementary: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-secondary" label="Secondary">
                    <Input
                      id="new-student-secondary"
                      value={academicInfo.secondary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({ ...prev, secondary: e.target.value }))
                      }
                    />
                  </Field>
                  <Field id="new-student-year-secondary" label="Year Graduated">
                    <Input
                      id="new-student-year-secondary"
                      value={academicInfo.year_secondary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          year_secondary: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-tertiary" label="Tertiary">
                    <Input
                      id="new-student-tertiary"
                      value={academicInfo.tertiary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({ ...prev, tertiary: e.target.value }))
                      }
                    />
                  </Field>
                  <Field id="new-student-year-tertiary" label="Year Graduated">
                    <Input
                      id="new-student-year-tertiary"
                      value={academicInfo.year_tertiary}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          year_tertiary: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <Field id="new-student-prev-course" label="Previous Course">
                  <Input
                    id="new-student-prev-course"
                    value={academicInfo.prev_course}
                    onChange={(e) =>
                      setAcademicInfo((prev) => ({ ...prev, prev_course: e.target.value }))
                    }
                  />
                </Field>

                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                  <Field id="new-student-last-course-attended" label="Last Attended">
                    <Input
                      id="new-student-last-course-attended"
                      value={academicInfo.last_course_attended}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          last_course_attended: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-year-last-attended" label="Year">
                    <Input
                      id="new-student-year-last-attended"
                      value={academicInfo.year_last_attended}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          year_last_attended: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-general-average" label="GWA">
                    <Input
                      id="new-student-general-average"
                      value={academicInfo.general_average}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          general_average: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="grid content-start gap-2 pt-4 ml-4">
                <div className="relative rounded-md border p-3 pt-4">
                  <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                    Credentials
                  </span>
                  {credentialTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No credential types configured yet.
                    </p>
                  ) : (
                    <div className="grid gap-1.5">
                      {credentialTypes.map((cred) => (
                        <div key={cred.name} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checklist[cred.name] ?? false}
                            onChange={() => toggleCredentialChecked(cred.name)}
                            id={`new-student-credential-${cred.name}`}
                          />
                          <label htmlFor={`new-student-credential-${cred.name}`}>
                            {cred.description}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-student-graduated"
                      className="h-4 w-4"
                      checked={academicInfo.graduated}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          graduated: e.target.checked,
                        }))
                      }
                    />
                    <label htmlFor="new-student-graduated">Graduated</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-student-transferee"
                      className="h-4 w-4"
                      checked={academicInfo.transferee}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          transferee: e.target.checked,
                        }))
                      }
                    />
                    <label htmlFor="new-student-transferee">Transferee</label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field id="new-student-year-graduated" label="Year Graduated">
                    <Input
                      id="new-student-year-graduated"
                      disabled={!academicInfo.graduated}
                      value={academicInfo.year_graduated}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({
                          ...prev,
                          year_graduated: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field id="new-student-pr-no" label="PR No.">
                    <Input
                      id="new-student-pr-no"
                      disabled={!academicInfo.graduated}
                      value={academicInfo.pr_no}
                      onChange={(e) =>
                        setAcademicInfo((prev) => ({ ...prev, pr_no: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(0)}>
                Previous
              </Button>
              <Button type="button" onClick={() => setCurrentStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid h-full grid-rows-[1fr_auto] gap-3">
            <div className="grid content-start gap-3 overflow-y-auto pt-4">
              <div className="relative rounded-md border p-5 pt-4 mb-2 w-full">
                <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                  Student Summary
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  <Field id="new-student-summary-full-name" label="Full Name:" inline>
                    <span>{fullName}</span>
                  </Field>
                  <Field id="new-student-summary-gender" label="Gender:" inline>
                    <span>{basicInfo.gender || "—"}</span>
                  </Field>
                  <Field id="new-student-summary-dob" label="Date of Birth:" inline>
                    <span>{basicInfo.date_of_birth || "—"}</span>
                  </Field>
                  <Field id="new-student-summary-age" label="Age:" inline>
                    <span>{computeAge(basicInfo.date_of_birth)}</span>
                  </Field>
                  <Field id="new-student-summary-phone" label="Phone Number:" inline>
                    <span>{basicInfo.student_mobile_number || "—"}</span>
                  </Field>
                  <Field id="new-student-summary-email" label="Email:" inline>
                    <span>{basicInfo.student_email_id || "—"}</span>
                  </Field>
                </div>
              </div>

              

              <div className="relative rounded-md border p-3 pt-4 mb-5 w-full">
                <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-medium">
                  Academic Information
                </span>
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 sm:grid-cols-3 pb-4">
                  <Field id="new-student-num" label="Student Number" inline>
                    <Input
                      id="new-student-num"
                      value={
                        studentNumberPreviewQuery.data ??
                        (studentNumberPreviewQuery.isLoading ? "Generating…" : "—")
                      }
                      disabled
                      readOnly
                    />
                  </Field>
                  <Field id="new-student-rfid" label="RFID" inline>
                    <Input
                      id="new-student-rfid"
                      value={basicInfo.rfid}
                      onChange={(e) =>
                        setBasicInfo((prev) => ({ ...prev, rfid: e.target.value }))
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <Field id="new-student-course" label="Course:" inline>
                    <Select
                      value={curriculumDetails.course}
                      onValueChange={(v) =>
                        setCurriculumDetails((prev) => ({
                          ...prev,
                          course: v ?? "",
                          curriculum: "",
                        }))
                      }
                    >
                      <SelectTrigger id="new-student-course" className="w-[100%] min-w-[170px]">
                        <SelectValue placeholder="Select Course" />
                      </SelectTrigger>
                      <SelectContent>
                        {(programsQuery.data ?? []).map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {p.program_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field id="new-student-curriculum" label="Curriculum:" inline>
                    <Select
                      value={curriculumDetails.curriculum}
                      onValueChange={(v) =>
                        setCurriculumDetails((prev) => ({ ...prev, curriculum: v ?? "" }))
                      }
                      disabled={!curriculumDetails.course}
                    >
                      <SelectTrigger id="new-student-curriculum" className="w-full min-w-[170px]">
                        <SelectValue
                          placeholder={
                            curriculumDetails.course ? "Select Curriculum" : "Select a Course first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(curriculaQuery.data ?? []).map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.curriculum_year
                              ? `${c.curriculum_code} (${c.curriculum_year})`
                              : c.curriculum_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
            
                  <Field id="new-student-year-level" label="Year Level:" inline>
                    <Input
                      id="new-student-year-level"
                      value={curriculumDetails.year_level}
                      onChange={(e) =>
                        setCurriculumDetails((prev) => ({ ...prev, year_level: e.target.value }))
                      }
                    />
                  </Field>

                  <Field id="new-student-school-year" label="School Year:" inline>
                    <span>
                      {currentAcademicYearLabel}
                    </span>
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={createStudentMutation.isPending}
                onClick={() => setCurrentStep(1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                disabled={createStudentMutation.isPending}
                onClick={() => createStudentMutation.mutate()}
              >
                {createStudentMutation.isPending ? "Saving…" : "Save and Enroll"}
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
