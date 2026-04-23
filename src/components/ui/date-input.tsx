import { forwardRef, useEffect, useState } from 'react'
import { Input, InputProps } from './input'

export interface DateInputProps extends Omit<InputProps, 'type'> {}

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, defaultValue, placeholder = '01.01.2000', onFocus, onBlur, onChange, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const [hasValue, setHasValue] = useState(() => {
      if (value !== undefined) return typeof value === 'string' ? value.length > 0 : value != null
      if (defaultValue !== undefined) return typeof defaultValue === 'string' ? defaultValue.length > 0 : defaultValue != null
      return false
    })

    useEffect(() => {
      if (value !== undefined) {
        setHasValue(typeof value === 'string' ? value.length > 0 : value != null)
      }
    }, [value])

    const showAsDate = focused || hasValue
    return (
      <Input
        ref={ref}
        type={showAsDate ? 'date' : 'text'}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onFocus={e => {
          setFocused(true)
          e.currentTarget.type = 'date'
          e.currentTarget.showPicker?.()
          onFocus?.(e)
        }}
        onBlur={e => {
          setFocused(false)
          setHasValue(!!e.currentTarget.value)
          onBlur?.(e)
        }}
        onChange={e => {
          setHasValue(!!e.target.value)
          onChange?.(e)
        }}
        {...props}
      />
    )
  },
)
DateInput.displayName = 'DateInput'

export { DateInput }
