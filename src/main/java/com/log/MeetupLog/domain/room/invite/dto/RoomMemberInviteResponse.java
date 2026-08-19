package com.log.MeetupLog.domain.room.invite.dto;

import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInvite;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RoomMemberInviteResponse {
    private Long inviteId;
    private Long roomId;
    private String roomName;
    private Long inviterId;
    private String inviterNickname;
    private Long inviteeId;
    private String inviteeNickname;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    public static RoomMemberInviteResponse from(RoomMemberInvite invite) {
        return RoomMemberInviteResponse.builder()
                .inviteId(invite.getRoomMemberInviteId())
                .roomId(invite.getRoom().getRoomId())
                .roomName(invite.getRoom().getRoomName())
                .inviterId(invite.getInviter().getUserId())
                .inviterNickname(invite.getInviter().getNickname())
                .inviteeId(invite.getInvitee().getUserId())
                .inviteeNickname(invite.getInvitee().getNickname())
                .status(invite.getInviteStatus().name())
                .createdAt(invite.getCreatedAt())
                .expiresAt(invite.getExpiresAt())
                .build();
    }
}
