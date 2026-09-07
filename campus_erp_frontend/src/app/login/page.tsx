"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const loginSchema = z.object({
  usr: z.string().min(1, "Username or email is required"),
  pwd: z.string().min(1, "Password is required"),
})

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usr: "", pwd: "" },
  })

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setSubmitting(true)
    try {
      await login(values.usr, values.pwd)
      router.push("/")
    } catch {
      toast.error("Invalid username or password")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-4"
      style={{ backgroundImage: "url('/gradient-green-bg.jpg')" }}
    >

      <Card className="relative z-10 w-full max-w-2xl rounded-xl border-0 bg-white/95 p-8 shadow-2xl">
        <CardHeader className="space-y-3 pb-4 text-center">
          <div>
            <CardTitle className="text-6xl font-bold text-slate-900">
              Welcome Back!
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              Enter your credentials to continue.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="usr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">
                      Username or Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        className="h-11 rounded-xl border-slate-200 bg-slate-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pwd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        className="h-11 rounded-xl border-slate-200 bg-slate-50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 h-12 rounded-xl text-2xl"
              >
                {submitting ? "Signing in…" : "LOGIN"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}