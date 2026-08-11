import {
  useEffect,
} from 'react'

const CONTROL_SELECTOR = [
  '.global-theme-toggle',

  '.sidebar-tabs',
  '.sidebar-tabs button',

  '.room-item',
  '.sidebar-friend-item',
  '.member-item',

  '.new-room-button',
  '.sidebar-utility-button',
  '.sidebar-user',

  '.invite-button',
  '.member-count-button',
  '.header-more-button',
  '.home-header-create',
  '.utility-close-button',

  '.composer-plus-button',
  '.send-button',
  '.composer-action',
  '.mobile-sheet-cancel',

  '.profile-popover-action',
  '.presence-select-menu button',

  '.profile-photo-button',
  '.profile-photo-remove',
  '.profile-edit-save',
  '.profile-edit-cancel',
  '.profile-unified-button',

  '.primary-action',
  '.secondary-action',
  '.danger-action',

  '.message-action-button',
  '.message-quick-reaction',
  '.message-reaction-chip',
  '.composer-emoji-button',
  '.emoji-picker-grid button',
  '.emoji-picker-header button',
  '.emoji-picker-search',
  '.emoji-search-clear',
  '.composer-context-close',

  '.profile-edit-preview',
  '.profile-setting-card',
  '.profile-danger-zone',
  '.profile-photo-control',

  '.main-home-room-card',
  '.workspace-notification-item',
  '.friend-add-panel',
  '.composer-context-bar',
  '.message-action-menu',
  '.app-modal',
  '.profile-popover',
  '.person-profile-popover',

  '.message-composer',
  '.room-search',
  '.friend-add-search',

  '.profile-field-group > input',
  '.profile-field-group > textarea',
  '.form-input',
].join(',')

const useLiquidControlReflection = () => {
  useEffect(() => {
    let frameId = null
    let latestEvent = null
    let activeControl = null

    const resetControl = (
      control,
    ) => {
      if (!control) {
        return
      }

      control.style.setProperty(
        '--control-reflect-x',
        '50%',
      )

      control.style.setProperty(
        '--control-reflect-y',
        '-35%',
      )

      control.removeAttribute(
        'data-liquid-hover',
      )
    }

    const paint = () => {
      frameId = null

      const event =
        latestEvent

      if (
        !event ||
        !(event.target instanceof Element)
      ) {
        return
      }

      const control =
        event.target.closest(
          CONTROL_SELECTOR,
        )

      if (!control) {
        if (activeControl) {
          resetControl(
            activeControl,
          )

          activeControl = null
        }

        return
      }

      if (
        activeControl &&
        activeControl !==
          control
      ) {
        resetControl(
          activeControl,
        )
      }

      activeControl =
        control

      const rect =
        control.getBoundingClientRect()

      const x =
        ((event.clientX -
          rect.left) /
          Math.max(
            rect.width,
            1,
          )) *
        100

      const y =
        ((event.clientY -
          rect.top) /
          Math.max(
            rect.height,
            1,
          )) *
        100

      control.style.setProperty(
        '--control-reflect-x',
        `${Math.min(
          100,
          Math.max(
            0,
            x,
          ),
        ).toFixed(2)}%`,
      )

      control.style.setProperty(
        '--control-reflect-y',
        `${Math.min(
          100,
          Math.max(
            0,
            y,
          ),
        ).toFixed(2)}%`,
      )

      control.setAttribute(
        'data-liquid-hover',
        'true',
      )
    }

    const handlePointerMove = (
      event,
    ) => {
      latestEvent = event

      if (!frameId) {
        frameId =
          requestAnimationFrame(
            paint,
          )
      }
    }

    const handlePointerLeave =
      () => {
        if (activeControl) {
          resetControl(
            activeControl,
          )

          activeControl = null
        }
      }

    document.addEventListener(
      'pointermove',
      handlePointerMove,
      {
        passive: true,
      },
    )

    document.documentElement
      .addEventListener(
        'pointerleave',
        handlePointerLeave,
      )

    return () => {
      if (frameId) {
        cancelAnimationFrame(
          frameId,
        )
      }

      resetControl(
        activeControl,
      )

      document.removeEventListener(
        'pointermove',
        handlePointerMove,
      )

      document.documentElement
        .removeEventListener(
          'pointerleave',
          handlePointerLeave,
        )
    }
  }, [])
}

export default useLiquidControlReflection
