package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OAuthLoginCodeService {

    private static final Duration CODE_TTL = Duration.ofMinutes(2);
    private static final int CODE_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, PendingLogin> pendingLogins = new ConcurrentHashMap<>();

    public String issue(AuthResponse response) {
        removeExpiredCodes();

        byte[] randomBytes = new byte[CODE_BYTES];
        secureRandom.nextBytes(randomBytes);

        String code = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        pendingLogins.put(
                code,
                new PendingLogin(response, Instant.now().plus(CODE_TTL))
        );

        return code;
    }

    public AuthResponse consume(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("카카오 로그인 교환 코드가 없습니다.");
        }

        PendingLogin pendingLogin = pendingLogins.remove(code);

        if (pendingLogin == null || pendingLogin.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException(
                    "카카오 로그인 정보가 만료되었거나 이미 사용되었습니다. 다시 로그인해주세요."
            );
        }

        return pendingLogin.response();
    }

    private void removeExpiredCodes() {
        Instant now = Instant.now();
        pendingLogins.entrySet().removeIf(
                entry -> entry.getValue().expiresAt().isBefore(now)
        );
    }

    private record PendingLogin(
            AuthResponse response,
            Instant expiresAt
    ) {
    }
}
