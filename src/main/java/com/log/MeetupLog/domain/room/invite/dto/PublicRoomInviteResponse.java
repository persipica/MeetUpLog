package com.log.MeetupLog.domain.room.invite.dto;

import com.log.MeetupLog.domain.room.invite.entity.RoomInvite;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PublicRoomInviteResponse {
    private Long roomId;
    private String roomName;
    private String roomImageUrl;
    private String topicType;
    private int maxMembers;
    private boolean valid;
    private LocalDateTime expiresAt;

    public static PublicRoomInviteResponse from(RoomInvite invite) {
        return PublicRoomInviteResponse.builder()
                .roomId(invite.getRoom().getRoomId())
                .roomName(invite.getRoom().getRoomName())
                .roomImageUrl(invite.getRoom().getRoomImageUrl())
                .topicType(invite.getRoom().getTopicType())
                .maxMembers(invite.getRoom().getMaxMembers())
                .valid(invite.isUsable())
                .expiresAt(invite.getExpiresAt())
                .build();
    }
}
