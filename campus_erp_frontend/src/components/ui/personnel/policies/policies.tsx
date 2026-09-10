"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PoliciesList } from "./PoliciesList"
import { GroupPoliciesList } from "./GroupPoliciesList"

export const policiesComponent = () => {
    return (
        <Tabs defaultValue="policies" orientation="vertical" className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border">
            <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
                <TabsTrigger value="policies" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Policies
                </TabsTrigger>
                <TabsTrigger value="group-policies" className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground">
                    Group Policies
                </TabsTrigger>
            </TabsList>
            <TabsContent value="policies" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <PoliciesList />
                </div>
            </TabsContent>
            <TabsContent value="group-policies" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <GroupPoliciesList />
                </div>
            </TabsContent>
        </Tabs>
    )
}

export default policiesComponent