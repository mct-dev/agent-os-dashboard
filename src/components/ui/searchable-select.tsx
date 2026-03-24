"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setSearch("")
      setHighlightIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  // "all" is index 0, then filtered options are 1..N
  const totalItems = filtered.length + 1

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIndex(0)
  }, [search])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: "nearest" })
  }, [highlightIndex])

  const select = useCallback((idx: number) => {
    if (idx === 0) {
      onValueChange("all")
    } else {
      const opt = filtered[idx - 1]
      if (opt) onValueChange(opt.value)
    }
    setOpen(false)
  }, [filtered, onValueChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, totalItems - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      select(highlightIndex)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }, [totalItems, highlightIndex, select])

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
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="max-h-48 overflow-y-auto px-1 pb-1">
          <button
            type="button"
            className={cn(
              "w-full text-left text-xs px-2 py-1.5 rounded transition-colors",
              highlightIndex === 0 ? "bg-base-200" : "hover:bg-base-200",
              value === "all" && "text-primary"
            )}
            onClick={() => select(0)}
            onMouseEnter={() => setHighlightIndex(0)}
          >
            {allLabel}
          </button>
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-1.5",
                highlightIndex === i + 1 ? "bg-base-200" : "hover:bg-base-200",
                value === opt.value && "text-primary"
              )}
              onClick={() => select(i + 1)}
              onMouseEnter={() => setHighlightIndex(i + 1)}
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
