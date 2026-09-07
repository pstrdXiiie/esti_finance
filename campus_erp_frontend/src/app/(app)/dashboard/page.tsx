"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/providers/AuthProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, X } from "lucide-react"
import { Icon } from "@iconify/react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Calendar } from "@/components/ui/calendar"
import { frappe } from "@/lib/frappe"



const ChartData = [
  { location: "Odiongan", tourism: 4000, computer_science: 2400, criminology: 2400 },
  { location: "Looc", tourism: 3000, computer_science: 1398, criminology: 2210 },
  { location: "Alcantara", tourism: 2000, computer_science: 9800, criminology: 2290 },
  { location: "Sta. Fe", tourism: 2780, computer_science: 3908, criminology: 2000 },
  { location: "Sta. Maria", tourism: 1890, computer_science: 4800, criminology: 2181 },
  { location: "San Agustin", tourism: 2390, computer_science: 3800, criminology: 2500 },
  { location: "San Andres", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "Romblon", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "San Jose", tourism: 3490, computer_science: 4300, criminology: 2100},
  { location: "Calatrava", tourism: 3490, computer_science: 4300, criminology: 2100},
  { location: "Sibuyan", tourism: 3490, computer_science: 4300, criminology: 2100},
]

const ChartConfig = {
  tourism: {
    label: "Tourism",
    color: "var(--chart-1)",
  },
  computer_science: {
    label: "Computer Science",
    color: "var(--chart-2)",
  },
  criminology: {
    label: "Criminology",
    color: "var(--chart-3)",
  }
} satisfies ChartConfig

export default function DashboardPage() {
  const { user } = useAuth()
  const studentCountQuery = useQuery({
    queryKey: ["Student", "count", "active"],
    queryFn: () =>
      frappe.call<number>("frappe.client.get_count", {
        doctype: "Student",
      }),
  })

  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <div className="grid gap-2">
      
      <div className="mb-4 bg-card p-4 shadow-md rounded-lg">
        <h2 className="text-2xl font-bold">Overview</h2>
        
        <div className="flex items-center mt-4 p-4 justify-evenly ">
          <div className="flex divide-x divide-gray-300 gap-4 w-full justify-around">
            <div className="flex flex-row gap-4 items-center pr-6">
              <div className="flex flex-col gap-0">
                <span className="text-md font-semibold">Total Students</span>
                <h2 className="text-2xl font-bold">
                  {studentCountQuery.data ?? "-"}
                </h2>
              </div>
              <Icon
              icon="mdi:graduation-cap"
              className="text-5xl text-foreground"
              />
            </div>
            <div className="flex flex-row gap-4 items-center pr-6">
              <div className="flex flex-col gap-0">
                <span className="text-md font-semibold">Total Employees</span>
                <h2 className="text-2xl font-bold">1234</h2>
              </div>
              <Icon
              icon="mdi:graduation-cap"
              className="text-5xl text-foreground"
              />
            </div>
            <div className="flex flex-row gap-4 items-center pr-6">
              <div className="flex flex-col gap-0">
                <span className="text-md font-semibold">Total Teachers</span>
                <h2 className="text-2xl font-bold">1,234</h2>
              </div>
              <Icon
              icon="mdi:graduation-cap"
              className="text-5xl text-foreground"
              />
            </div>
            <div className="flex flex-row gap-4 items-center pr-6">
              <div className="flex flex-col gap-0">
                <span className="text-md font-semibold">Total Earnings</span>
                <h2 className="text-2xl font-bold">1,234</h2>
              </div>
              <Icon
              icon="mdi:graduation-cap"
              className="text-5xl text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

    <main className="grid items-stretch aspect-auto grid-cols-[1.08fr_0.2fr] gap-4">
      <section className="flex h-full min-h-0 flex-col rounded-2xl bg-card p-5 shadow-md">
        <h2 className="text-2xl font-bold mb-3">Enrollees</h2>
        <ChartContainer config={ChartConfig} className="min-h-0 flex-1 aspect-auto w-full">
          <BarChart accessibilityLayer data={ChartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="location"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 20)}
             />
             <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="tourism" fill={ChartConfig.tourism.color} />
            <Bar dataKey="computer_science" fill={ChartConfig.computer_science.color} />
            <Bar dataKey="criminology" fill={ChartConfig.criminology.color} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="grid h-full min-h-0 grid-rows-[1fr_0.72fr] gap-4">
        <div className="rounded-2xl bg-card p-5 shadow-md">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg"
            />
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-md">
          Pending Approvals
        </div>
      </section>
    </main>



      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {user?.modules.map((module) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="text-base">{module}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Module scaffold — screens land here module by module, per the
              blueprint&apos;s phased roadmap.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
