"use client"

import { useState, useRef, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  allLabel?: string
  className?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  allLabel = "All",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearch("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selectedLabel = value === "all"
    ? allLabel
    : options.find((o) => o.value === value)?.label ?? placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between h-7 px-2 text-xs border border-base-300 rounded-md bg-transparent hover:bg-base-200 transition-colors truncate",
            className
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <svg className="w-3 h-3 ml-1 opacity-50 shrink-0" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-1.5">
          <input
            ref={inputRef}
            className="w-full px-2 py-1.5 text-xs bg-base-200 border border-base-300 rounded outline-none focus:border-primary/50"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-48 overflow-y-auto px-1 pb-1">
          <button
            type="button"
            className={cn(
              "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-base-200 transition-colors",
              value === "all" && "bg-primary/10 text-primary"
            )}
            onClick={() => { onValueChange("all"); setOpen(false) }}
          >
            {allLabel}
          </button>
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-base-200 transition-colors flex items-center gap-1.5",
                value === opt.value && "bg-primary/10 text-primary"
              )}
              onClick={() => { onValueChange(opt.value); setOpen(false) }}
            >
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-[10px] text-base-content/40 px-2 py-2">No matches</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
