package com.log.MeetupLog.domain.room.invite.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreateRoomInviteLinkRequest {
    @Min(1)
    @Max(720)
    private Integer expiresInHours = 24;

    @Min(1)
    @Max(500)
    private Integer maxUses = 50;
}
