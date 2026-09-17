import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportScreen } from "@/components/sms/ReportScreen"
import {
  trialBalanceSpec,
  collectionForThePeriodSpec,
  assessmentForThePeriodSpec,
  tuitionFeeReceivablesSpec,
  subsidiaryLedgerSpec,
} from "@/lib/forms/reports"

export const finance_financialreport = () => {
  return (
    <Tabs defaultValue="trial-balance" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
      {/* TabsList's own base styling (ui/tabs.tsx) hard-codes h-fit for
          vertical orientation via group-data-vertical/tabs:h-fit — no
          className passed here can reliably win that cascade (same-specificity
          utility classes, unpredictable source order). Rather than fight it,
          this wrapper div owns the actual height bound + scrolling, and
          TabsList is left free to size to its natural (possibly taller)
          content inside it. */}
      <div className="w-70 shrink-0 min-h-0 overflow-y-auto mr-7">
        <TabsList className="grid grid-cols-1 content-start gap-5 border-0 bg-card w-full">
            <TabsTrigger value="trial-balance" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Trial Balance
            </TabsTrigger>
            <TabsTrigger value="collection-for-the-period" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Collection for the Period
            </TabsTrigger>
            <TabsTrigger value="assessment-for-the-period" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Assessment for the Period
            </TabsTrigger>
            <TabsTrigger value="tuition-fee-receivables" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Tuition Fee Receivables
            </TabsTrigger>
            <TabsTrigger value="subsidiary-reports" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Subsidiary Reports
            </TabsTrigger>
        </TabsList>
      </div>
        <TabsContent value="trial-balance" className="mt-0 min-w-0 flex-1 overflow-y-auto">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ReportScreen spec={trialBalanceSpec} />
          </div>
        </TabsContent>
        <TabsContent value="collection-for-the-period" className="mt-0 min-w-0 flex-1 overflow-y-auto">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ReportScreen spec={collectionForThePeriodSpec} />
          </div>
        </TabsContent>
        <TabsContent value="assessment-for-the-period" className="mt-0 min-w-0 flex-1 overflow-y-auto">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ReportScreen spec={assessmentForThePeriodSpec} />
          </div>
        </TabsContent>
        <TabsContent value="tuition-fee-receivables" className="mt-0 min-w-0 flex-1 overflow-y-auto">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ReportScreen spec={tuitionFeeReceivablesSpec} />
          </div>
        </TabsContent>
        <TabsContent value="subsidiary-reports" className="mt-0 min-w-0 flex-1 overflow-y-auto">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ReportScreen spec={subsidiaryLedgerSpec} />
          </div>
        </TabsContent>
    </Tabs>
  )
}

export default finance_financialreport
