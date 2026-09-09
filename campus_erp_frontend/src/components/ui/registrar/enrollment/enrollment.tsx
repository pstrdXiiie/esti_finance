import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppWindowIcon } from "lucide-react"
import AdmissionRequirement from './admission requirement/admission-requirement';
import PreEnrollment from './pre-enrollment/pre-enrollment';
import PreRegistrationRecord from './pre-registration-record/pre-registration-record';
import AddRemoveSubjects from './add-remove-subjects/add-remove-subjects'
import WithdrawalOfEnrollment from './withdrawal-of-enrollment/withdrawal-of-enrollment'
import TransfereeEvaluation from './transferee-evaluation/transferee-evaluation'


export const enrollmentComponent = () => {
  return (
    <Tabs defaultValue="account" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
            <TabsTrigger value="admission-requirement" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                <AppWindowIcon />
                Admission Requirement
            </TabsTrigger>
            <TabsTrigger value="pre-enrollment" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Pre-Enrollment
            </TabsTrigger>
            <TabsTrigger value="enrollment" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Pre-Registration Record
            </TabsTrigger>
            <TabsTrigger value="grades" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Transferee Evaluation
            </TabsTrigger>
            <TabsTrigger value="classes" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Add / Remove Subjects
            </TabsTrigger>
            <TabsTrigger value="faculty-schedule" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Withdrawal of Enrollment
            </TabsTrigger>
        </TabsList>
        <TabsContent value="admission-requirement" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <AdmissionRequirement />
          </div>
        </TabsContent>
        <TabsContent value="enrollment" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <PreRegistrationRecord />
          </div>
        </TabsContent>
        <TabsContent value="pre-enrollment" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <PreEnrollment />
          </div>
        </TabsContent>
        <TabsContent value="classes" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <AddRemoveSubjects />
          </div>
        </TabsContent>
        <TabsContent value="faculty-schedule" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <WithdrawalOfEnrollment />
          </div>
        </TabsContent>
        <TabsContent value="grades" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <TransfereeEvaluation />
          </div>
        </TabsContent>
    </Tabs>
  )
}