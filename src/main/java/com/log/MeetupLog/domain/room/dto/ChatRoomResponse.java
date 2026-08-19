package com.log.MeetupLog.domain.room.dto;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import com.log.MeetupLog.domain.room.entity.RoomType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ChatRoomResponse {

    private Long roomId;
    private RoomType roomType;
    private String roomName;
    private String description;
    private String roomImageUrl;
    private int maxMembers;
    private int currentMembers;
    private RoomStatus roomStatus;
    private Long createdById;
    private String createdByNickname;
    private LocalDateTime createdAt;

    public static ChatRoomResponse from(ChatRoom room, int currentMembers) {
        return ChatRoomResponse.builder()
                .roomId(room.getRoomId())
                .roomType(room.getRoomType())
                .roomName(room.getRoomName())
                .description(room.getDescription())
                .roomImageUrl(room.getRoomImageUrl())
                .maxMembers(room.getMaxMembers())
                .currentMembers(currentMembers)
                .roomStatus(room.getRoomStatus())
                .createdById(room.getCreatedBy().getUserId())
                .createdByNickname(room.getCreatedBy().getNickname())
                .createdAt(room.getCreatedAt())
                .build();
    }
}