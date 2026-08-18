package com.log.MeetupLog.domain.user.dto;

public record UpdateProfileRequest(
        String nickname,
        String profileImageUrl,
        String statusMessage
) {
}