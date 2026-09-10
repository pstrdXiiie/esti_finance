"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loanApplicationSpec } from "@/lib/forms/personnel"
import { EmployeeLoanEntry } from "./EmployeeLoanEntry"
import { LeaveApplicationsPanel } from "./LeaveApplicationsPanel"
import { LoanApplicationEntry } from "./LoanApplicationEntry"
import { OvertimeEntry } from "@/components/ui/personnel/OvertimeEntry"

export const loansComponent = () => {
    return (
        <Tabs defaultValue="loans" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
            <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
                <TabsTrigger value="loans" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Loans
                </TabsTrigger>
                <TabsTrigger value="loan-applications" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Loan Applications
                </TabsTrigger>
                <TabsTrigger value="leave-applications" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Leave Applications
                </TabsTrigger>
                <TabsTrigger value="overtime" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Overtime
                </TabsTrigger>
            </TabsList>
            <TabsContent value="loans" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <EmployeeLoanEntry />
                </div>
            </TabsContent>
            <TabsContent value="loan-applications" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <LoanApplicationEntry />
                </div>
            </TabsContent>
            <TabsContent value="leave-applications" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <LeaveApplicationsPanel />
                </div>
            </TabsContent>
            <TabsContent value="overtime" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <OvertimeEntry />
                </div>
            </TabsContent>
        </Tabs>
    )
}

export default loansComponent
