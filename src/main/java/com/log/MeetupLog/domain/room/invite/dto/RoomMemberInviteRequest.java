package com.log.MeetupLog.domain.room.invite.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RoomMemberInviteRequest {
    @NotNull
    private Long inviteeUserId;
}
