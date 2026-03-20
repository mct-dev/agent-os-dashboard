import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"

const variantClasses: Record<BadgeVariant, string> = {
  default: "badge badge-primary",
  secondary: "badge badge-secondary",
  destructive: "badge badge-error",
  outline: "badge badge-outline",
  ghost: "badge badge-ghost",
  link: "badge text-primary underline-offset-4 hover:underline",
}

function badgeVariants({
  variant = "default",
  className,
}: {
  variant?: BadgeVariant
  className?: string
} = {}) {
  return cn(variantClasses[variant], className)
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & {
  variant?: BadgeVariant
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
