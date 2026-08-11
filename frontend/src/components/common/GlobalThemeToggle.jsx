const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="3.4"
      fill="currentColor"
    />

    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    >
      <path d="M12 2.8V5" />
      <path d="M12 19V21.2" />
      <path d="M2.8 12H5" />
      <path d="M19 12H21.2" />
      <path d="M5.5 5.5L7 7" />
      <path d="M17 17L18.5 18.5" />
      <path d="M18.5 5.5L17 7" />
      <path d="M7 17L5.5 18.5" />
    </g>
  </svg>
)

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M18.5 15.2A7.7 7.7 0 0 1 8.8 5.5a7.75 7.75 0 1 0 9.7 9.7Z"
      fill="currentColor"
    />
  </svg>
)

const GlobalThemeToggle = ({
  mode,
  onToggle,
}) => {
  const dark =
    mode === 'dark'

  return (
    <button
      type="button"
      className={`global-theme-toggle ${
        dark ? 'dark' : 'light'
      }`}
      onClick={onToggle}
      aria-label={
        dark
          ? '라이트 모드로 변경'
          : '다크 모드로 변경'
      }
      title={
        dark
          ? '라이트 모드'
          : '다크 모드'
      }
    >
      <span className="theme-toggle-glow" />

      <span className="theme-toggle-icon sun">
        <SunIcon />
      </span>

      <span className="theme-toggle-icon moon">
        <MoonIcon />
      </span>
    </button>
  )
}

export default GlobalThemeToggle
