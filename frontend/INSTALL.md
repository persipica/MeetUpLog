# MeetupLog Frontend v42 — Spring Boot 회원 인증 연동

기존 순수 CSS 디자인을 Tailwind CSS v4 기반으로 전환한 버전입니다.

## v42 Spring Boot 회원 인증 연동

- Mock 인증 대신 팀원 Spring Boot의 `/api/v1/auth` API를 기본 사용
- 로그인 응답의 `accountToken`, `userId`, `accountType`을 기존 프론트 세션 형식으로 정규화
- 회원가입 요청을 팀원 DTO의 `email`, `password`, `nickname` 계약에 맞춤
- 게스트 계정 생성 요청을 `/api/v1/auth/guest`에 연결
- 네트워크 실패와 JSON·문자열 오류 응답을 로그인 화면에 표시
- 과거 Mock 세션과 실제 인증 세션의 저장소 키를 분리
- 아직 중복 확인 API가 없는 백엔드에서도 회원가입 API의 최종 검증으로 진행 가능

## v41 메시지 모달 및 상단 컨트롤 정렬

- 메시지 수정을 입력창 인라인 상태에서 전용 Liquid Glass 모달로 변경
- 메시지 수정·삭제 모달을 로그아웃·강퇴 모달과 동일한 헤더, 안내 카드, 버튼 규격으로 통일
- 수정 글자 수, 변경 여부, Enter 저장, 빈 메시지 방지 처리 추가
- 삭제 대상 메시지와 삭제 후 표시 방식을 분리해 확인 실수 방지
- 일반 메뉴와 테마 전환 버튼을 40px 크기 및 헤더 중앙선에 맞춰 정렬
- 테마 전환 버튼의 계층을 모달 아래로 조정해 백드롭 블러가 함께 적용되도록 수정
- 모바일 헤더에서도 테마 버튼의 수직 중심을 별도로 보정

## v40 Liquid Slime 탭 전환

- 채팅·친구 선택 배경을 버튼에서 분리된 Liquid Glass 슬라이더로 변경
- 탭 이동 시 좌우로 미끄러지며 늘어났다 복원되는 슬라임형 탄성 애니메이션 적용
- 도착 지점에서 작게 두 번 반동하는 자연스러운 젤 질감 구현
- 라이트·다크 모드별 유리 투명도, 내부 반사광, 프리즘 하단광 조정
- 텍스트와 카운트 배지는 슬라이더 위에 고정해 이동 중에도 가독성 유지
- GPU 합성이 가능한 `transform`만 주 이동축으로 사용해 재배치 비용 최소화
- `prefers-reduced-motion` 환경에서는 전환 애니메이션을 즉시 완료하도록 처리
- 탭 역할과 선택 상태를 스크린 리더가 인식하도록 ARIA 속성 보강

## v39 인증 화면 및 로그아웃 UI 수정

- 라이트 모드에서 Glass 배경에 가려지던 로그인·가입·게스트 입장 버튼 수정
- 주 버튼의 브랜드 보라색 그라데이션과 흰색 텍스트 대비를 명시적으로 고정
- 비활성 상태에서도 버튼 영역과 진행 가능 여부가 식별되도록 대비 보강
- 로그아웃 모달을 인증 화면과 동일한 아이콘·eyebrow·Liquid Glass 구조로 통일
- 로그아웃 영향 안내를 별도 Glass 메시지 영역으로 분리
- 취소·로그아웃 버튼 크기와 배치, 브랜드 색상 위계를 정렬

## v38 인증 및 게스트 기능

- 기존 MeetupLog 골조와 동일한 반응형 Liquid Glass 로그인 화면 추가
- 이메일·비밀번호 로그인, 로그인 상태 유지, 비밀번호 표시 전환 구현
- 이메일·닉네임 중복 확인과 비밀번호 규칙·재확인을 포함한 회원가입 구현
- 카카오 OAuth 시작 경로와 로컬 데모 카카오 로그인 제공
- 초대 토큰과 닉네임으로 입장하는 게스트 흐름 구현
- 게스트는 초대받은 채팅방 한 개만 볼 수 있도록 데이터 범위 제한
- 게스트 화면에서 친구, 알림, 새 채팅방, 프로필 편집, 초대·방 관리 메뉴 차단
- 회원 세션은 로그인 상태 유지 여부에 따라 local/session storage에 저장
- 게스트 세션은 브라우저 탭을 닫으면 종료되도록 session storage만 사용

### 로컬 데모 계정

개발 모드에서는 로그인 화면의 `데모 계정 자동 입력` 버튼을 사용할 수 있습니다.

```text
이메일: heesu@example.com
비밀번호: Meetup123!
```

회원가입한 데모 계정은 비밀번호 원문을 저장하지 않고 Web Crypto API의
SHA-256 해시만 브라우저에 저장합니다. 이는 UI 시연용이며 실제 서비스에서는
반드시 서버에서 BCrypt/Argon2 등의 비밀번호 해시를 사용해야 합니다.

### 초대 링크 및 게스트 입장

아래 형식을 모두 지원합니다.

```text
/invite/{inviteToken}
/?invite={inviteToken}&roomId=1&roomName=주말%20영화방
```

`VITE_USE_MOCK_AUTH=false`인 실서비스 모드에서는 초대 토큰이 없으면 게스트
입장이 비활성화됩니다. 서버는 토큰의 유효기간·채팅방·최대 인원을 검증한 뒤
해당 채팅방 범위의 게스트 토큰을 발급해야 합니다.

### 인증 API 계약

```http
POST /api/auth/login
POST /api/auth/signup
GET  /api/auth/check-email?email={email}
GET  /api/auth/check-nickname?nickname={nickname}
POST /api/invites/{inviteToken}/guest
```

로그인·게스트 응답은 아래처럼 사용자와 토큰, 세션 유형을 반환합니다.

```json
{
  "type": "member",
  "accessToken": "...",
  "user": {
    "id": 1,
    "accountId": "user-heesu",
    "email": "heesu@example.com",
    "nickname": "희수",
    "role": "OWNER"
  }
}
```

게스트 응답은 `type: "guest"`, `inviteRoomId`, `inviteRoomName`을 함께
반환해야 합니다. 실제 접근 제어는 프론트 화면 숨김뿐 아니라 백엔드가 토큰의
채팅방 범위를 검사하여 강제해야 합니다.

## v37 초대 화면 및 최적화

- 참여자 초대 후보의 아바타 열을 실제 48px 크기에 맞추고 텍스트와 16px 간격 확보
- 메시지 입력 상태 갱신을 빈 값/입력 중 전환 시에만 실행해 타이핑 중 재렌더링 감소
- 반복되는 채팅 말풍선은 글래스 표면을 유지하되 고비용 실시간 배경 블러는 제거
- 전체 화면 앰비언트 배경은 정적인 다중 그라데이션으로 바꿔 상시 합성 비용 절감
- 타이핑 사용자와 초대 대기 사용자 검색을 반복 순회 대신 `Set` 조회로 변경
- 마우스 이동 때 전체 화면을 다시 그리던 루트 반사광 갱신 제거
- 반사광 계산을 현재 가리키는 유리 요소 한 개로 제한하고 좌표 갱신 임계값 적용
- 요소 위치 측정을 포인터 프레임마다 수행하지 않고 진입 시 한 번만 캐시
- 대형 패널의 무한 그림자 호흡 및 진입 `filter: blur()` 애니메이션 제거
- 전역·모달·서랍 블러 반경을 낮추고 소형 상태 아이콘의 무한 회전·점멸 중지
- Liquid Glass 굴절광, 테두리, 색상과 상태 전환 애니메이션은 유지

## v36 전체 UI 보강

- 5~15px로 흩어져 있던 작은 텍스트를 전체적으로 약 2px씩 확대
- 사이드바, 헤더, 프로필·참여자 아바타와 채팅 입력 컨트롤 크기 보강
- 공통 Glass 패널과 컨트롤에 굴절광, 프리즘 색상, 다중 내부 하이라이트 적용
- 커서 위치에 반응하는 반사광과 배경 Liquid Ambient 애니메이션 추가
- 홈, 알림, 친구, 프로필, AI 추천 카드에 유리 표면 진입·호흡·호버 효과 적용
- 라이트·다크 모드에 각각 맞는 유리 테두리와 깊이 그림자 조정

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

## Spring Boot 인증 API 연동

v42부터 Mock 인증은 기본값이 아니며 아래 Spring Boot API를 호출합니다.

```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/guest
GET  /api/v1/auth/check-email?email={email}
GET  /api/v1/auth/check-nickname?nickname={nickname}
```

백엔드는 `http://localhost:8080`, 프론트엔드는 `http://localhost:5173`에서
실행합니다. Vite가 `/api` 요청을 백엔드로 프록시하므로 별도 CORS 설정 없이
로컬 연동할 수 있습니다.

팀원 백엔드의 `accountToken`, `userId`, `accountType` 응답은 프론트에서
각각 `accessToken`, `user.id`, `user.accountType`으로 변환해 기존 채팅 화면의
세션 구조를 유지합니다.

화면만 확인할 때는 프로젝트 루트에 `.env.local`을 만들고 다음 값을 지정합니다.

```text
VITE_USE_MOCK_AUTH=true
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
