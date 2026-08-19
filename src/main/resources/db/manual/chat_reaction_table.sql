CREATE TABLE IF NOT EXISTS chat_message_reactions (
    reaction_id BIGINT NOT NULL AUTO_INCREMENT,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (reaction_id),
    CONSTRAINT uk_chat_reaction_message_user_emoji
        UNIQUE (message_id, user_id, emoji),
    INDEX idx_chat_reaction_message (message_id),
    INDEX idx_chat_reaction_user (user_id),
    CONSTRAINT fk_chat_reaction_message
        FOREIGN KEY (message_id) REFERENCES chat_messages(message_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_chat_reaction_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);
