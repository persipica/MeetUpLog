USE meetuplog;

ALTER TABLE chat_room_members
    ADD COLUMN IF NOT EXISTS notification_muted_until DATETIME NULL
    AFTER notification_setting;
