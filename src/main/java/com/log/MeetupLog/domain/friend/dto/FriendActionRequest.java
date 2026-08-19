package com.log.MeetupLog.domain.friend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class FriendActionRequest {
    @NotNull
    private Long receiverId;

    @Size(max = 200)
    private String message;
}
