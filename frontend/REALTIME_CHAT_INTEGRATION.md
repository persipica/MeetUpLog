# 실시간 채팅 프론트엔드 연동

- `src/api/chatApi.js`: 백엔드 DTO를 기존 UI의 room/message/member 구조로 변환합니다.
- `src/realtime/stompClient.js`: 추가 패키지 없이 STOMP 1.2 프레임을 처리합니다.
- `src/hooks/useRealtimeChat.js`: 티켓 발급, 구독, 재연결, 메시지·입력·반응·읽음·사용자 상태·방 관리 이벤트를 관리합니다.
- `ChatMainPage.jsx`: 서버 방 목록/내역/참여자를 불러오고 메시지·수정·삭제·이미지·읽음·방 설정 상태를 서버 방송 결과로 보정합니다.
- `src/api/chatApi.js`: 수정·삭제 REST API와 multipart 이미지 업로드를 담당합니다.
- `src/components/modals/RoomMenuModal.jsx`: 방 정보, 초대 링크, 알림 일시정지, 이름 변경, 삭제/나가기를 같은 글래스 모달 흐름으로 제공합니다.

## 실시간 구독 경로

- `/sub/room/{roomId}`: 메시지
- `/sub/room/{roomId}/typing`: 입력 중
- `/sub/room/{roomId}/reactions`: 메시지 반응
- `/sub/room/{roomId}/read`: 메시지별 안 읽은 참여자 수
- `/sub/room/{roomId}/events`: 방 이름 변경·삭제·참여자 나가기
- `/sub/presence`: 전역 온라인·자리비움·오프라인 상태
- `vite.config.js`: `/api`와 `/ws`를 Spring Boot 8080 포트로 프록시합니다.

백엔드 없이 디자인만 확인하려면 `.env`에서 `VITE_USE_MOCK_CHAT=true`로 설정합니다. 실제 연동은 `false`입니다.
