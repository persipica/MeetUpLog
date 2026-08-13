package com.log.MeetupLog.domain.user.dto;

import com.log.MeetupLog.domain.user.entity.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class AuthResponse {

    private String accountToken; // JWT 토큰
    private Long userId;
    private String email;
    private String nickname;
    private AccountType accountType;
}