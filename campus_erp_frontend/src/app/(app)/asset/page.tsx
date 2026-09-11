import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import FixedAssetEntry from "@/components/ui/asset/fixed-asset-entry/fixed-asset-entry";


const SCREENS = [
  {
    href: "/asset/register",
    title: "Asset Register",
    description: "The fixed-asset record: purchase cost, location, custodian, category.",
  },
  {
    href: "/asset/models",
    title: "Asset Models",
    description: "Brand/model catalog referenced by the asset register.",
  },
  {
    href: "/asset/dispatch",
    title: "Dispatch & Return",
    description: "Issue an asset to an employee, or receive one back into a location.",
  },
  {
    href: "/asset/transfers",
    title: "Equipment Transfers",
    description: "Move one or more assets to a new location in a single submitted record.",
  },
  {
    href: "/asset/consumables",
    title: "Consumable Issue",
    description: "Issue stock consumable items to an employee.",
  },
  {
    href: "/asset/stickers",
    title: "Sticker Batches",
    description: "Print-run batches of asset barcode/inventory stickers.",
  },
]

export default function AssetPage() {
  return (
    <div className="grid gap-4">
      <Tabs defaultValue="fixed-asset-entry" className="h-full">
        <TabsList className="grid w-full grid-cols-5 h-full gap-2 border-0 bg-sidebar p-1 h-full! rounded-3xl items-center print:hidden">
          <TabsTrigger value="fixed-asset-entry" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Fixed Asset Entry
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Dispatch Item
          </TabsTrigger>
          <TabsTrigger value="item-disposal" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Item Disposal / Transfer
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Reports
          </TabsTrigger>
          <TabsTrigger value="asset-maintenance" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Asset Maintenance
          </TabsTrigger>

        </TabsList>
        <TabsContent value="fixed-asset-entry">
          <FixedAssetEntry />
        </TabsContent>
        <TabsContent value="dispatch" className="min-w-0">
          Tab2 content goes here.
        </TabsContent>
        <TabsContent value="item-disposal" className="min-w-0">
          Tab3 content goes here.
        </TabsContent>
        <TabsContent value="reports">
          Tab4 content goes here.
        </TabsContent>
        <TabsContent value="asset-maintenance">
          Tab6 content goes here.
        </TabsContent>
      </Tabs>


      <div>
        <h1 className="text-2xl font-semibold">Asset & Property</h1>
        <p className="text-muted-foreground">
          Asset register, dispatch/return, equipment transfers, consumables, and stickers.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
