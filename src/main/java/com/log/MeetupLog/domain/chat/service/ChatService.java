package com.log.MeetupLog.domain.chat.service;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;

    @Transactional
    public ChatMessageDto saveMessage(ChatMessageDto messageDto) {
        ChatMessage entity = ChatMessage.builder()
                .roomId(messageDto.getRoomId())
                .senderId(messageDto.getSenderId())
                .messageType(messageDto.getMessageType())
                .content(messageDto.getContent())
                .replyToMessageId(messageDto.getReplyToMessageId())
                .relatedEntityType(messageDto.getRelatedEntityType())
                .relatedEntityId(messageDto.getRelatedEntityId())
                .clientMessageKey(messageDto.getClientMessageKey())
                .messageStatus(ChatMessage.MessageStatus.ACTIVE)
                .build();

        ChatMessage saved = chatMessageRepository.save(entity);
        messageDto.setMessageId(saved.getId());
        messageDto.setSentAt(saved.getSentAt());
        return messageDto;
    }

    public List<ChatMessageDto> getMessagesByRoomId(Long roomId) {
        return chatMessageRepository.findByRoomIdOrderBySentAtAsc(roomId)
                .stream()
                .map(msg -> ChatMessageDto.builder()
                        .messageId(msg.getId())
                        .roomId(msg.getRoomId())
                        .senderId(msg.getSenderId())
                        .messageType(msg.getMessageType())
                        .content(msg.getContent())
                        .replyToMessageId(msg.getReplyToMessageId())
                        .relatedEntityType(msg.getRelatedEntityType())
                        .relatedEntityId(msg.getRelatedEntityId())
                        .messageStatus(msg.getMessageStatus())
                        .sentAt(msg.getSentAt())
                        .build())
                .collect(Collectors.toList());
    }
}