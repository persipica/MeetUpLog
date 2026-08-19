package com.log.MeetupLog.domain.chat.entity;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@Table(name = "chat_messages")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Long id;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    // 시스템 메시지일 경우 NULL 가능
    @Column(name = "sender_id")
    private Long senderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false, length = 30)
    private MessageType messageType;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "reply_to_message_id")
    private Long replyToMessageId;

    @Column(name = "related_entity_type", length = 30)
    private String relatedEntityType;

    @Column(name = "related_entity_id")
    private Long relatedEntityId;

    @Column(name = "client_message_key", length = 100, unique = true)
    private String clientMessageKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_status", nullable = false, length = 20)
    private MessageStatus messageStatus;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    public enum MessageType {
        TEXT, SYSTEM, DECISION_CARD
    }

    public enum MessageStatus {
        ACTIVE, EDITED, DELETED
    }

    @Builder
    public ChatMessage(Long roomId, Long senderId, MessageType messageType, String content,
                       Long replyToMessageId, String relatedEntityType, Long relatedEntityId,
                       String clientMessageKey, MessageStatus messageStatus) {
        this.roomId = roomId;
        this.senderId = senderId;
        this.messageType = messageType != null ? messageType : MessageType.TEXT;
        this.content = content;
        this.replyToMessageId = replyToMessageId;
        this.relatedEntityType = relatedEntityType;
        this.relatedEntityId = relatedEntityId;
        this.clientMessageKey = clientMessageKey;
        this.messageStatus = messageStatus != null ? messageStatus : MessageStatus.ACTIVE;
    }

    @PrePersist
    public void prePersist() {
        if (this.sentAt == null) {
            this.sentAt = LocalDateTime.now();
        }
        if (this.messageStatus == null) {
            this.messageStatus = MessageStatus.ACTIVE;
        }
    }
}