import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"

const variantClasses: Record<ButtonVariant, string> = {
  default: "btn btn-primary",
  outline: "btn btn-outline",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  destructive: "btn btn-error",
  link: "btn btn-link",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "",
  xs: "btn-xs",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-square btn-sm",
  "icon-xs": "btn-square btn-xs",
  "icon-sm": "btn-square btn-sm",
  "icon-lg": "btn-square",
}

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(
    variantClasses[variant],
    sizeClasses[size],
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className
  )
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
