import {
  useCallback,
  useLayoutEffect,
  useState,
} from 'react'

const clamp = (
  value,
  min,
  max,
) => {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  )
}

const useAnchoredPopover = ({
  open,
  anchorElement,
  floatingRef,
  mode = 'side',
  preferredSide = 'right',
  width = 286,
  estimatedHeight = 250,
  gap = 10,
  viewportGap = 12,
  mobileBreakpoint = 767,
  refreshKey,
}) => {
  const [
    state,
    setState,
  ] = useState({
    style: undefined,
    side: preferredSide,
    mobile: false,
  })

  const updatePosition =
    useCallback(() => {
      if (
        !open ||
        !anchorElement ||
        typeof window ===
          'undefined'
      ) {
        return
      }

      const viewportWidth =
        window.innerWidth

      const viewportHeight =
        window.innerHeight

      if (
        viewportWidth <=
        mobileBreakpoint
      ) {
        setState({
          style: undefined,
          side:
            preferredSide,
          mobile: true,
        })

        return
      }

      const anchorRect =
        anchorElement
          .getBoundingClientRect()

      /*
       * 중요:
       * Popover는 open animation에서 scale transform을 사용한다.
       * getBoundingClientRect()의 width/height는 transform된 크기를
       * 반환하기 때문에 첫 프레임에는 작게 측정되고,
       * animation이 끝난 뒤 실제 크기로 다시 측정되며
       * 카드가 위로 '점프'하는 현상이 생겼다.
       *
       * offsetWidth / offsetHeight는 transform과 무관한
       * layout size를 반환하므로 처음부터 최종 크기로 계산한다.
       */
      const measuredWidth =
        floatingRef.current
          ?.offsetWidth ||
        width

      const measuredHeight =
        floatingRef.current
          ?.offsetHeight ||
        estimatedHeight

      let left = viewportGap
      let top = viewportGap
      let resolvedSide =
        preferredSide

      if (mode === 'above') {
        /*
         * 내 프로필 메뉴:
         * 프로필 버튼 바로 위에 띄우고,
         * 공간이 부족한 경우에만 아래로 전환.
         */
        const preferredTop =
          anchorRect.top -
          measuredHeight -
          gap

        const fallbackTop =
          anchorRect.bottom +
          gap

        top =
          preferredTop >=
          viewportGap
            ? preferredTop
            : fallbackTop

        left = clamp(
          anchorRect.left,
          viewportGap,
          Math.max(
            viewportGap,
            viewportWidth -
              measuredWidth -
              viewportGap,
          ),
        )

        resolvedSide =
          preferredTop >=
          viewportGap
            ? 'above'
            : 'below'
      } else {
        /*
         * 친구 / 참여자:
         * 클릭한 행의 옆에 카드 중앙을 맞춘다.
         */
        const availableRight =
          viewportWidth -
          anchorRect.right

        const availableLeft =
          anchorRect.left

        if (
          resolvedSide ===
            'right' &&
          availableRight <
            measuredWidth +
              gap &&
          availableLeft >
            availableRight
        ) {
          resolvedSide =
            'left'
        }

        if (
          resolvedSide ===
            'left' &&
          availableLeft <
            measuredWidth +
              gap &&
          availableRight >
            availableLeft
        ) {
          resolvedSide =
            'right'
        }

        left =
          resolvedSide ===
          'right'
            ? anchorRect.right +
              gap
            : anchorRect.left -
              measuredWidth -
              gap

        const anchorCenterY =
          anchorRect.top +
          anchorRect.height /
            2

        top =
          anchorCenterY -
          measuredHeight /
            2

        left = clamp(
          left,
          viewportGap,
          Math.max(
            viewportGap,
            viewportWidth -
              measuredWidth -
              viewportGap,
          ),
        )

        top = clamp(
          top,
          viewportGap,
          Math.max(
            viewportGap,
            viewportHeight -
              measuredHeight -
              viewportGap,
          ),
        )
      }

      setState({
        style: {
          left: `${left}px`,
          top: `${top}px`,
        },
        side: resolvedSide,
        mobile: false,
      })
    }, [
      open,
      anchorElement,
      floatingRef,
      mode,
      preferredSide,
      width,
      estimatedHeight,
      gap,
      viewportGap,
      mobileBreakpoint,
    ])

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }

    /*
     * 첫 렌더 후 실제 카드 크기를 다시 측정.
     */
    const frameOne =
      requestAnimationFrame(
        updatePosition,
      )

    const frameTwo =
      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            updatePosition,
          )
        },
      )

    /*
     * Popover open animation / 상태 메뉴 expand가 끝난 뒤에도
     * 실제 높이로 한 번 더 좌표를 맞춘다.
     */
    const settleTimer =
      window.setTimeout(
        updatePosition,
        460,
      )

    const lateSettleTimer =
      window.setTimeout(
        updatePosition,
        760,
      )

    /*
     * capture=true:
     * Sidebar / Member list 내부 스크롤도 감지해서
     * 카드가 클릭한 사용자 위치를 계속 따라간다.
     */
    window.addEventListener(
      'resize',
      updatePosition,
    )

    window.addEventListener(
      'scroll',
      updatePosition,
      true,
    )

    let resizeObserver = null

    if (
      typeof ResizeObserver !==
        'undefined' &&
      anchorElement
    ) {
      resizeObserver =
        new ResizeObserver(
          updatePosition,
        )

      resizeObserver.observe(
        anchorElement,
      )

      if (
        floatingRef.current
      ) {
        resizeObserver.observe(
          floatingRef.current,
        )
      }
    }

    return () => {
      cancelAnimationFrame(
        frameOne,
      )

      cancelAnimationFrame(
        frameTwo,
      )

      window.clearTimeout(
        settleTimer,
      )

      window.clearTimeout(
        lateSettleTimer,
      )

      window.removeEventListener(
        'resize',
        updatePosition,
      )

      window.removeEventListener(
        'scroll',
        updatePosition,
        true,
      )

      resizeObserver?.disconnect()
    }
  }, [
    open,
    anchorElement,
    floatingRef,
    updatePosition,
    refreshKey,
  ])

  return {
    ...state,
    updatePosition,
  }
}

export default useAnchoredPopover
