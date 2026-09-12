"use client"

import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { breadcrumbResolvers } from "@/lib/breadcrumbs/config"

export function DynamicCrumbLabel({
  resolverKey,
  id,
}: {
  resolverKey: string
  id: string
}) {
  const resolver = breadcrumbResolvers[resolverKey]

  const { data, isLoading } = useQuery({
    queryKey: ["breadcrumb", resolverKey, id],
    queryFn: () => resolver(id),
    enabled: !!resolver,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <Skeleton className="inline-block h-4 w-20 align-middle" />

  return <>{data ?? id}</>
}