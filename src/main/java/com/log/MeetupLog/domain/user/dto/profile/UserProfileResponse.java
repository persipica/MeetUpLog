package com.log.MeetupLog.domain.user.dto.profile;

import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.entity.Role;
import com.log.MeetupLog.domain.user.entity.User;

public record UserProfileResponse(
        Long userId,
        String email,
        String nickname,
        String profileImageUrl,
        String statusMessage,
        AccountType accountType,
        boolean kakaoLinked,
        Role role
) {
    public static UserProfileResponse from(User user) {
        return new UserProfileResponse(
                user.getUserId(),
                user.getEmail(),
                user.getNickname(),
                user.getProfileImageUrl(),
                user.getStatusMessage() == null ? "" : user.getStatusMessage(),
                user.getAccountType(),
                user.isKakaoAccount() && user.getKakaoId() != null,
                user.getRole()
        );
    }
}
