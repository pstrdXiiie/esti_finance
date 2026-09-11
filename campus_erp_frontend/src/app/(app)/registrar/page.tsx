import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { enrollmentComponent } from "@/components/ui/registrar/enrollment/enrollment"
import { gradesComponent } from "@/components/ui/registrar/grades/grades"
import { reportsComponent } from "@/components/ui/registrar/reports/reports"
import { registrar_maintenance } from "@/components/ui/registrar/maintenance/maintenance"
import FacultySchedule from "@/components/ui/registrar/faculty-schedule/faculty-schedule"
import Classes from "@/components/ui/registrar/classes/classes"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"



const SCREENS = [
  {
    href: "/registrar/students",
    title: "Students",
    description: "Student master records — demographics, PH registrar fields, credentials.",
  },
  {
    href: "/registrar/enrollment",
    title: "Enrollment & Grades",
    description: "Enroll students into classes, view class rosters, compute grades.",
  },
  {
    href: "/registrar/permits",
    title: "Permits to Take Exam",
    description: "Track exam eligibility and fee balances per student per term.",
  },
  {
    href: "/registrar/graduation-batches",
    title: "Graduation Batches",
    description: "Manage SMS Graduation Batch records produced by the graduation run.",
  },
]

export default function RegistrarPage() {
  return (
    <div>
      <Tabs defaultValue="enrollment" className="h-full">
        <TabsList className="grid w-full grid-cols-6 gap-2 border-0 bg-sidebar p-1 h-full! rounded-3xl items-center print:hidden">
          <TabsTrigger value="enrollment" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Enrollment
          </TabsTrigger>
          <TabsTrigger value="grades" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Grades
          </TabsTrigger>
          <TabsTrigger value="classes" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Classes
          </TabsTrigger>
          <TabsTrigger value="faculty-schedule" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Faculty Schedule
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Reports
          </TabsTrigger>
          <TabsTrigger  value="maintenance" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Maintenance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="enrollment">
          {enrollmentComponent()}
        </TabsContent>
        <TabsContent value="grades" className="min-w-0">
          {gradesComponent()}
        </TabsContent>
        <TabsContent value="classes" className="min-w-0">
          <Classes />
        </TabsContent>
        <TabsContent value="faculty-schedule">
          <FacultySchedule />
        </TabsContent>
        <TabsContent value="reports" className="min-w-0">
          {reportsComponent()}
        </TabsContent>
        <TabsContent value="maintenance">
          {registrar_maintenance()}
        </TabsContent>
      </Tabs>

    </div>
  )
}
