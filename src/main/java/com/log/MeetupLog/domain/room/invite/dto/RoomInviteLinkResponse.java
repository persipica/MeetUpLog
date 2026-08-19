package com.log.MeetupLog.domain.room.invite.dto;

import com.log.MeetupLog.domain.room.invite.entity.RoomInvite;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RoomInviteLinkResponse {
    private Long inviteId;
    private Long roomId;
    private String roomName;
    private String inviteToken;
    private String invitePath;
    private String status;
    private int maxUses;
    private int usedCount;
    private LocalDateTime expiresAt;

    public static RoomInviteLinkResponse created(RoomInvite invite, String rawToken) {
        return RoomInviteLinkResponse.builder()
                .inviteId(invite.getInviteId())
                .roomId(invite.getRoom().getRoomId())
                .roomName(invite.getRoom().getRoomName())
                .inviteToken(rawToken)
                .invitePath("/invite/" + rawToken)
                .status(invite.getInviteStatus().name())
                .maxUses(invite.getMaxUses())
                .usedCount(invite.getUsedCount())
                .expiresAt(invite.getExpiresAt())
                .build();
    }

    public static RoomInviteLinkResponse active(RoomInvite invite) {
        return RoomInviteLinkResponse.builder()
                .inviteId(invite.getInviteId())
                .roomId(invite.getRoom().getRoomId())
                .roomName(invite.getRoom().getRoomName())
                .status(invite.getInviteStatus().name())
                .maxUses(invite.getMaxUses())
                .usedCount(invite.getUsedCount())
                .expiresAt(invite.getExpiresAt())
                .build();
    }
}
