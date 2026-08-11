export const PRESENCE = {
  ONLINE: {
    key: 'online',
    label: '온라인',
    description: '지금 활동 중',
  },

  AWAY: {
    key: 'away',
    label: '자리비움',
    description: '잠시 자리를 비웠어요',
  },

  OFFLINE: {
    key: 'offline',
    label: '오프라인',
    description: '현재 오프라인',
  },
}

export const getPresence = (presence) => {
  return PRESENCE[presence] ?? PRESENCE.OFFLINE
}
