package com.log.MeetupLog.domain.user.dto;

import com.log.MeetupLog.domain.user.entity.AccountStatus;
import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.entity.Role;
import com.log.MeetupLog.domain.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class UserProfileResponse {

    private Long userId;

    private String email;

    private String nickname;

    private String profileImageUrl;

    private String statusMessage;

    private AccountType accountType;

    private Role role;

    private AccountStatus accountStatus;

    private boolean kakaoLinked;

    public static UserProfileResponse from(
            User user
    ) {
        return UserProfileResponse.builder()
                .userId(
                        user.getUserId()
                )
                .email(
                        user.getEmail()
                )
                .nickname(
                        user.getNickname()
                )
                .profileImageUrl(
                        user.getProfileImageUrl()
                )
                .statusMessage(
                        user.getStatusMessage()
                )
                .accountType(
                        user.getAccountType()
                )
                .role(
                        user.getRole()
                )
                .accountStatus(
                        user.getAccountStatus()
                )
                .kakaoLinked(
                        user.isKakaoAccount()
                )
                .build();
    }
}