-- Hibernate ddl-auto=update를 사용하면 자동 생성됩니다.
-- ddl-auto가 validate/none인 환경에서만 아래 스크립트를 한 번 실행하세요.

SET @status_message_sql = IF(
    EXISTS(
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'status_message'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN status_message VARCHAR(120) NULL AFTER profile_image_url'
);
PREPARE status_message_statement FROM @status_message_sql;
EXECUTE status_message_statement;
DEALLOCATE PREPARE status_message_statement;

SET @kakao_id_sql = IF(
    EXISTS(
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'kakao_id'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN kakao_id VARCHAR(100) NULL AFTER status_message'
);
PREPARE kakao_id_statement FROM @kakao_id_sql;
EXECUTE kakao_id_statement;
DEALLOCATE PREPARE kakao_id_statement;

SET @copy_legacy_kakao_id_sql = IF(
    EXISTS(
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'kakao_user_id'
    ),
    'UPDATE users SET kakao_id = COALESCE(kakao_id, kakao_user_id) WHERE user_id > 0',
    'SELECT 1'
);
PREPARE copy_legacy_kakao_id_statement FROM @copy_legacy_kakao_id_sql;
EXECUTE copy_legacy_kakao_id_statement;
DEALLOCATE PREPARE copy_legacy_kakao_id_statement;

SET @kakao_index_sql = IF(
    EXISTS(
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'uk_users_kakao_id'
    ),
    'SELECT 1',
    'CREATE UNIQUE INDEX uk_users_kakao_id ON users (kakao_id)'
);
PREPARE kakao_index_statement FROM @kakao_index_sql;
EXECUTE kakao_index_statement;
DEALLOCATE PREPARE kakao_index_statement;
