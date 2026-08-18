package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.UpdateProfileRequest;
import com.log.MeetupLog.domain.user.dto.UserProfileResponse;
import com.log.MeetupLog.domain.user.entity.AccountStatus;
import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProfileService {

    private final UserRepository userRepository;
    private final KakaoUnlinkClient kakaoUnlinkClient;

    public UserProfileResponse getMyProfile(Long userId) {
        return UserProfileResponse.from(
                getActiveUser(userId)
        );
    }

    @Transactional
    public UserProfileResponse updateMyProfile(
            Long userId,
            UpdateProfileRequest request
    ) {
        User user = getActiveUser(userId);

        if (user.getAccountType() == AccountType.SOCIAL) {
            boolean nicknameChanged =
                    request.nickname() != null
                            && !Objects.equals(
                            user.getNickname(),
                            request.nickname().trim()
                    );

            boolean imageChanged =
                    request.profileImageUrl() != null
                            && !Objects.equals(
                            user.getProfileImageUrl(),
                            normalizeNullable(
                                    request.profileImageUrl()
                            )
                    );

            if (nicknameChanged || imageChanged) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "카카오 계정은 상태 메시지만 변경할 수 있습니다."
                );
            }
        } else {
            updateMemberProfile(user, request);
        }

        if (request.statusMessage() != null) {
            String statusMessage =
                    normalizeNullable(request.statusMessage());

            if (statusMessage != null
                    && statusMessage.length() > 120) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "상태 메시지는 120자 이하로 입력해주세요."
                );
            }

            user.changeStatusMessage(statusMessage);
        }

        return UserProfileResponse.from(user);
    }

    @Transactional
    public void unlinkKakao(Long userId) {
        User user = getActiveUser(userId);

        if (user.getAccountType() != AccountType.SOCIAL
                || user.getKakaoId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "카카오 연동 계정이 아닙니다."
            );
        }

        kakaoUnlinkClient.unlink(user.getKakaoId());
        user.unlinkKakao();
    }

    private void updateMemberProfile(
            User user,
            UpdateProfileRequest request
    ) {
        if (request.nickname() != null) {
            String nickname = request.nickname().trim();

            if (nickname.length() < 2
                    || nickname.length() > 50) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "닉네임은 2~50자로 입력해주세요."
                );
            }

            if (!nickname.equals(user.getNickname())
                    && userRepository
                    .existsByNicknameAndUserIdNot(
                            nickname,
                            user.getUserId()
                    )) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "이미 사용 중인 닉네임입니다."
                );
            }

            user.changeNickname(nickname);
        }

        if (request.profileImageUrl() != null) {
            user.changeProfileImage(
                    normalizeNullable(
                            request.profileImageUrl()
                    )
            );
        }
    }

    private User getActiveUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "사용자를 찾을 수 없습니다."
                        )
                );

        if (user.getAccountStatus()
                != AccountStatus.ACTIVE) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "비활성화된 계정입니다."
            );
        }

        return user;
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty()
                ? null
                : normalized;
    }
}