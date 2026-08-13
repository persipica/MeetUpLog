# MeetupLog Frontend v35 — AI 와이어프레임 및 단독 이모티콘 복원

기존 순수 CSS 디자인을 Tailwind CSS v4 기반으로 전환한 버전입니다.

## v35 AI 추천 및 이모티콘 수정

- AI 결과를 와이어프레임 기준의 `추천 카드 / 의견 수집 상태 / 대화 요약`
  구조로 복원
- 영화 TOP 3를 포스터 영역이 포함된 가로 3열 후보 카드로 표시
- 각 후보에 상세 정보와 확정 버튼을 제공하고 확정 상태를 즉시 반영
- 단독 이모티콘 메시지의 배경, 테두리, 그림자, 블러를 완전히 제거
- 본인 메시지의 보라색 말풍선이 단독 이모티콘 스타일을 덮던 CSS 우선순위 수정

## v34 채팅 도구 수정

- 투명 닫기 레이어가 `+` 메뉴와 이모티콘 패널의 클릭을 가로채던
  스태킹 순서 수정
- `+` 메뉴의 AI 추천 실행을 기존 비동기 분석 결과 카드와 다시 연결
- JPG, PNG, GIF, WEBP 이미지 선택 및 채팅 미리보기 전송 구현
- 이미지 형식과 10MB 용량 검증, 오류 안내 추가
- 이모티콘 검색·입력·단독 전송 및 큰 이모티콘 표시 흐름 복구
- 이미지 메시지 답장, 삭제, 읽지 않은 인원 수 표시 지원

## v33 프로필 편집 수정

- 프로필 편집 미리보기 카드에 독립 스태킹 컨텍스트 적용
- 상태 배너는 후면, 프로필 아바타와 정보 영역은 전면으로 순서 고정
- 음수 여백으로 배너 위에 겹치는 아바타의 상단 잘림 현상 수정

## v32 상태 선택 메뉴 수정

- 본인 상태 선택 아이콘을 32px 고대비 타일로 통일
- 온라인은 밝은 노랑, 자리비움은 진한 남색, 오프라인은 밤색 배경 적용
- 자리비움 선택 아이콘의 초승달 밝은 면적 확대
- 오프라인 별 크기와 발광 효과 강화
- 선택지 아이콘은 전환 지연 없이 즉시 표시하도록 정적 렌더링

## v31 소형 아이콘 및 프로필 카드 수정

- 소형 상태 아이콘에 정사각형 최소 크기와 `aspect-ratio` 고정
- 소형 온라인 해의 햇살과 원형이 flex 환경에서 눌리지 않도록 보정
- 소형 자리비움 초승달의 밝은 면적을 넓히고 회전량 완화
- 배너에만 `zzz`를 표시해 작은 배지의 문자 겹침 제거
- 친구·채팅 참여자 프로필의 상태 메시지를 내부 중첩 카드에서
  전체 폭 하단 정보 밴드로 변경

## v30 가시성 수정

- 프로필 배너의 자리비움 `zzz`를 10~12px로 확대
- `zzz`에 흰색 고대비 색상과 어두운 그림자 적용
- 프로필 사진 우측 하단 상태 표시를 32px 독립 배지로 확대
- 배지 상태별 배경, 흰색 테두리와 외곽 그림자 적용
- 본인 프로필과 친구·참여자 프로필 배지 크기 통일
- 사이드바 친구·참여자 목록의 작은 천체 배지도 20px로 확대

## v29 상태 UI 수정

- 온라인: 화창한 배너와 떠 있는 해·회전하는 햇살
- 자리비움: 해가 초승달로 이어지고 `zzz`가 위로 떠오르는 전환
- 오프라인: 달이 일식처럼 가려진 뒤 사라지고 별이 반짝이는 전환
- 본인 프로필, 친구 프로필, 편집 미리보기에 동일한 상태 배너 적용
- 아바타 우측 하단과 친구·참여자 목록에도 동일한 천체 아이콘 적용
- `accountId` 기반 `meetuplog:presence-change` 이벤트와
  `meetuplog-presence` BroadcastChannel 실시간 동기화
- 프로필 아바타의 한글 이니셜 수직·수평 중앙 정렬 보정

실서비스의 WebSocket 또는 SSE 수신부는 서버 이벤트를 아래 공통 이벤트로
전달하면 열려 있는 모든 목록과 프로필 카드가 동시에 갱신됩니다.

```js
window.dispatchEvent(
  new CustomEvent('meetuplog:presence-change', {
    detail: {
      accountId: 'user-minsu',
      presence: 'AWAY', // ONLINE | AWAY | OFFLINE
    },
  }),
)
```

친구와 채팅 참여자는 서로 다른 목록 ID가 아니라 동일한 `accountId`를
사용해야 같은 사용자의 상태로 동기화됩니다.

## 실행

```powershell
npm ci
npm run dev
```

`@tailwindcss/vite` 모듈 오류가 보이면 기존 `node_modules`가 이전 버전인 경우이므로,
프로젝트 루트에서 `npm ci`를 먼저 실행하면 됩니다.

프로덕션 빌드는 다음 명령으로 확인할 수 있습니다.

```powershell
npm run build
```

## Tailwind 구성

- `tailwindcss` v4
- `@tailwindcss/vite`
- CSS-first `@theme` 디자인 토큰
- `data-color-mode="dark"` 기반 `dark:` 사용자 정의 variant
- Vite 전용 Tailwind 플러그인

핵심 파일:

```text
vite.config.js
src/styles/tailwind.css
```

기존 `src/styles/chat.css`, `src/styles/liquid.css`는 제거했습니다.

## 디자인 시스템

Tailwind 테마에 다음 요소를 공통 토큰으로 구성했습니다.

- Brand color scale
- Glass panel/control material
- Light/Dark semantic color variables
- iOS 계열 rounded radius
- Liquid Glass shadow
- Spring motion easing
- Desktop/Tablet/Mobile breakpoints
- Reduced motion 대응

## 유지된 기능

- Light / Dark Mode
- Liquid Glass와 커서 반사
- 홈 / 친구 / 친구 추가 / 알림 / 프로필 편집
- 채팅방 / 참여자 목록 / 프로필 Popover
- 메시지 답장 / 수정 / 삭제 / 원문 이동
- 읽지 않은 인원 수 / Reaction / Emoji 검색
- Emoji-only 큰 메시지
- 간결한 AI TOP 3 분석 카드
- 친구 초대 대기 / 초대 링크
- 선택적 강퇴 사유와 수신자 안내
- 입장 / 퇴장 / 강퇴 중앙 시스템 알림
- 반응형 UI와 `prefers-reduced-motion`

## v27 UI 수정

- 데스크톱 App Grid의 빈 열 제거 및 전체 너비 복구
- 참여자 패널을 채팅 본문 내부 고정 너비 패널로 정렬
- 채팅 도구/이모티콘 오버레이의 전체 화면 blur 제거
- 이모티콘 패널을 우측 버튼 위로 정렬
- AI/이미지 도구 메뉴를 아이콘과 이름만 보이는 간결한 메뉴로 변경
- 상태 표시 아이콘의 중첩 장식과 `zzz` 노출 제거
- 검색, 추가, 더보기, 닫기, 프로필 등 공통 SVG 아이콘 적용

## v28 UI 및 계정 기능

- 메인 화면을 하나의 웰컴 카드와 최근 대화 영역으로 재구성
- 상단/본문에 중복되던 새 채팅방 버튼 정리
- 본인 프로필 Popover의 중첩 카드 제거 및 단일 메뉴 구조 적용
- 상태 애니메이션 복구
  - 온라인: 회전하는 햇살과 해
  - 자리비움: 달과 위로 떠오르는 `zzz`
  - 오프라인: 일식과 반짝이는 별
- 프로필 편집 화면 Grid 깨짐 수정 및 공개 프로필/계정 보안 섹션 분리
- 로그인 이메일 읽기 전용 표시
- 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인 입력 및 검증
- 영문·숫자·특수문자 포함 8자 이상 비밀번호 규칙 표시

## 비밀번호 변경 API 계약

프론트엔드는 현재 비밀번호를 자체 비교하거나 저장하지 않습니다. 아래 API에서
서버가 로그인 사용자와 현재 비밀번호를 검증해야 합니다.

```http
PATCH /api/members/me/password
Content-Type: application/json

{
  "currentPassword": "현재 비밀번호",
  "newPassword": "새 비밀번호"
}
```

- 성공: `200 OK` 또는 `204 No Content`
- 현재 비밀번호 불일치: `400 Bad Request`
- 로그인 만료: `401 Unauthorized`
- 권장 오류 코드: `INVALID_CURRENT_PASSWORD`

개발 서버에서는 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.
배포 환경에서는 `VITE_API_BASE_URL`로 API 기본 주소를 지정할 수 있습니다.
