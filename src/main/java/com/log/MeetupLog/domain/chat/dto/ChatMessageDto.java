package com.log.MeetupLog.domain.chat.dto;

import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {

    private Long messageId;
    private Long roomId;
    private Long senderId;
    private String senderNickname; // 화면 표시용 (DB 저장은 X, 실시간 전송 시 활용)
    private ChatMessage.MessageType messageType;
    private String content;
    private Long replyToMessageId;
    private String relatedEntityType;
    private Long relatedEntityId;
    private String clientMessageKey;
    private ChatMessage.MessageStatus messageStatus;
    private LocalDateTime sentAt;
}