export function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
        {value === "" || value === null || value === undefined ? "—" : value}
      </p>
    </div>
  )
}
