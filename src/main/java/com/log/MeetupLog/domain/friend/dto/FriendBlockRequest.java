package com.log.MeetupLog.domain.friend.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class FriendBlockRequest {
    @Size(max = 200)
    private String reason;
}
