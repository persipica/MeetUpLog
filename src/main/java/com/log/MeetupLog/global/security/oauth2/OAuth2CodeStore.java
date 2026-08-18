package com.log.MeetupLog.global.security.oauth2;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OAuth2CodeStore {

    private static final Duration CODE_VALIDITY =
            Duration.ofSeconds(60);

    private final SecureRandom secureRandom =
            new SecureRandom();

    private final Map<String, CodeEntry> codeStore =
            new ConcurrentHashMap<>();

    public String issue(AuthResponse authResponse) {
        removeExpiredCodes();

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String code = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        codeStore.put(
                code,
                new CodeEntry(
                        authResponse,
                        Instant.now().plus(CODE_VALIDITY)
                )
        );

        return code;
    }

    public AuthResponse consume(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException(
                    "OAuth 인증 코드가 없습니다."
            );
        }

        CodeEntry entry = codeStore.remove(code);

        if (entry == null) {
            throw new IllegalArgumentException(
                    "유효하지 않거나 이미 사용된 OAuth 인증 코드입니다."
            );
        }

        if (entry.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException(
                    "OAuth 인증 코드가 만료되었습니다."
            );
        }

        return entry.authResponse();
    }

    private void removeExpiredCodes() {
        Instant now = Instant.now();

        codeStore.entrySet().removeIf(
                entry -> entry.getValue()
                        .expiresAt()
                        .isBefore(now)
        );
    }

    private record CodeEntry(
            AuthResponse authResponse,
            Instant expiresAt
    ) {
    }
}