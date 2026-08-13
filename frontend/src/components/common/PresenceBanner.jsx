import PresenceOrb from './PresenceOrb'

import {
  getPresence,
} from '../../config/presence'

const PresenceBanner = ({
  presence = 'OFFLINE',
  size = 'large',
  className = '',
}) => {
  const meta = getPresence(presence)

  return (
    <div
      className={[
        'presence-banner',
        `presence-banner-${meta.key}`,
        className,
      ].join(' ')}
      data-presence={meta.key}
    >
      <span className="presence-banner-light" aria-hidden="true" />

      <span className="presence-banner-cloud cloud-one" aria-hidden="true" />
      <span className="presence-banner-cloud cloud-two" aria-hidden="true" />

      <span className="presence-banner-stars" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, index) => (
          <i key={index} />
        ))}
      </span>

      <PresenceOrb
        presence={presence}
        size={size}
        animated
      />
    </div>
  )
}

export default PresenceBanner
