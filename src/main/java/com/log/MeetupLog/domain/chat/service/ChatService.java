package com.log.MeetupLog.domain.chat.service;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate; // WebSocket 브로드캐스트용 주입

    // 실시간 메시지 DB 저장
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

    // 과거 대화 내역 조회 (작성자 닉네임 매핑)
    public List<ChatMessageDto> getMessagesByRoomId(Long roomId) {
        List<ChatMessage> messageEntities = chatMessageRepository.findByRoomIdOrderBySentAtAsc(roomId);

        // 1. 메시지 작성자 ID 목록 추출 (중복 제거 및 null 제외)
        List<Long> senderIds = messageEntities.stream()
                .map(ChatMessage::getSenderId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        // 2. 작성자 정보 일괄 조회 후 Map 변환 (N+1 방지)
        Map<Long, String> userNicknameMap = userRepository.findAllById(senderIds).stream()
                .collect(Collectors.toMap(User::getUserId, User::getNickname));

        // 3. DTO 변환 및 닉네임 세팅
        return messageEntities.stream()
                .map(msg -> {
                    String nickname = "System";
                    if (msg.getSenderId() != null) {
                        nickname = userNicknameMap.getOrDefault(msg.getSenderId(), "알 수 없는 사용자");
                    }
                    return ChatMessageDto.builder()
                            .messageId(msg.getId())
                            .roomId(msg.getRoomId())
                            .senderId(msg.getSenderId())
                            .senderNickname(nickname)
                            .messageType(msg.getMessageType())
                            .content(msg.getContent())
                            .replyToMessageId(msg.getReplyToMessageId())
                            .relatedEntityType(msg.getRelatedEntityType())
                            .relatedEntityId(msg.getRelatedEntityId())
                            .messageStatus(msg.getMessageStatus())
                            .sentAt(msg.getSentAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // 퇴장 등 시스템 알림 메시지 발송
    @Transactional
    public void sendSystemMessage(Long roomId, String messageText) {
        ChatMessage systemEntity = ChatMessage.builder()
                .roomId(roomId)
                .senderId(null)
                .content(messageText)
                .messageType(ChatMessage.MessageType.SYSTEM)
                .messageStatus(ChatMessage.MessageStatus.ACTIVE)
                .build();

        ChatMessage saved = chatMessageRepository.save(systemEntity);

        ChatMessageDto broadcastDto = ChatMessageDto.builder()
                .messageId(saved.getId())
                .roomId(saved.getRoomId())
                .senderId(null)
                .senderNickname("[알림]")
                .content(saved.getContent())
                .messageType(saved.getMessageType())
                .messageStatus(saved.getMessageStatus())
                .sentAt(saved.getSentAt())
                .build();

        messagingTemplate.convertAndSend("/sub/room/" + roomId, broadcastDto);
    }
}