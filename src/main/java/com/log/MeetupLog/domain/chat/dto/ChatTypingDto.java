package com.log.MeetupLog.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatTypingDto {
    private Long roomId;
    private Long userId;
    private String nickname;
    private boolean typing;
}
