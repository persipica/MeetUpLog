package com.log.MeetupLog.domain.room.invite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class GuestInviteLoginRequest {
    @NotBlank
    @Size(min = 2, max = 20)
    private String nickname;
}
