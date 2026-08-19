const IconFrame = ({ children, className = '' }) => (
  <svg
    className={`ui-icon ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const PlusIcon = (props) => (
  <IconFrame {...props}>
    <path d="M12 5v14M5 12h14" />
  </IconFrame>
)

export const SearchIcon = (props) => (
  <IconFrame {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </IconFrame>
)

export const MoreIcon = (props) => (
  <IconFrame {...props}>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </IconFrame>
)

export const BellIcon = (props) => (
  <IconFrame {...props}>
    <path d="M6.5 10.2a5.5 5.5 0 0 1 11 0c0 5 2 5.4 2 6.4h-15c0-1 2-1.4 2-6.4Z" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" />
  </IconFrame>
)

export const BellOffIcon = (props) => (
  <IconFrame {...props}>
    <path d="M8.1 6.1a5.5 5.5 0 0 1 9.4 4.1c0 2.2.4 3.5.9 4.4" />
    <path d="M5.6 14.8c.5-.9.9-2.2.9-4.6 0-.5.1-1 .2-1.5" />
    <path d="M4.5 16.6h10.1M10 19a2.2 2.2 0 0 0 4 0M4 4l16 16" />
  </IconFrame>
)

export const UsersIcon = (props) => (
  <IconFrame {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.8 19c.4-3.5 2.2-5.2 5.2-5.2s4.8 1.7 5.2 5.2" />
    <path d="M15.2 5.7a2.8 2.8 0 0 1 0 5.1M16.2 13.8c2.3.4 3.6 2.1 3.9 4.7" />
  </IconFrame>
)

export const UserPlusIcon = (props) => (
  <IconFrame {...props}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.5-3.7 2.3-5.5 5.5-5.5 2.2 0 3.8.9 4.7 2.7" />
    <path d="M18 11v6M15 14h6" />
  </IconFrame>
)

export const SparklesIcon = (props) => (
  <IconFrame {...props}>
    <path d="M12 3.5c.6 4.1 2.4 5.9 6.5 6.5-4.1.6-5.9 2.4-6.5 6.5-.6-4.1-2.4-5.9-6.5-6.5 4.1-.6 5.9-2.4 6.5-6.5Z" />
    <path d="M18.5 15.5c.3 2 1.2 2.9 3 3-1.8.2-2.7 1.1-3 3-.3-1.9-1.2-2.8-3-3 1.8-.1 2.7-1 3-3Z" />
  </IconFrame>
)

export const ImageIcon = (props) => (
  <IconFrame {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m5.5 17 4.2-4.2 3.2 3.1 2.1-2.1 3.5 3.2" />
  </IconFrame>
)

export const SmileIcon = (props) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 10h.01M15.5 10h.01M8.5 14.2c1 1.3 2.1 1.8 3.5 1.8s2.5-.5 3.5-1.8" />
  </IconFrame>
)

export const PencilIcon = (props) => (
  <IconFrame {...props}>
    <path d="m4 20 4.2-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10L4 20Z" />
    <path d="m13.7 7.3 3 3" />
  </IconFrame>
)

export const LogoutIcon = (props) => (
  <IconFrame {...props}>
    <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10" />
    <path d="M14.5 8.5 18 12l-3.5 3.5M9 12h9" />
  </IconFrame>
)

export const CloseIcon = (props) => (
  <IconFrame {...props}>
    <path d="m7 7 10 10M17 7 7 17" />
  </IconFrame>
)

export const ReplyIcon = (props) => (
  <IconFrame {...props}>
    <path d="m10 8-5 4 5 4" />
    <path d="M5.5 12H14c3.3 0 5 1.8 5 5" />
  </IconFrame>
)

export const TrashIcon = (props) => (
  <IconFrame {...props}>
    <path d="M4.5 7h15M9 7V4.8h6V7M7 7l.7 12h8.6L17 7" />
    <path d="M10 10.5v5M14 10.5v5" />
  </IconFrame>
)

export const LinkIcon = (props) => (
  <IconFrame {...props}>
    <path d="m10 13.8 4-4" />
    <path d="M7.4 15.9 5.8 17.5a3.3 3.3 0 0 1-4.7-4.7l3.4-3.4a3.3 3.3 0 0 1 4.7 0" />
    <path d="m16.6 8.1 1.6-1.6a3.3 3.3 0 0 1 4.7 4.7l-3.4 3.4a3.3 3.3 0 0 1-4.7 0" />
  </IconFrame>
)

export const MailIcon = (props) => (
  <IconFrame {...props}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="m5 7 7 5 7-5" />
  </IconFrame>
)

export const KakaoIcon = ({ className = '' }) => (
  <svg
    className={`ui-icon ${className}`}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 3C6.5 3 2 6.55 2 10.93c0 2.82 1.86 5.3 4.66 6.7l-.94 3.47c-.08.3.26.54.52.37l4.13-2.73c.53.07 1.08.11 1.63.11 5.5 0 10-3.54 10-7.92S17.5 3 12 3Z" />
  </svg>
)

export const LockIcon = (props) => (
  <IconFrame {...props}>
    <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
  </IconFrame>
)

export const ShieldIcon = (props) => (
  <IconFrame {...props}>
    <path d="M12 3 19 6v5.2c0 4.3-2.2 7.3-7 9.8-4.8-2.5-7-5.5-7-9.8V6l7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </IconFrame>
)

export const EyeIcon = (props) => (
  <IconFrame {...props}>
    <path d="M2.8 12s3.4-5 9.2-5 9.2 5 9.2 5-3.4 5-9.2 5-9.2-5-9.2-5Z" />
    <circle cx="12" cy="12" r="2.4" />
  </IconFrame>
)

export const EyeOffIcon = (props) => (
  <IconFrame {...props}>
    <path d="M4 4 20 20M9.9 7.3A10 10 0 0 1 12 7c5.8 0 9.2 5 9.2 5a15 15 0 0 1-2.3 2.7M6.4 8.1A15.5 15.5 0 0 0 2.8 12s3.4 5 9.2 5c1.2 0 2.3-.2 3.3-.6M10.3 10.3a2.4 2.4 0 0 0 3.4 3.4" />
  </IconFrame>
)

export const CheckIcon = (props) => (
  <IconFrame {...props}>
    <path d="m5 12.5 4.3 4.2L19 7" />
  </IconFrame>
)

export const ArrowRightIcon = (props) => (
  <IconFrame {...props}>
    <path d="M5 12h14M14 7l5 5-5 5" />
  </IconFrame>
)
