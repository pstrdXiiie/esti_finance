"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OfficialTranscriptOfRecords } from "@/components/ui/registrar/reports/student-credentials/official-transcript-of-records"

interface ReportSection {
  title: string
}

const COMING_SOON_SECTIONS: ReportSection[] = [
  { title: "Diploma" },
  { title: "Honorable Dismissal" },
  { title: "Transfer Credentials" },
  { title: "Good Moral" },
  { title: "Certificate of Enrollment" },
]

export default function StudentCredentials() {
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className="h-full cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => setTranscriptOpen(true)}
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Official Transcript of Records</CardTitle>
              <Badge variant="outline">Open</Badge>
            </div>
            <CardDescription>Print a Request for Official Transcript of Records.</CardDescription>
          </CardHeader>
        </Card>

        {COMING_SOON_SECTIONS.map((s) => (
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

      <OfficialTranscriptOfRecords open={transcriptOpen} onOpenChange={setTranscriptOpen} />
    </div>
  )
}
