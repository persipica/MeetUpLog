import {
  getPresence,
} from '../../config/presence'

const PresenceOrb = ({
  presence = 'OFFLINE',
  size = 'mini',
  animated = true,
  showLabel = false,
}) => {
  const meta = getPresence(presence)

  return (
    <span
      className={[
        'presence-orb',
        `presence-${meta.key}`,
        `presence-${size}`,
        animated
          ? 'presence-animated'
          : 'presence-static',
      ].join(' ')}
      title={meta.label}
      aria-label={meta.label}
    >
      <span className="presence-space">
        <i className="presence-star star-one" />
        <i className="presence-star star-two" />
        <i className="presence-star star-three" />
      </span>

      <span className="presence-rays">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>

      <span className="presence-body">
        <i className="presence-crater crater-one" />
        <i className="presence-crater crater-two" />
      </span>

      <span className="presence-eclipse" />

      <span className="presence-sleep">
        zzz
      </span>

      {showLabel && (
        <span className="presence-label">
          {meta.label}
        </span>
      )}
    </span>
  )
}

export default PresenceOrb
