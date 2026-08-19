package com.log.MeetupLog.domain.room.dto;

import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ChatRoomMemberResponse {
    private Long userId;
    private String nickname;
    private String email;
    private String profileImageUrl;
    private String statusMessage;
    private String accountType;
    private String presence;
    private RoomRole roomRole;

    public static ChatRoomMemberResponse from(ChatRoomMember member) {
        return from(member, "OFFLINE");
    }

    public static ChatRoomMemberResponse from(ChatRoomMember member, String presence) {
        return ChatRoomMemberResponse.builder()
                .userId(member.getUser().getUserId())
                .nickname(member.getUser().getNickname())
                .email(member.getUser().getEmail())
                .profileImageUrl(member.getUser().getProfileImageUrl())
                .statusMessage(member.getUser().getStatusMessage())
                .accountType(member.getUser().getAccountType().name())
                .presence(presence)
                .roomRole(member.getRoomRole())
                .build();
    }
}
