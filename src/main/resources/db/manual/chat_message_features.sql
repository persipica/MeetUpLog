-- Hibernate ddl-auto=update를 사용하지 않는 환경에서 한 번 실행하세요.
ALTER TABLE chat_messages
    ADD COLUMN image_url VARCHAR(500) NULL,
    ADD COLUMN image_mime_type VARCHAR(100) NULL,
    ADD COLUMN image_size BIGINT NULL;

ALTER TABLE chat_room_members
    ADD COLUMN last_read_message_id BIGINT NULL;

CREATE INDEX idx_chat_room_members_last_read
    ON chat_room_members (room_id, last_read_message_id);
