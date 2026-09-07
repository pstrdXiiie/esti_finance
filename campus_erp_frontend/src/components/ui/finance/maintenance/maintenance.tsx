import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CodesAndFees from "@/components/ui/finance/maintenance/codes-and-fees/codes-and-fees"
import TuitionFee from "@/components/ui/finance/maintenance/tuition-fee/tuition-fee"
import Discounts from "@/components/ui/finance/maintenance/discounts/discounts"

export const finance_maintenance = () => {
  return (
    <Tabs defaultValue="account" orientation="vertical" className="flex-row items-stretch bg-white p-4 rounded-lg shadow-md w-full h-[85vh] border border-black/20">
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-white mr-7 h-[50vh]! shrink-0">
            <TabsTrigger value="subsidiary" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Subsidiary
            </TabsTrigger>
            <TabsTrigger value="supplier-masterfile" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Supplier Masterfile
            </TabsTrigger>
            <TabsTrigger value="items-masterfile" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Items Masterfile
            </TabsTrigger>
            <TabsTrigger value="codes-and-fees" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Codes and Fees
            </TabsTrigger>
            <TabsTrigger value="tuition-fee" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Tuition Fee
            </TabsTrigger>
            <TabsTrigger value="discounts" className="w-full gap-2 p-3 border-black/20 data-active:bg-primary data-active:text-primary-foreground">
                Discounts
            </TabsTrigger>
        </TabsList>
        <TabsContent value="subsidiary" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            test1
          </div>
        </TabsContent>
        <TabsContent value="supplier-masterfile" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            test2
          </div>
        </TabsContent>
        <TabsContent value="items-masterfile" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            test3
          </div>
        </TabsContent>
        <TabsContent value="codes-and-fees" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <CodesAndFees />
          </div>
        </TabsContent>
        <TabsContent value="tuition-fee" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <TuitionFee />
          </div>
        </TabsContent>
        <TabsContent value="discounts" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-black/20">
            <Discounts />
          </div>
        </TabsContent>
    </Tabs>
  )
}

export default finance_maintenance