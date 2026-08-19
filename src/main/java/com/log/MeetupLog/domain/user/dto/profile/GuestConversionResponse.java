package com.log.MeetupLog.domain.user.dto.profile;

import com.log.MeetupLog.domain.user.entity.AccountType;

public record GuestConversionResponse(
        String accountToken,
        Long userId,
        String email,
        String nickname,
        String profileImageUrl,
        String statusMessage,
        AccountType accountType
) {
}
