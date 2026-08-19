package com.log.MeetupLog.domain.room.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ChatRoomCreateRequest {

    @NotBlank(message = "모임 방 이름은 필수입니다.")
    private String roomName;

    private String description;

    private String roomImageUrl;

    private String topicType;

    @Min(value = 2, message = "최소 정원은 2명 이상이어야 합니다.")
    @Max(value = 100, message = "최대 정원은 100명 이하이어야 합니다.")
    private Integer maxMembers;
}
