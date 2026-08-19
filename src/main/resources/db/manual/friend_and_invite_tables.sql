-- MeetupLog 친구/채팅방 초대 기능 수동 마이그레이션 (MySQL 8)
-- spring.jpa.hibernate.ddl-auto=update 환경에서는 Hibernate가 생성할 수 있지만,
-- 팀 공용 DB에는 아래 스크립트를 명시적으로 적용하는 것을 권장합니다.

CREATE TABLE IF NOT EXISTS friend_requests (
    friend_request_id BIGINT NOT NULL AUTO_INCREMENT,
    requester_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    request_status VARCHAR(20) NOT NULL,
    request_message VARCHAR(200) NULL,
    created_at DATETIME(6) NOT NULL,
    responded_at DATETIME(6) NULL,
    PRIMARY KEY (friend_request_id),
    INDEX idx_friend_request_receiver_status (receiver_id, request_status),
    INDEX idx_friend_request_requester_status (requester_id, request_status),
    CONSTRAINT fk_friend_request_requester FOREIGN KEY (requester_id) REFERENCES users(user_id),
    CONSTRAINT fk_friend_request_receiver FOREIGN KEY (receiver_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
    friendship_id BIGINT NOT NULL AUTO_INCREMENT,
    user_low_id BIGINT NOT NULL,
    user_high_id BIGINT NOT NULL,
    friendship_status VARCHAR(20) NOT NULL,
    blocked_by BIGINT NULL,
    block_reason VARCHAR(200) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (friendship_id),
    CONSTRAINT uk_friendship_pair UNIQUE (user_low_id, user_high_id),
    CONSTRAINT fk_friendship_low FOREIGN KEY (user_low_id) REFERENCES users(user_id),
    CONSTRAINT fk_friendship_high FOREIGN KEY (user_high_id) REFERENCES users(user_id),
    CONSTRAINT fk_friendship_blocked_by FOREIGN KEY (blocked_by) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS room_member_invites (
    room_member_invite_id BIGINT NOT NULL AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    inviter_id BIGINT NOT NULL,
    invitee_id BIGINT NOT NULL,
    invite_status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    responded_at DATETIME(6) NULL,
    PRIMARY KEY (room_member_invite_id),
    INDEX idx_room_member_invitee_status (invitee_id, invite_status),
    INDEX idx_room_member_room_status (room_id, invite_status),
    CONSTRAINT fk_room_member_invite_room FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id),
    CONSTRAINT fk_room_member_invite_inviter FOREIGN KEY (inviter_id) REFERENCES users(user_id),
    CONSTRAINT fk_room_member_invite_invitee FOREIGN KEY (invitee_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS room_invites (
    invite_id BIGINT NOT NULL AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    max_uses INT NOT NULL DEFAULT 50,
    used_count INT NOT NULL DEFAULT 0,
    invite_status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (invite_id),
    CONSTRAINT uk_room_invite_token_hash UNIQUE (token_hash),
    INDEX idx_room_invite_room_status (room_id, invite_status),
    CONSTRAINT fk_room_invite_room FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id),
    CONSTRAINT fk_room_invite_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- 기존 room_invites 테이블이 요구사항 정의서의 최소 컬럼만 가진 경우 아래를 한 번만 실행하세요.
-- ALTER TABLE room_invites ADD COLUMN max_uses INT NOT NULL DEFAULT 50;
-- ALTER TABLE room_invites ADD COLUMN used_count INT NOT NULL DEFAULT 0;
-- ALTER TABLE room_invites ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
