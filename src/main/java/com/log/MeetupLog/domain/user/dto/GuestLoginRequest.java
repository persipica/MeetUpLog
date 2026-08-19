package com.log.MeetupLog.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class GuestLoginRequest {

    @NotBlank(message = "닉네임 필수 입력 항목입니다.") // 공백만 들어오는것을 막아줌.
    @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하여야 합니다.")
    private String nickname;

}
