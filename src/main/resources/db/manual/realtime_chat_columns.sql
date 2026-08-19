-- Hibernate ddl-auto=update를 사용하지 않는 환경에서 한 번 실행하세요.

-- 팀원 엔티티의 created_by와 기존 설계의 owner_id가 동시에 생긴 DB를 정리합니다.
-- safe update 모드에서도 실행되도록 PK 조건을 포함했습니다.
UPDATE chat_rooms
SET owner_id = created_by
WHERE room_id > 0
  AND owner_id IS NULL
  AND created_by IS NOT NULL;

-- 과거 Hibernate가 만든 created_by가 NOT NULL이면 새 INSERT가 다시 실패하므로
-- 당장은 nullable로 완화합니다. 데이터 확인 후 FK와 컬럼 자체를 삭제해도 됩니다.
ALTER TABLE chat_rooms
    MODIFY COLUMN created_by BIGINT NULL;

ALTER TABLE chat_rooms
    ADD COLUMN topic_type VARCHAR(30) NOT NULL DEFAULT 'ETC';

CREATE INDEX idx_chat_messages_room_sent
    ON chat_messages (room_id, sent_at);

CREATE INDEX idx_chat_room_members_user_status
    ON chat_room_members (user_id, member_status);

CREATE INDEX idx_chat_room_members_room_status
    ON chat_room_members (room_id, member_status);
