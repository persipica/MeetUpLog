export const ROOM_THEMES = {
  MOVIE: { key: 'movie', label: '영화', icon: '🎬', subtitle: 'Movie Night', accent: '#7467e8', accentRgb: '116, 103, 232', accentSoft: '#f0edff', background: '#fbfaff', aiSupported: true },
  GAME: { key: 'game', label: '게임', icon: '🎮', subtitle: 'Game Session', accent: '#3988d4', accentRgb: '57, 136, 212', accentSoft: '#eaf5ff', background: '#f8fbff', aiSupported: false },
  FOOD: { key: 'food', label: '음식', icon: '🍽️', subtitle: 'Food Meetup', accent: '#db775e', accentRgb: '219, 119, 94', accentSoft: '#fff0ea', background: '#fffaf7', aiSupported: false },
  TRAVEL: { key: 'travel', label: '여행', icon: '✈️', subtitle: 'Trip Together', accent: '#39a489', accentRgb: '57, 164, 137', accentSoft: '#e9f8f4', background: '#f7fcfa', aiSupported: false },
  ETC: { key: 'default', label: '기타', icon: '💬', subtitle: 'Meetup Room', accent: '#667085', accentRgb: '102, 112, 133', accentSoft: '#f1f3f5', background: '#fafafa', aiSupported: false },
}

export const getRoomTheme = (topicType) => ROOM_THEMES[topicType] ?? ROOM_THEMES.ETC
