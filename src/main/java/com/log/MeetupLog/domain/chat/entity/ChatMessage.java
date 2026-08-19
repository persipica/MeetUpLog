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

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "image_mime_type", length = 100)
    private String imageMimeType;

    @Column(name = "image_size")
    private Long imageSize;

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
        TEXT, IMAGE, SYSTEM, DECISION_CARD
    }

    public enum MessageStatus {
        ACTIVE, EDITED, DELETED
    }

    @Builder
    public ChatMessage(Long roomId, Long senderId, MessageType messageType, String content,
                       String imageUrl, String imageMimeType, Long imageSize,
                       Long replyToMessageId, String relatedEntityType, Long relatedEntityId,
                       String clientMessageKey, MessageStatus messageStatus) {
        this.roomId = roomId;
        this.senderId = senderId;
        this.messageType = messageType != null ? messageType : MessageType.TEXT;
        this.content = content;
        this.imageUrl = imageUrl;
        this.imageMimeType = imageMimeType;
        this.imageSize = imageSize;
        this.replyToMessageId = replyToMessageId;
        this.relatedEntityType = relatedEntityType;
        this.relatedEntityId = relatedEntityId;
        this.clientMessageKey = clientMessageKey;
        this.messageStatus = messageStatus != null ? messageStatus : MessageStatus.ACTIVE;
    }

    public void editContent(String content) {
        if (this.messageType != MessageType.TEXT || this.messageStatus == MessageStatus.DELETED) {
            throw new IllegalStateException("수정할 수 없는 메시지입니다.");
        }
        this.content = content;
        this.messageStatus = MessageStatus.EDITED;
        this.editedAt = LocalDateTime.now();
    }

    public void deleteMessage() {
        if (this.messageStatus == MessageStatus.DELETED) {
            return;
        }
        this.content = null;
        this.imageUrl = null;
        this.imageMimeType = null;
        this.imageSize = null;
        this.messageStatus = MessageStatus.DELETED;
        this.editedAt = LocalDateTime.now();
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
