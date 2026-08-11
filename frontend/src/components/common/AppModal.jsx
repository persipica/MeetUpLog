import { useEffect } from 'react'

const AppModal = ({ open, title, subtitle, children, onClose, size = 'medium' }) => {
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
      <section className={`app-modal app-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="app-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="app-modal-content">{children}</div>
      </section>
    </div>
  )
}

export default AppModal
