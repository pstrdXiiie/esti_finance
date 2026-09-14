"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export interface RecordViewField<T> {
    label: string
    render: (row: T) => React.ReactNode
}

export interface RecordViewDialogProps<T> {
    open: boolean
    onOpenChange: (open: boolean) => void
    row: T | null
    fields: RecordViewField<T>[]
    title?: string
}

export function RecordViewDialog<T>({
    open,
    onOpenChange,
    row,
    fields,
    title = "Details",
}: RecordViewDialogProps<T>) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                {row ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2 text-sm">
                        {fields.map((f) => (
                            <div key={f.label} className="space-y-0.5">
                                <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                                <p>{f.render(row)}</p>
                            </div>
                        ))}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
