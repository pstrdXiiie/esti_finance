// components/breadcrumbs/app-breadcrumb.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"


import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  breadcrumbResolvers,
  hiddenSegments,
  staticLabels,
} from "@/lib/breadcrumbs/config"
import { DynamicCrumbLabel } from "./dynamic-crumb-label"

function toTitleCase(segment: string) {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

interface CrumbNode {
  href: string
  segment: string
  isDynamic: boolean
  resolverKey?: string
  staticLabel: string
}

function buildCrumbs(pathname: string): CrumbNode[] {
  const segments = pathname.split("/").filter(Boolean)
  const nodes: CrumbNode[] = []
  let previousStaticLabel = "Home"

  segments.forEach((segment, i) => {
    if (hiddenSegments.has(segment)) return

    const href = "/" + segments.slice(0, i + 1).join("/")
    const parent = i > 0 ? segments[i - 1] : null
    const resolver = parent ? breadcrumbResolvers[parent] : undefined

    const staticLabel = resolver
      ? segment
      : staticLabels[segment] ?? toTitleCase(segment)

    if (!resolver && staticLabel.toLowerCase() === previousStaticLabel.toLowerCase()) {
      return
    }

    nodes.push({
      href,
      segment,
      isDynamic: !!resolver,
      resolverKey: parent ?? undefined,
      staticLabel,
    })

    if (!resolver) previousStaticLabel = staticLabel
  })

  return nodes
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname)

  if (pathname === "/dashboard") return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard" />}>
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>

        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          const label = crumb.isDynamic ? (
            <DynamicCrumbLabel resolverKey={crumb.resolverKey!} id={crumb.segment} />
          ) : (
            crumb.staticLabel
          )

          return (
           <React.Fragment key={crumb.href}>
                <BreadcrumbSeparator/>
                <BreadcrumbItem>
                    {isLast ? (
                        <BreadcrumbPage>{label}</BreadcrumbPage>
                    ):(
                        <BreadcrumbLink render={<Link href={crumb.href} />}>
                            {label}
                        </BreadcrumbLink>
                    
                    )}
                </BreadcrumbItem>
           </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}