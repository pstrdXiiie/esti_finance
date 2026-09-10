"use client"

import { useState } from "react"
import type { Control } from "react-hook-form"
import { useController } from "react-hook-form"

import type {
    ChildTableSpec,
    FieldSpec,
    FormSpec,
    WizardLayout,
    WizardStep,
    WizardStepSection,
} from "@/lib/forms/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DynamicField } from "@/components/sms/DynamicField"
import { ChildTableGrid } from "@/components/sms/ChildTableGrid"

function byNameMap(fields: FieldSpec[]) {
    return new Map(fields.map((f) => [f.fieldname, f]))
}

/** Flat grid of DynamicFields for a list of fieldnames, in the given column count. */
function FieldGrid({
    fieldnames,
    columns,
    byName,
    control,
}: {
    fieldnames: string[]
    columns?: 1 | 2 | 3 | 4
    byName: Map<string, FieldSpec>
    control: Control<Record<string, unknown>>
}) {
    const gridCols =
        columns === 4
            ? "sm:grid-cols-4"
            : columns === 3
                ? "sm:grid-cols-3"
                : columns === 1
                    ? "sm:grid-cols-1"
                    : "sm:grid-cols-2"

    return (
        <div className={cn("grid grid-cols-1 gap-4", gridCols)}>
            {fieldnames.map((fname) => {
                const field = byName.get(fname)
                if (!field) return null
                return <DynamicField key={fname} control={control} spec={field} />
            })}
        </div>
    )
}

/** A titled section wrapping a FieldGrid — used inside plain `sections` and inside `columns[].sections`. */
function FieldSection({
    section,
    byName,
    control,
}: {
    section: WizardStepSection
    byName: Map<string, FieldSpec>
    control: Control<Record<string, unknown>>
}) {
    return (
        <div className="grid gap-3">
            {section.title && (
                <h3 className="text-sm font-medium text-muted-foreground">{section.title}</h3>
            )}
            <FieldGrid
                fieldnames={section.fieldnames}
                columns={section.columns}
                byName={byName}
                control={control}
            />
        </div>
    )
}

/** Two-region (main/sidebar) layout — each region is its own stack of sections. */
function WizardColumns({
    columns,
    byName,
    control,
}: {
    columns: NonNullable<WizardStep["columns"]>
    byName: Map<string, FieldSpec>
    control: Control<Record<string, unknown>>
}) {
    const main = columns.find((c) => c.span === "main")
    const sidebar = columns.find((c) => c.span === "sidebar")

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            {main && (
                <div className="grid gap-6">
                    {main.sections.map((section, i) => (
                        <FieldSection
                            key={section.title ?? i}
                            section={section}
                            byName={byName}
                            control={control}
                        />
                    ))}
                </div>
            )}
            {sidebar && (
                <div className="grid gap-6">
                    {sidebar.sections.map((section, i) => (
                        <FieldSection
                            key={section.title ?? i}
                            section={section}
                            byName={byName}
                            control={control}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Bridges a react-hook-form `control` to ChildTableGrid's controlled
 * `rows`/`onChange` shape. ChildTableGrid itself has no react-hook-form
 * awareness — it just gets fed an array and reports changes back.
 */
function ChildTableField({
    spec,
    control,
}: {
    spec: ChildTableSpec
    control: Control<Record<string, unknown>>
}) {
    const { field } = useController({
        control,
        name: spec.fieldname,
        defaultValue: [],
    })
    const rows = (field.value as Record<string, unknown>[]) ?? []

    return <ChildTableGrid spec={spec} rows={rows} onChange={field.onChange} />
}

/** A button that opens a small dialog scoped to one step — either flat fields or a child table. */
function StepDialog({
    dialog,
    byName,
    control,
}: {
    dialog: NonNullable<WizardStep["dialog"]>
    byName: Map<string, FieldSpec>
    control: Control<Record<string, unknown>>
}) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                {dialog.buttonLabel}
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{dialog.title}</DialogTitle>
                </DialogHeader>
                {dialog.childTable ? (
                    <ChildTableField spec={dialog.childTable} control={control} />
                ) : (
                    <FieldGrid
                        fieldnames={dialog.fieldnames ?? []}
                        byName={byName}
                        control={control}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

function NotBuiltYetPlaceholder({ note }: { note?: string }) {
    return (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {note ?? "This step hasn't been built yet."}
        </div>
    )
}

/**
 * Renders one WizardStep's body. Precedence (per types.ts's doc-comment):
 * columns > sections > fieldnames, with childTable rendered in addition to
 * whichever of those is present, and dialog rendered independently at the
 * end regardless of which body variant is used. A step with none of
 * columns/sections/fieldnames.length/childTable shows the placeholder, even
 * if dialog is set.
 */
function StepBody({
    step,
    byName,
    control,
}: {
    step: WizardStep
    byName: Map<string, FieldSpec>
    control: Control<Record<string, unknown>>
}) {
    const hasBody =
        !!step.columns || !!step.sections || step.fieldnames.length > 0 || !!step.childTable

    if (!hasBody) {
        return <NotBuiltYetPlaceholder note={step.note} />
    }

    return (
        <div className="grid gap-6">
            {step.columns ? (
                <WizardColumns columns={step.columns} byName={byName} control={control} />
            ) : step.sections ? (
                <div className="grid gap-6">
                    {step.sections.map((section, i) => (
                        <FieldSection
                            key={section.title ?? i}
                            section={section}
                            byName={byName}
                            control={control}
                        />
                    ))}
                </div>
            ) : step.fieldnames.length > 0 ? (
                <FieldGrid
                    fieldnames={step.fieldnames}
                    columns={step.fieldColumns}
                    byName={byName}
                    control={control}
                />
            ) : null}

            {step.childTable && <ChildTableField spec={step.childTable} control={control} />}

            {step.dialog && (
                <div>
                    <StepDialog dialog={step.dialog} byName={byName} control={control} />
                </div>
            )}
        </div>
    )
}

export function WizardFormLayout({
    spec,
    layout,
    control,
}: {
    spec: FormSpec
    layout: WizardLayout
    control: Control<Record<string, unknown>>
}) {
    const [activeStep, setActiveStep] = useState(0)
    const byName = byNameMap(spec.fields)
    const step = layout.steps[activeStep]

    return (
        <div className="grid gap-6">
            <div className="flex flex-wrap gap-1 border-b pb-2">
                {layout.steps.map((s, i) => (
                    <Button
                        key={s.key}
                        type="button"
                        variant={i === activeStep ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActiveStep(i)}
                    >
                        {s.label}
                    </Button>
                ))}
            </div>

            <StepBody step={step} byName={byName} control={control} />

            <div className="flex items-center justify-between border-t pt-4">
                <Button
                    type="button"
                    variant="outline"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((i) => Math.max(0, i - 1))}
                >
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Step {activeStep + 1} of {layout.steps.length}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    disabled={activeStep === layout.steps.length - 1}
                    onClick={() =>
                        setActiveStep((i) => Math.min(layout.steps.length - 1, i + 1))
                    }
                >
                    Next
                </Button>
            </div>
        </div>
    )
}