package com.log.MeetupLog.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class ChatImageResponse {
    private String imageUrl;
    private String fileName;
    private String mimeType;
    private long size;
}
