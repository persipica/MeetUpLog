package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.global.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class KakaoAccountService {

    private final UserRepository userRepository;

    @Transactional
    public User synchronizeKakaoUser(
            String kakaoUserId,
            String email,
            String nickname,
            String profileImageUrl
    ) {
        if (kakaoUserId == null || kakaoUserId.isBlank()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "KAKAO_USER_ID_MISSING",
                    "카카오 사용자 식별자가 없습니다."
            );
        }

        String normalizedEmail = normalizeEmail(email);
        String requestedNickname = normalizeNickname(nickname);

        User existing = userRepository.findByKakaoId(kakaoUserId).orElse(null);

        if (existing == null && normalizedEmail != null) {
            existing = userRepository.findByEmail(normalizedEmail).orElse(null);
            if (existing != null && existing.getAccountType() != AccountType.SOCIAL) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "EMAIL_ALREADY_USED_BY_MEMBER",
                        "같은 이메일로 가입된 자체 회원 계정이 있습니다."
                );
            }
        }

        if (existing != null) {
            String availableNickname = makeAvailableNickname(requestedNickname, existing.getUserId());
            existing.synchronizeKakaoProfile(
                    kakaoUserId,
                    normalizedEmail,
                    availableNickname,
                    profileImageUrl
            );
            return existing;
        }

        String availableNickname = makeAvailableNickname(requestedNickname, null);
        return userRepository.save(User.createSocial(
                kakaoUserId,
                normalizedEmail,
                availableNickname,
                profileImageUrl
        ));
    }

    private String makeAvailableNickname(String nickname, Long currentUserId) {
        String base = nickname == null || nickname.isBlank() ? "카카오 사용자" : nickname;
        String candidate = base;
        int suffix = 2;

        while (currentUserId == null
                ? userRepository.existsByNickname(candidate)
                : userRepository.existsByNicknameAndUserIdNot(candidate, currentUserId)) {
            String suffixText = " " + suffix++;
            int maxBaseLength = Math.max(1, 50 - suffixText.length());
            candidate = base.substring(0, Math.min(base.length(), maxBaseLength)) + suffixText;
        }
        return candidate;
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) {
            return null;
        }
        String trimmed = nickname.trim();
        return trimmed.substring(0, Math.min(trimmed.length(), 50));
    }
}
