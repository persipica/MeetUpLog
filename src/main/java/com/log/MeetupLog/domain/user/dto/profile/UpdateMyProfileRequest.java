package com.log.MeetupLog.domain.user.dto.profile;

import jakarta.validation.constraints.Size;

public record UpdateMyProfileRequest(
        @Size(min = 2, max = 50, message = "닉네임은 2자 이상 50자 이하여야 합니다.")
        String nickname,

        @Size(max = 120, message = "상태 메시지는 120자 이하여야 합니다.")
        String statusMessage,

        String profileImageUrl
) {
}
