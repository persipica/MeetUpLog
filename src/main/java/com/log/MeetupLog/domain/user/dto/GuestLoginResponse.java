package com.log.MeetupLog.domain.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class GuestLoginResponse {

    private Long userId;
    private String nickname;
    private String accountType;     // GUEST
    private String accountToken;    // 발급된 JWT 토큰

}
