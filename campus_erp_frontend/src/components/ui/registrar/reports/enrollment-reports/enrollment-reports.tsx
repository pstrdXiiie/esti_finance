import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ReportSection {
  title: string
}

const SECTIONS: ReportSection[] = [
  { title: "Enrollment Statistics" },
  { title: "Enrollment Listing" },
  { title: "Enrollment Listing with Subjects" },
  { title: "Enrollment Summary" },
  { title: "Enrollment List" },
]

export default function EnrollmentReports() {
  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{s.title}</CardTitle>
                <Badge variant="outline">Coming soon</Badge>
              </div>
              <CardDescription>Not yet available.</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
