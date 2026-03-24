"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

// ── Single-select ──

interface SingleSelectProps {
  multi?: false
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  allLabel?: string
  className?: string
}

// ── Multi-select ──

interface MultiSelectProps {
  multi: true
  values: string[]
  onValuesChange: (values: string[]) => void
  options: SearchableSelectOption[]
  placeholder?: string
  allLabel?: string
  className?: string
}

type SearchableSelectProps = SingleSelectProps | MultiSelectProps

export function SearchableSelect(props: SearchableSelectProps) {
  const { options, placeholder = "Select...", allLabel = "All", className } = props
  const isMulti = props.multi === true

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

  const totalItems = filtered.length + 1

  useEffect(() => { setHighlightIndex(0) }, [search])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: "nearest" })
  }, [highlightIndex])

  // Multi helpers
  const multiValues = isMulti ? (props as MultiSelectProps).values : []
  const isSelected = (val: string) => isMulti ? multiValues.includes(val) : (props as SingleSelectProps).value === val
  const isAllSelected = isMulti ? multiValues.length === 0 : (props as SingleSelectProps).value === "all"

  const handleSelect = useCallback((val: string) => {
    if (isMulti) {
      const { values, onValuesChange } = props as MultiSelectProps
      if (val === "__all__") {
        onValuesChange([])
      } else {
        const next = values.includes(val)
          ? values.filter((v) => v !== val)
          : [...values, val]
        onValuesChange(next)
      }
      // Don't close on multi-select
    } else {
      const { onValueChange } = props as SingleSelectProps
      onValueChange(val === "__all__" ? "all" : val)
      setOpen(false)
    }
  }, [isMulti, props])

  const selectByIndex = useCallback((idx: number) => {
    if (idx === 0) {
      handleSelect("__all__")
    } else {
      const opt = filtered[idx - 1]
      if (opt) handleSelect(opt.value)
    }
  }, [filtered, handleSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, totalItems - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      selectByIndex(highlightIndex)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }, [totalItems, highlightIndex, selectByIndex])

  // Display label
  let displayLabel: string
  if (isMulti) {
    const count = multiValues.length
    if (count === 0) {
      displayLabel = allLabel
    } else if (count === 1) {
      displayLabel = options.find((o) => o.value === multiValues[0])?.label ?? "1 selected"
    } else {
      displayLabel = `${count} selected`
    }
  } else {
    const val = (props as SingleSelectProps).value
    displayLabel = val === "all" ? allLabel : options.find((o) => o.value === val)?.label ?? placeholder
  }

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
          <span className="truncate">{displayLabel}</span>
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
              "w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-1.5",
              highlightIndex === 0 ? "bg-base-200" : "hover:bg-base-200",
              isAllSelected && "text-primary"
            )}
            onClick={() => selectByIndex(0)}
            onMouseEnter={() => setHighlightIndex(0)}
          >
            {isMulti && <span className={cn("w-3 h-3 border rounded-sm text-[8px] flex items-center justify-center shrink-0", isAllSelected ? "border-primary bg-primary text-primary-content" : "border-base-300")}>{isAllSelected ? "✓" : ""}</span>}
            {allLabel}
          </button>
          {filtered.map((opt, i) => {
            const checked = isSelected(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-1.5",
                  highlightIndex === i + 1 ? "bg-base-200" : "hover:bg-base-200",
                  checked && "text-primary"
                )}
                onClick={() => selectByIndex(i + 1)}
                onMouseEnter={() => setHighlightIndex(i + 1)}
              >
                {isMulti && <span className={cn("w-3 h-3 border rounded-sm text-[8px] flex items-center justify-center shrink-0", checked ? "border-primary bg-primary text-primary-content" : "border-base-300")}>{checked ? "✓" : ""}</span>}
                {opt.icon}
                <span className="truncate">{opt.label}</span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-[10px] text-base-content/40 px-2 py-2">No matches</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
