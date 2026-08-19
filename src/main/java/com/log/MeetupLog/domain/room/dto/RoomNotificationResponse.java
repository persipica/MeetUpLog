package com.log.MeetupLog.domain.room.dto;

import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.NotificationSetting;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RoomNotificationResponse {
    private NotificationSetting notificationSetting;
    private LocalDateTime mutedUntil;
    private boolean muted;

    public static RoomNotificationResponse from(ChatRoomMember member) {
        return RoomNotificationResponse.builder()
                .notificationSetting(member.getNotificationSetting())
                .mutedUntil(member.getNotificationMutedUntil())
                .muted(member.isNotificationsMuted())
                .build();
    }
}
