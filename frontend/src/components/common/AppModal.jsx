import { useEffect } from 'react'
import { CloseIcon } from './Icons'

const AppModal = ({
  open,
  title,
  subtitle,
  children,
  onClose,
  size = 'medium',
  className = '',
  eyebrow = '',
  icon = null,
}) => {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="app-modal-layer">
      <button type="button" className="app-modal-backdrop" aria-label="모달 닫기" onClick={onClose} />
      <section className={`app-modal app-modal-${size} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="app-modal-header">
          <div className="app-modal-heading">
            {icon && (
              <span className="app-modal-header-icon">
                {icon}
              </span>
            )}

            <div>
              {eyebrow && (
                <span className="app-modal-eyebrow">
                  {eyebrow}
                </span>
              )}

              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="닫기"><CloseIcon /></button>
        </header>
        <div className="app-modal-content">{children}</div>
      </section>
    </div>
  )
}

export default AppModal
