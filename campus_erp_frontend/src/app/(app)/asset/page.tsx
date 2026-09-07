import Link from "next/link"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
