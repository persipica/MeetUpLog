package com.log.MeetupLog.domain.room.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ChatRoomEventResponse {
    private String eventType;
    private Long roomId;
    private String roomName;
    private Long actorId;
    private String actorNickname;
    private LocalDateTime occurredAt;
}
