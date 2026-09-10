"use client"

// Extracted, otherwise UNCHANGED, from the old esti_erp_frontend
// personnel/schedules/page.tsx's inline HolidaysTab. Field names
// (holiday_name, month, day) and the MONTHS option list match what
// campus_erp_frontend's HolidaysMaintenance.tsx independently confirmed
// against the live doctype via `bench console` — no logic to fix here.
//
// NOTE ON UI CHOICE: the new codebase replaced this table+dialog pattern
// with a single-record "Add/Edit/Delete/Find" browser (see the flagged
// mismatches note below). Per instruction, we're keeping THIS (old) UI
// shape and just wiring it to the confirmed-correct backend calls.

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    Plus,
    Trash2,
    Edit2,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { frappe, getErrorMessage } from "@/lib/frappe"

const HOLIDAY_DOCTYPE = "SMS Personnel Holidays"

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const

interface HolidayRow {
    name: string
    holiday_name: string
    month: (typeof MONTHS)[number]
    day: number
}

async function fetchHolidays(): Promise<HolidayRow[]> {
    return frappe.list<HolidayRow>(HOLIDAY_DOCTYPE, {
        fields: ["name", "holiday_name", "month", "day"],
        order_by: "month asc, day asc",
        limit_page_length: 100,
    })
}

const holidaySchema = z.object({
    holiday_name: z.string().min(1, "Holiday name is required"),
    month: z.enum(MONTHS, { error: "Month is required" }),
    day: z.coerce.number().int().min(1, "Day must be 1-31").max(31, "Day must be 1-31"),
})
type HolidayFormInput = z.input<typeof holidaySchema>
type HolidayFormValues = z.output<typeof holidaySchema>

function HolidayDialog({
    open,
    onOpenChange,
    defaultValues,
    onSubmit,
    submitting,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultValues?: HolidayFormValues
    onSubmit: (values: HolidayFormValues) => void
    submitting: boolean
}) {
    const isEdit = Boolean(defaultValues)
    const form = useForm<HolidayFormInput, unknown, HolidayFormValues>({
        resolver: zodResolver(holidaySchema),
        values: defaultValues ?? { holiday_name: "", month: "January", day: 1 },
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? "Update this holiday's details."
                                : "Add a new official holiday to the calendar."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="holiday_name">Holiday Name</Label>
                        <Input
                            id="holiday_name"
                            placeholder="e.g. Independence Day"
                            {...form.register("holiday_name")}
                        />
                        {form.formState.errors.holiday_name && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.holiday_name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="month">Month</Label>
                            <Select
                                value={form.watch("month")}
                                onValueChange={(v) =>
                                    form.setValue("month", v as HolidayFormValues["month"], { shouldValidate: true })
                                }
                            >
                                <SelectTrigger id="month">
                                    <SelectValue placeholder="Select month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="day">Day</Label>
                            <Input id="day" type="number" min={1} max={31} {...form.register("day")} />
                            {form.formState.errors.day && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.day.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {isEdit ? "Save Changes" : "Add Holiday"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function HolidaysTab() {
    const queryClient = useQueryClient()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<HolidayRow | null>(null)

    const { data: holidays, isLoading, isError, error } = useQuery({
        queryKey: ["holidays"],
        queryFn: fetchHolidays,
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["holidays"] })

    const createMutation = useMutation({
        mutationFn: (values: HolidayFormValues) => frappe.createDoc(HOLIDAY_DOCTYPE, values),
        onSuccess: () => {
            toast.success("Holiday added")
            setDialogOpen(false)
            invalidate()
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const updateMutation = useMutation({
        mutationFn: ({ name, values }: { name: string; values: HolidayFormValues }) =>
            frappe.updateDoc(HOLIDAY_DOCTYPE, name, values),
        onSuccess: () => {
            toast.success("Holiday updated")
            setDialogOpen(false)
            setEditing(null)
            invalidate()
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const deleteMutation = useMutation({
        mutationFn: (name: string) => frappe.deleteDoc(HOLIDAY_DOCTYPE, name),
        onSuccess: () => {
            toast.success("Holiday deleted")
            invalidate()
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    })

    const handleAdd = () => {
        setEditing(null)
        setDialogOpen(true)
    }

    const handleEdit = (row: HolidayRow) => {
        setEditing(row)
        setDialogOpen(true)
    }

    const handleDelete = (row: HolidayRow) => {
        if (confirm(`Delete "${row.holiday_name}"? This can't be undone.`)) {
            deleteMutation.mutate(row.name)
        }
    }

    const handleSubmit = (values: HolidayFormValues) => {
        if (editing) {
            updateMutation.mutate({ name: editing.name, values })
        } else {
            createMutation.mutate(values)
        }
    }

    const submitting = createMutation.isPending || updateMutation.isPending

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                    <CardTitle className="text-base font-medium">Official Holidays</CardTitle>
                    <CardDescription className="text-xs">
                        Maintain the holiday calendar for timekeeping and payroll calculations.
                    </CardDescription>
                </div>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAdd}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Holiday
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading holidays…
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center text-xs text-destructive">
                        {getErrorMessage(error)}
                    </div>
                ) : !holidays?.length ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                        No holidays yet. Add the first one above.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs">Holiday Name</TableHead>
                                <TableHead className="text-xs">Month</TableHead>
                                <TableHead className="text-xs">Day</TableHead>
                                <TableHead className="text-right text-xs">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {holidays.map((holiday) => (
                                <TableRow key={holiday.name}>
                                    <TableCell className="font-medium text-xs">{holiday.holiday_name}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="font-normal text-[10px]">
                                            {holiday.month}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{holiday.day}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(holiday)}>
                                                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => handleDelete(holiday)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <HolidayDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                defaultValues={editing ?? undefined}
                onSubmit={handleSubmit}
                submitting={submitting}
            />
        </Card>
    )
}