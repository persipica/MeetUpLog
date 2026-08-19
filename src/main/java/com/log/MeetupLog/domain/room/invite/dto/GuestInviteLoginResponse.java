package com.log.MeetupLog.domain.room.invite.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GuestInviteLoginResponse {
    private Long userId;
    private String nickname;
    private String accountType;
    private String accountToken;
    private Long inviteRoomId;
    private String inviteRoomName;
}
