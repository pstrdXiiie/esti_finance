import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import EnrollmentReports from './enrollment-reports/enrollment-reports'
import StudentCredentials from './student-credentials/student-credentials'
import GeneratePermit from './generate-permit/generate-permit'
import SpecialReports from './special-reports/special-reports'


export const reportsComponent = () => {
  return (
    <Tabs defaultValue="enrollment-reports" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[78vh] border border-border">
      <TabsList className="grid w-56 grid-cols-1 gap-5 border-0 bg-card mr-4 h-[50vh]! shrink-0">
            <TabsTrigger value="enrollment-reports" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Enrollment Reports
            </TabsTrigger>
            <TabsTrigger value="student-credentials" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Student Credentials
            </TabsTrigger>
            <TabsTrigger value="generate-permit" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Generate Permit
            </TabsTrigger>
            <TabsTrigger value="special-reports" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Special Reports
            </TabsTrigger>
        </TabsList>
        <TabsContent value="enrollment-reports" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <EnrollmentReports />
          </div>
        </TabsContent>
        <TabsContent value="student-credentials" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <StudentCredentials />
          </div>
        </TabsContent>
        <TabsContent value="generate-permit" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <GeneratePermit />
          </div>
        </TabsContent>
        <TabsContent value="special-reports" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <SpecialReports />
          </div>
        </TabsContent>
    </Tabs>
  )
}
