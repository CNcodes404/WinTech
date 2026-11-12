import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { Input } from './Form';

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type'
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible label (also used as placeholder if none given). */
  label: string;
}

export function SearchInput({
  value,
  onValueChange,
  label,
  className,
  placeholder,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          aria-label="Clear search"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
