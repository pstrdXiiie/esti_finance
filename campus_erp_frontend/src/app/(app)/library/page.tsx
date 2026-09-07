import Link from "next/link"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const SCREENS = [
  {
    href: "/library/authors",
    title: "Authors",
    description: "Author records referenced by book titles.",
  },
  {
    href: "/library/publishers",
    title: "Publishers",
    description: "Publisher records referenced by book titles.",
  },
  {
    href: "/library/titles",
    title: "Titles",
    description: "Catalog titles with ISBN, category, and cost, plus their authors.",
  },
  {
    href: "/library/books",
    title: "Books",
    description: "Individual accessioned copies of a title, tracked by call number and shelf.",
  },
  {
    href: "/library/guests",
    title: "Guests",
    description: "Non-student, non-employee borrowers registered with the library.",
  },
  {
    href: "/library/settings",
    title: "Settings",
    description: "Fine rate, default loan period, and borrowing limits for the library.",
  },
  {
    href: "/library/circulation",
    title: "Circulation",
    description: "Borrow requests, loans, returns, and fines.",
  },
]

export default function LibraryPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground">
          Catalog, accessioned copies, guest borrowers, circulation, and library-wide settings.
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
