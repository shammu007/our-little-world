/**
 * A form that never relies on the browser's native "submit" event. Some embedded
 * previews (sandboxed iframes without allow-forms) silently drop form submits,
 * which made buttons look dead. Enter in an input and the submit button both call
 * onSubmit directly.
 */
export function SafeForm({ onSubmit, children, className }: { onSubmit: () => void; children: React.ReactNode; className?: string }) {
  return (
    <form
      className={className}
      noValidate
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
          onSubmit()
        }
      }}
    >
      {children}
    </form>
  )
}
