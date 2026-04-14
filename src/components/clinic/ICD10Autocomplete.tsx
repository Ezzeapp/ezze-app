import { useState, useRef } from 'react'
import { useClinicICD10Search } from '@/hooks/useClinicICD10'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ICD10AutocompleteProps {
  value: string
  onChange: (code: string, name: string) => void
  placeholder?: string
  className?: string
}

export function ICD10Autocomplete({ value, onChange, placeholder, className }: ICD10AutocompleteProps) {
  const [search, setSearch] = useState(value || '')
  const [open, setOpen] = useState(false)
  const { data: results = [], isLoading } = useClinicICD10Search(search)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>()

  const handleSelect = (code: string, name: string) => {
    setSearch(code)
    setOpen(false)
    onChange(code, name)
  }

  return (
    <div className="relative">
      <Input
        className={cn('h-9', className)}
        placeholder={placeholder || 'K02.1'}
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => { if (search.length >= 2) setOpen(true) }}
        onBlur={() => { blurTimeout.current = setTimeout(() => setOpen(false), 200) }}
      />
      {isLoading && search.length >= 2 && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-md">
          {results.map(r => (
            <button
              key={r.code}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-0"
              onMouseDown={e => { e.preventDefault(); clearTimeout(blurTimeout.current); handleSelect(r.code, r.name_ru) }}
            >
              <span className="font-bold text-primary">{r.code}</span>
              <span className="text-muted-foreground"> — {r.name_ru}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
