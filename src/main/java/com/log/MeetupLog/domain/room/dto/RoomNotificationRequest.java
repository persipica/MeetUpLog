package com.log.MeetupLog.domain.room.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RoomNotificationRequest {

    @NotBlank
    private String mode;
}
