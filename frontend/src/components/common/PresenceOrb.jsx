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
      <span className="presence-space" aria-hidden="true">
        <i className="presence-star star-one" />
        <i className="presence-star star-two" />
        <i className="presence-star star-three" />
        <i className="presence-star star-four" />
        <i className="presence-star star-five" />
        <i className="presence-star star-six" />
      </span>

      <span className="presence-rays" aria-hidden="true" />

      <span className="presence-celestial" aria-hidden="true">
        <span className="presence-body">
          <i className="presence-crater crater-one" />
          <i className="presence-crater crater-two" />
          <i className="presence-crater crater-three" />
        </span>

        <span className="presence-phase" />
      </span>

      <span className="presence-sleep" aria-hidden="true">
        <i>z</i><i>z</i><i>z</i>
      </span>

      <span className="sr-only">
        {meta.label}
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
