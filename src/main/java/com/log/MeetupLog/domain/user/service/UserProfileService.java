package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.profile.ChangePasswordRequest;
import com.log.MeetupLog.domain.user.dto.profile.ConvertGuestRequest;
import com.log.MeetupLog.domain.user.dto.profile.GuestConversionResponse;
import com.log.MeetupLog.domain.user.dto.profile.UpdateMyProfileRequest;
import com.log.MeetupLog.domain.user.dto.profile.UserProfileResponse;
import com.log.MeetupLog.domain.user.entity.AccountStatus;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.global.error.ApiException;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserProfileService {

    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,72}$"
    );

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final ProfileImageStorageService profileImageStorageService;
    private final KakaoUnlinkClient kakaoUnlinkClient;

    public UserProfileResponse getMyProfile(Long userId) {
        return UserProfileResponse.from(getActiveUser(userId));
    }

    @Transactional
    public UserProfileResponse updateMyProfile(Long userId, UpdateMyProfileRequest request) {
        User user = getActiveUser(userId);

        if (user.isGuestAccount()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "GUEST_PROFILE_UPDATE_FORBIDDEN",
                    "게스트 계정은 일반 회원 전환 후 프로필을 변경할 수 있습니다."
            );
        }

        if (user.isKakaoAccount()) {
            if (request.nickname() != null || request.profileImageUrl() != null) {
                throw new ApiException(
                        HttpStatus.FORBIDDEN,
                        "KAKAO_PROFILE_READ_ONLY",
                        "카카오 계정은 상태 메시지만 변경할 수 있습니다."
                );
            }

            if (request.statusMessage() != null) {
                user.changeStatusMessage(normalizeStatusMessage(request.statusMessage()));
            }
            return UserProfileResponse.from(user);
        }

        if (request.nickname() != null) {
            String nickname = request.nickname().trim();
            if (nickname.length() < 2) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_NICKNAME",
                        "닉네임은 2자 이상이어야 합니다.",
                        "nickname"
                );
            }
            if (userRepository.existsByNicknameAndUserIdNot(nickname, userId)) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "DUPLICATE_NICKNAME",
                        "이미 사용 중인 닉네임입니다.",
                        "nickname"
                );
            }
            user.changeNickname(nickname);
        }

        if (request.statusMessage() != null) {
            user.changeStatusMessage(normalizeStatusMessage(request.statusMessage()));
        }

        // profileImageUrl은 클라이언트가 임의로 바꿀 수 없으며 업로드 API에서만 갱신합니다.
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse uploadProfileImage(Long userId, MultipartFile file) {
        User user = requireMember(getActiveUser(userId));
        String previousUrl = user.getProfileImageUrl();
        String storedUrl = profileImageStorageService.store(file);

        user.changeProfileImage(storedUrl);
        profileImageStorageService.deleteByPublicUrl(previousUrl);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse removeProfileImage(Long userId) {
        User user = requireMember(getActiveUser(userId));
        String previousUrl = user.getProfileImageUrl();

        user.changeProfileImage(null);
        profileImageStorageService.deleteByPublicUrl(previousUrl);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public Map<String, String> changePassword(Long userId, ChangePasswordRequest request) {
        User user = requireMember(getActiveUser(userId));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_CURRENT_PASSWORD",
                    "현재 비밀번호가 올바르지 않습니다.",
                    "currentPassword"
            );
        }

        validatePassword(request.newPassword());

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "SAME_PASSWORD",
                    "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
                    "newPassword"
            );
        }

        user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
        return Map.of("message", "비밀번호가 변경되었습니다.");
    }

    @Transactional
    public GuestConversionResponse convertGuest(Long userId, ConvertGuestRequest request) {
        User user = getActiveUser(userId);

        if (!user.isGuestAccount()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "NOT_GUEST_ACCOUNT",
                    "게스트 계정만 일반 회원으로 전환할 수 있습니다."
            );
        }

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String nickname = request.nickname().trim();

        if (userRepository.existsByEmailAndUserIdNot(email, userId)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "DUPLICATE_EMAIL",
                    "이미 사용 중인 이메일입니다.",
                    "email"
            );
        }
        if (userRepository.existsByNicknameAndUserIdNot(nickname, userId)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "DUPLICATE_NICKNAME",
                    "이미 사용 중인 닉네임입니다.",
                    "nickname"
            );
        }

        validatePassword(request.password());
        user.convertToMember(email, nickname, passwordEncoder.encode(request.password()));

        String accountToken = jwtTokenProvider.createAccessToken(
                user.getUserId(),
                user.getAccountType().name(),
                user.getRole().name()
        );

        return new GuestConversionResponse(
                accountToken,
                user.getUserId(),
                user.getEmail(),
                user.getNickname(),
                user.getProfileImageUrl(),
                user.getStatusMessage(),
                user.getAccountType()
        );
    }

    @Transactional
    public void unlinkKakao(Long userId) {
        User user = getActiveUser(userId);

        if (!user.isKakaoAccount()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "NOT_KAKAO_ACCOUNT",
                    "카카오 계정만 연동을 해제할 수 있습니다."
            );
        }
        if (user.getKakaoId() == null || user.getKakaoId().isBlank()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "KAKAO_USER_ID_NOT_SAVED",
                    "저장된 카카오 사용자 식별자가 없습니다. OAuth 성공 처리에서 카카오 ID를 저장해 주세요."
            );
        }

        kakaoUnlinkClient.unlink(user.getKakaoId());
        profileImageStorageService.deleteByPublicUrl(user.getProfileImageUrl());
        user.unlinkKakao(deletedEmail(user), deletedNickname(user));
    }

    @Transactional
    public void withdrawMember(Long userId) {
        User user = requireMember(getActiveUser(userId));
        profileImageStorageService.deleteByPublicUrl(user.getProfileImageUrl());
        user.withdraw(deletedEmail(user), deletedNickname(user));
    }

    private User getActiveUser(Long userId) {
        if (userId == null) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTHENTICATION_REQUIRED",
                    "로그인이 필요합니다."
            );
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "USER_NOT_FOUND",
                        "사용자 정보를 찾을 수 없습니다."
                ));

        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "INACTIVE_ACCOUNT",
                    "비활성화된 계정입니다."
            );
        }
        return user;
    }

    private User requireMember(User user) {
        if (!user.isMemberAccount()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "MEMBER_ONLY_ACTION",
                    "자체 가입 회원만 사용할 수 있는 기능입니다."
            );
        }
        return user;
    }

    private void validatePassword(String password) {
        if (!PASSWORD_PATTERN.matcher(password).matches()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PASSWORD_FORMAT",
                    "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.",
                    "newPassword"
            );
        }
    }

    private String normalizeStatusMessage(String statusMessage) {
        return statusMessage == null ? "" : statusMessage.trim();
    }

    private String deletedEmail(User user) {
        return "deleted_" + user.getUserId() + "_" + Instant.now().toEpochMilli() + "@deleted.local";
    }

    private String deletedNickname(User user) {
        return "탈퇴한 사용자#" + user.getUserId();
    }
}
