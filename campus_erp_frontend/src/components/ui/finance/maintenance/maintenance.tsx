import React from 'react'
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CodesAndFees from "@/components/ui/finance/maintenance/codes-and-fees/codes-and-fees"
import TuitionFee from "@/components/ui/finance/maintenance/tuition-fee/tuition-fee"
import Discounts from "@/components/ui/finance/maintenance/discounts/discounts"
import Subsidiary from "@/components/ui/finance/maintenance/subsidiary/subsidiary"
import SupplierMasterfile from "@/components/ui/finance/maintenance/supplier-masterfile/supplier-masterfile"
import ItemsMasterfile from "@/components/ui/finance/maintenance/items-masterfile/items-masterfile"
import { FinanceMaintenanceScreen } from "@/components/finance/FinanceMaintenanceScreen"
import { Button } from "@/components/ui/button"
import { sundryacc } from "@/lib/forms/finance"
import { requisitionSpec, purchaseOrderSpec, canteenPcvSpec } from "@/lib/forms/purchasing"

export const finance_maintenance = () => {
  return (
    <Tabs defaultValue="account" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
      <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
            <TabsTrigger value="subsidiary" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Subsidiary
            </TabsTrigger>
            <TabsTrigger value="supplier-masterfile" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Supplier Masterfile
            </TabsTrigger>
            <TabsTrigger value="items-masterfile" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Items Masterfile
            </TabsTrigger>
            <TabsTrigger value="codes-and-fees" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Codes and Fees
            </TabsTrigger>
            <TabsTrigger value="tuition-fee" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Tuition Fee
            </TabsTrigger>
            <TabsTrigger value="discounts" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Discounts
            </TabsTrigger>
            <TabsTrigger value="sundry-account" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Sundry Account
            </TabsTrigger>
            <TabsTrigger value="purchase-requisition" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Purchase Requisition
            </TabsTrigger>
            <TabsTrigger value="purchase-order" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Purchase Order
            </TabsTrigger>
            <TabsTrigger value="petty-cash-voucher" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Petty Cash Voucher
            </TabsTrigger>
            <TabsTrigger value="canteen-entry" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                Canteen Entry
            </TabsTrigger>
        </TabsList>
        <TabsContent value="subsidiary" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <Subsidiary />
          </div>
        </TabsContent>
        <TabsContent value="supplier-masterfile" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <SupplierMasterfile />
          </div>
        </TabsContent>
        <TabsContent value="items-masterfile" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <ItemsMasterfile />
          </div>
        </TabsContent>
        <TabsContent value="codes-and-fees" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <CodesAndFees />
          </div>
        </TabsContent>
        <TabsContent value="tuition-fee" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <TuitionFee />
          </div>
        </TabsContent>
        <TabsContent value="discounts" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <Discounts />
          </div>
        </TabsContent>
        <TabsContent value="sundry-account" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <FinanceMaintenanceScreen spec={sundryacc} />
          </div>
        </TabsContent>
        <TabsContent value="purchase-requisition" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <FinanceMaintenanceScreen spec={requisitionSpec} />
          </div>
        </TabsContent>
        <TabsContent value="purchase-order" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <FinanceMaintenanceScreen spec={purchaseOrderSpec} />
          </div>
        </TabsContent>
        <TabsContent value="petty-cash-voucher" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <div className="rounded-2xl border border-border h-full p-7 flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-muted-foreground">
                Petty Cash Voucher uses a different entry flow for now — it isn&apos;t
                spec-driven yet (no list, view, or edit support), so it can&apos;t join
                this screen&apos;s Add/Edit/Delete pattern without that work first.
              </p>
              <Button render={<Link href="/finance/transactions/petty_cash_entry" />} nativeButton={false}>
                Open Petty Cash Entry
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="canteen-entry" className="mt-0 min-w-0 flex-1">
          <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
            <FinanceMaintenanceScreen spec={canteenPcvSpec} />
          </div>
        </TabsContent>
    </Tabs>
  )
}

export default finance_maintenance
