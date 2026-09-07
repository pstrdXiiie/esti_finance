import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AllGrades from './all-grades/all-grades';
import ByClass from './by-class/by-class';
import ByTeacher from './by-teacher/by-teacher';
import TransfereeGrades from './transferee-grades/transferee-grades'
import OldStudentGrades from './old-student-grades/old-student-grades'


export const gradesComponent = () => {
  return (
    <Tabs defaultValue="all-grades" orientation="vertical" className="flex-row items-stretch bg-white p-4 rounded-lg shadow-md w-full h-[85vh] border border-black/20 print:h-auto print:border-0 print:shadow-none print:p-0">
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-white mr-7 h-[50vh]! shrink-0 print:hidden">
            <TabsTrigger value="all-grades" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                All Grades
            </TabsTrigger>
            <TabsTrigger value="by-class" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                By Class
            </TabsTrigger>
            <TabsTrigger value="by-teacher" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                By Teacher
            </TabsTrigger>
            <TabsTrigger value="transferee-grades" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Transferee Grades
            </TabsTrigger>
            <TabsTrigger value="old-student-grades" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Old Student Grades
            </TabsTrigger>
        </TabsList>
        <TabsContent value="all-grades" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <AllGrades />
          </div>
        </TabsContent>
        <TabsContent value="by-class" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <ByClass />
          </div>
        </TabsContent>
        <TabsContent value="by-teacher" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <ByTeacher />
          </div>
        </TabsContent>
        <TabsContent value="transferee-grades" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <TransfereeGrades />
          </div>
        </TabsContent>
        <TabsContent value="old-student-grades" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <OldStudentGrades />
          </div>
        </TabsContent>
    </Tabs>
  )
}
