package com.log.MeetupLog.domain.room.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ChatRoomUpdateRequest {

    @NotBlank(message = "채팅방 이름을 입력해 주세요.")
    @Size(max = 100, message = "채팅방 이름은 100자 이하로 입력해 주세요.")
    private String roomName;
}
