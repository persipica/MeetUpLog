package com.log.MeetupLog.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatReactionDto {
    private Long roomId;
    private Long messageId;
    private String emoji;
    private List<Long> userIds;
}
