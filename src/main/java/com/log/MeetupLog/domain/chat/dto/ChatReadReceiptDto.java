package com.log.MeetupLog.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatReadReceiptDto {
    private Long roomId;
    private Long userId;
    private Long lastReadMessageId;
    private Map<Long, Integer> unreadCounts;
}
