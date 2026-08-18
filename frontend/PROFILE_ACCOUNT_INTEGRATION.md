# MeetupLog 프로필·계정 연동 안내

## 계정 유형별 화면 동작

- `MEMBER`: 프로필 사진, 닉네임, 상태 메시지, 비밀번호 변경, 회원 탈퇴를 모두 사용할 수 있습니다.
- `SOCIAL`: 카카오 프로필 사진·닉네임·이메일은 읽기 전용이며 상태 메시지만 수정할 수 있습니다. 비밀번호 변경과 회원 탈퇴 대신 카카오 연동 해제를 제공합니다.
- `GUEST`: 프로필·계정 설정 대신 일반 회원 전환 폼을 표시합니다.

## 프런트엔드가 호출하는 API

| Method | Endpoint | 용도 |
| --- | --- | --- |
| `GET` | `/api/v1/users/me` | 로그인 사용자 프로필 조회 |
| `PATCH` | `/api/v1/users/me` | 닉네임·상태 메시지 수정 |
| `POST` | `/api/v1/users/me/profile-image` | 일반 회원 프로필 이미지 업로드 |
| `DELETE` | `/api/v1/users/me/profile-image` | 일반 회원 프로필 이미지 제거 |
| `PATCH` | `/api/members/me/password` | 일반 회원 비밀번호 변경 |
| `DELETE` | `/api/v1/users/me` | 일반 회원 탈퇴 |
| `DELETE` | `/api/v1/users/me/kakao-link` | 카카오 계정 연동 해제 |
| `POST` | `/api/v1/users/me/convert` | 게스트를 일반 회원으로 전환 |

인증이 필요한 요청에는 저장된 JWT가 `Authorization: Bearer <token>` 형식으로 자동 포함됩니다.

## 카카오 사용자 정보 저장 조건

카카오 로그인 성공 시 백엔드에서 카카오 사용자 정보의 `email`, `nickname`, `profile_image_url`을 사용자 엔티티에 저장해야 합니다. 카카오 개발자 콘솔에서 `account_email`과 프로필 관련 동의 항목을 활성화하고, 사용자가 동의하지 않은 값은 `null`일 수 있도록 처리합니다.

카카오 연동 해제 API는 카카오 Admin Key 또는 사용자 액세스 토큰을 사용해 카카오 `/v1/user/unlink`를 호출한 뒤, 서비스의 로그인 세션·JWT 및 연동 정보를 함께 정리해야 합니다.

## 실행 및 검증

```bash
npm install
npm run dev
```

프로덕션 빌드 확인:

```bash
npm run build
```

`node_modules`와 `dist`는 ZIP에서 제외되어 있으므로 압축 해제 후 `npm install`을 먼저 실행하세요.
