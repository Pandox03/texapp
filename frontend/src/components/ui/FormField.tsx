import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type BaseProps = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  wrapperClassName?: string
}

type InputFieldProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    as?: 'input'
  }

type TextareaFieldProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: 'textarea'
  }

type SelectFieldProps = BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: 'select'
    children: ReactNode
  }

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps

const fieldClass =
  'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-surface disabled:text-muted'

export default function FormField(props: FormFieldProps) {
  const { label, hint, error, required, wrapperClassName = '' } = props

  return (
    <div className={wrapperClassName}>
      <label className="mb-1 block text-sm font-medium text-navy-800">
        {label}
        {required && <span className="ms-1 text-red-500">*</span>}
      </label>
      {props.as === 'textarea' ? (
        (() => {
          const { as: _as, label: _l, hint: _h, error: _e, required: _r, wrapperClassName: _w, ...rest } = props
          return <textarea {...rest} className={`${fieldClass} ${rest.className ?? ''}`} />
        })()
      ) : props.as === 'select' ? (
        (() => {
          const { as: _as, label: _l, hint: _h, error: _e, required: _r, wrapperClassName: _w, children, ...rest } = props
          return (
            <select {...rest} className={`${fieldClass} ${rest.className ?? ''}`}>
              {children}
            </select>
          )
        })()
      ) : (
        (() => {
          const { as: _as, label: _l, hint: _h, error: _e, required: _r, wrapperClassName: _w, ...rest } = props
          return <input {...rest} className={`${fieldClass} ${rest.className ?? ''}`} />
        })()
      )}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 whitespace-pre-line">{error}</p>}
    </div>
  )
}
