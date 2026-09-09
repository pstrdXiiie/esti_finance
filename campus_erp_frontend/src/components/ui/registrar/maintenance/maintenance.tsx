import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CurriculumOffered from "@/components/ui/registrar/maintenance/curriculum-offered/curriculum-offered"
import CoursesOffered from "@/components/ui/registrar/maintenance/courses-offered/courses-offered"
import GraduatingStudents from "@/components/ui/registrar/maintenance/graduating-students/graduating-students"
import SubjectDescription from "@/components/ui/registrar/maintenance/subject-description/subject-description"
import Rooms from "@/components/ui/registrar/maintenance/rooms/rooms"


export const registrar_maintenance = () => {
  return (
    <Tabs defaultValue="account" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
            <TabsTrigger value="students-masterfile" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Students Masterfile
            </TabsTrigger>
            <TabsTrigger value="courses-offered" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Courses Offered
            </TabsTrigger>
            <TabsTrigger value="curriculum-offered" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Curriculum Offered
            </TabsTrigger>
            <TabsTrigger value="subject-description" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Subject Description
            </TabsTrigger>
            <TabsTrigger value="graduating-students" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Graduating Students
            </TabsTrigger>
            <TabsTrigger value="rooms" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Rooms
            </TabsTrigger>
        </TabsList>
        <TabsContent value="students-masterfile" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            test1
          </div>
        </TabsContent>
        <TabsContent value="courses-offered" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <CoursesOffered />
          </div>
        </TabsContent>
        <TabsContent value="curriculum-offered" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <CurriculumOffered />
          </div>
        </TabsContent>
        <TabsContent value="subject-description" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <SubjectDescription />
          </div>
        </TabsContent>
        <TabsContent value="graduating-students" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <GraduatingStudents />
          </div>
        </TabsContent>
        <TabsContent value="rooms" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <Rooms />
          </div>
        </TabsContent>
    </Tabs>
  )
}

export default registrar_maintenance