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
  '.main-home-hero',
  '.friend-card',
  '.workspace-notification-item',
  '.friend-add-panel',
  '.member-invite-result',
  '.member-invite-search',
  '.member-invite-tabs',
  '.ai-result-card',
  '.ai-candidate-card',
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

  '.auth-card',
  '.auth-input-shell',
  '.auth-primary-button',
  '.auth-kakao-button',
  '.auth-guest-button',
  '.auth-invite-room',
  '.auth-guest-permissions',
].join(',')

const useLiquidControlReflection = () => {
  useEffect(() => {
    const finePointer =
      window.matchMedia?.(
        '(hover: hover) and (pointer: fine)',
      ).matches ?? true

    const reducedMotion =
      window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches ?? false

    if (
      !finePointer ||
      reducedMotion
    ) {
      return undefined
    }

    let frameId = null
    let latestEvent = null
    let latestControl = null
    let activeControl = null
    let activeRect = null
    let previousX = null
    let previousY = null

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

      activeRect = null
      previousX = null
      previousY = null
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
        latestControl

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

      if (!activeRect) {
        activeRect =
          control.getBoundingClientRect()
      }

      const rect =
        activeRect

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

      const clampedX =
        Math.min(
          100,
          Math.max(0, x),
        )

      const clampedY =
        Math.min(
          100,
          Math.max(0, y),
        )

      if (
        previousX !== null &&
        previousY !== null &&
        Math.abs(
          clampedX -
            previousX,
        ) < 1.5 &&
        Math.abs(
          clampedY -
            previousY,
        ) < 1.5
      ) {
        return
      }

      previousX =
        clampedX
      previousY =
        clampedY

      control.style.setProperty(
        '--control-reflect-x',
        `${clampedX.toFixed(
          1,
        )}%`,
      )

      control.style.setProperty(
        '--control-reflect-y',
        `${clampedY.toFixed(
          1,
        )}%`,
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

      if (
        activeControl?.contains(
          event.target,
        )
      ) {
        latestControl =
          activeControl
      } else {
        latestControl =
          event.target instanceof
          Element
            ? event.target.closest(
                CONTROL_SELECTOR,
              )
            : null
      }

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
          latestControl = null
        }
      }

    const invalidateActiveRect =
      () => {
        activeRect = null
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

    window.addEventListener(
      'resize',
      invalidateActiveRect,
      {
        passive: true,
      },
    )

    document.addEventListener(
      'scroll',
      invalidateActiveRect,
      {
        passive: true,
        capture: true,
      },
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

      window.removeEventListener(
        'resize',
        invalidateActiveRect,
      )

      document.removeEventListener(
        'scroll',
        invalidateActiveRect,
        true,
      )
    }
  }, [])
}

export default useLiquidControlReflection
