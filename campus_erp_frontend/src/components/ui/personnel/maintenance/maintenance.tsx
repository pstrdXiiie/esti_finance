import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DepartmentMaintenance from "@/components/ui/personnel/DepartmentMaintenance"
import { HolidaysTab as HolidaysMaintenance } from "@/components/ui/personnel/HolidaysMaintenance"
import { LoanTypesList } from "@/components/ui/personnel/loans/LoanTypesList"

export const personnel_maintenance = () => {
  return (
    <Tabs
      defaultValue="loan-maintenance"
      orientation="vertical"
      className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border"
    >
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
        <TabsTrigger value="loan-maintenance" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Loan Maintenance
        </TabsTrigger>
        <TabsTrigger value="leave-maintenance" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Leave Maintenance
        </TabsTrigger>
        <TabsTrigger value="deduction-maintenance" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Deduction Maintenance
        </TabsTrigger>
        <TabsTrigger value="attendance-schedule" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Attendance Schedule
        </TabsTrigger>
        <TabsTrigger value="departments" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Departments
        </TabsTrigger>
        <TabsTrigger value="positions-designations" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Positions / Designations
        </TabsTrigger>
        <TabsTrigger value="holidays" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
          Holidays
        </TabsTrigger>
      </TabsList>

      <TabsContent value="loan-maintenance" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <LoanTypesList />
        </div>
      </TabsContent>

      <TabsContent value="leave-maintenance" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <div className="rounded-2xl border border-border h-full p-7">
            <p className="text-muted-foreground">
              Leave Maintenance — coming soon. Needs a campus_erp-native Leave Type doctype;
              HR module&apos;s Leave Type carries payroll/encashment fields not used here.
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="deduction-maintenance" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <div className="rounded-2xl border border-border h-full p-7">
            <p className="text-muted-foreground">
              Deduction Maintenance — coming soon. No backing doctype exists yet anywhere
              in the bench; needs a new campus_erp DocType (backend work).
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="attendance-schedule" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <div className="rounded-2xl border border-border h-full p-7">
            <p className="text-muted-foreground">
              Attendance Schedule — coming soon. HR module only has Shift Type/Assignment
              scheduling infrastructure; needs a campus_erp-native schedule master.
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="departments" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <DepartmentMaintenance />
        </div>
      </TabsContent>

      <TabsContent value="positions-designations" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <div className="rounded-2xl border border-border h-full p-7">
            <p className="text-muted-foreground">
              Positions / Designations — coming soon. ERPNext&apos;s Designation doctype exists
              but carries a skills table + appraisal template link not needed here.
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="holidays" className="mt-0 min-w-0 flex-1">
        <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
          <HolidaysMaintenance />
        </div>
      </TabsContent>
    </Tabs>
  )
}

export default personnel_maintenance
