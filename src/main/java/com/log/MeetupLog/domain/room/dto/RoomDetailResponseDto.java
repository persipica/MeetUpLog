package com.log.MeetupLog.domain.room.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDetailResponseDto {

    private Long roomId;
    private String roomName;
    private String description;
    private String roomImageUrl;
    private Integer currentMembers;
    private Integer maxMembers;
    private Long createdById;
    private String createdByNickname;
    private LocalDateTime createdAt;
    private List<MemberSummaryDto> members;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberSummaryDto {
        private Long userId;
        private String nickname;
        private String roomRole;
        private LocalDateTime joinedAt;
    }
}