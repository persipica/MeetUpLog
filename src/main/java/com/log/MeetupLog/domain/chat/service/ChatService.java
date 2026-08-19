package com.log.MeetupLog.domain.chat.service;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.dto.ChatReadReceiptDto;
import com.log.MeetupLog.domain.chat.dto.ChatTypingDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.chat.entity.ChatMessageReaction;
import com.log.MeetupLog.domain.chat.repository.ChatMessageReactionRepository;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatService {

    private static final int MAX_TEXT_LENGTH = 4_000;

    private final ChatMessageRepository chatMessageRepository;
    private final ChatMessageReactionRepository reactionRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatMessageDto saveUserMessage(Long userId, ChatMessageDto request) {
        requireActiveMember(request.getRoomId(), userId);

        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        if (request.getClientMessageKey() != null && !request.getClientMessageKey().isBlank()) {
            ChatMessage duplicated = chatMessageRepository
                    .findByClientMessageKey(request.getClientMessageKey())
                    .orElse(null);
            if (duplicated != null) {
                ChatMessageDto duplicatedDto = toDto(duplicated, sender.getNickname());
                duplicatedDto.setEventType("MESSAGE_CREATED");
                duplicatedDto.setUnreadCount(calculateUnreadCount(
                        duplicated,
                        activeMembers(duplicated.getRoomId())
                ));
                return duplicatedDto;
            }
        }

        boolean imageMessage = request.getMessageType() == ChatMessage.MessageType.IMAGE;

        ChatMessage entity = ChatMessage.builder()
                .roomId(request.getRoomId())
                .senderId(userId)
                .messageType(imageMessage
                        ? ChatMessage.MessageType.IMAGE
                        : ChatMessage.MessageType.TEXT)
                .content(imageMessage
                        ? normalizeImageName(request.getContent())
                        : normalizeText(request.getContent()))
                .imageUrl(imageMessage ? normalizeImageUrl(request.getImageUrl()) : null)
                .imageMimeType(imageMessage ? request.getImageMimeType() : null)
                .imageSize(imageMessage ? request.getImageSize() : null)
                .replyToMessageId(request.getReplyToMessageId())
                .relatedEntityType(request.getRelatedEntityType())
                .relatedEntityId(request.getRelatedEntityId())
                .clientMessageKey(request.getClientMessageKey())
                .messageStatus(ChatMessage.MessageStatus.ACTIVE)
                .build();

        ChatMessage saved = chatMessageRepository.save(entity);
        ChatMessageDto dto = toDto(saved, sender.getNickname());
        dto.setUnreadCount(calculateUnreadCount(saved, activeMembers(saved.getRoomId())));
        dto.setEventType("MESSAGE_CREATED");
        return dto;
    }

    @Transactional
    public ChatMessageDto saveSystemMessage(
            Long roomId,
            String content,
            String systemEvent,
            Long relatedUserId
    ) {
        ChatMessage entity = ChatMessage.builder()
                .roomId(roomId)
                .senderId(null)
                .messageType(ChatMessage.MessageType.SYSTEM)
                .content(content)
                .relatedEntityType(systemEvent)
                .relatedEntityId(relatedUserId)
                .messageStatus(ChatMessage.MessageStatus.ACTIVE)
                .build();

        ChatMessageDto dto = toDto(chatMessageRepository.save(entity), "System");
        dto.setSystemEvent(systemEvent);
        dto.setUnreadCount(0);
        dto.setEventType("MESSAGE_CREATED");
        return dto;
    }

    @Transactional
    public ChatMessageDto editUserMessage(Long userId, Long roomId, Long messageId, String content) {
        requireActiveMember(roomId, userId);
        ChatMessage message = requireOwnedMessage(userId, roomId, messageId);
        message.editContent(normalizeText(content));

        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        ChatMessageDto dto = toDto(message, sender.getNickname());
        dto.setUnreadCount(calculateUnreadCount(message, activeMembers(roomId)));
        dto.setEventType("MESSAGE_UPDATED");
        return dto;
    }

    @Transactional
    public ChatMessageDto deleteUserMessage(Long userId, Long roomId, Long messageId) {
        requireActiveMember(roomId, userId);
        ChatMessage message = requireOwnedMessage(userId, roomId, messageId);
        message.deleteMessage();

        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        ChatMessageDto dto = toDto(message, sender.getNickname());
        dto.setUnreadCount(calculateUnreadCount(message, activeMembers(roomId)));
        dto.setEventType("MESSAGE_DELETED");
        return dto;
    }

    @Transactional
    public ChatReadReceiptDto markMessagesRead(Long userId, ChatReadReceiptDto request) {
        Long roomId = request.getRoomId();
        Long lastReadMessageId = request.getLastReadMessageId();
        requireActiveMember(roomId, userId);

        if (lastReadMessageId == null) {
            throw new IllegalArgumentException("마지막으로 읽은 메시지가 필요합니다.");
        }
        chatMessageRepository.findByIdAndRoomId(lastReadMessageId, roomId)
                .orElseThrow(() -> new IllegalArgumentException("채팅방에 존재하지 않는 메시지입니다."));

        ChatRoomMember reader = chatRoomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new IllegalStateException("채팅방 참여 정보를 찾을 수 없습니다."));
        reader.markRead(lastReadMessageId);

        List<ChatRoomMember> activeMembers = activeMembers(roomId);
        Map<Long, Integer> unreadCounts = new LinkedHashMap<>();
        chatMessageRepository
                .findByRoomIdAndIdLessThanEqualOrderBySentAtAsc(roomId, lastReadMessageId)
                .forEach(message -> unreadCounts.put(
                        message.getId(),
                        calculateUnreadCount(message, activeMembers)
                ));

        return ChatReadReceiptDto.builder()
                .roomId(roomId)
                .userId(userId)
                .lastReadMessageId(reader.getLastReadMessageId())
                .unreadCounts(unreadCounts)
                .build();
    }

    public List<ChatMessageDto> getMessagesByRoomId(Long userId, Long roomId) {
        requireActiveMember(roomId, userId);
        List<ChatMessage> messages = chatMessageRepository.findByRoomIdOrderBySentAtAsc(roomId);

        List<Long> senderIds = messages.stream()
                .map(ChatMessage::getSenderId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, User> senders = senderIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(senderIds).stream()
                    .collect(Collectors.toMap(User::getUserId, Function.identity()));

        List<Long> messageIds = messages.stream()
                .map(ChatMessage::getId)
                .toList();

        Map<Long, Map<String, List<Long>>> reactionsByMessage = messageIds.isEmpty()
                ? Collections.emptyMap()
                : reactionRepository.findAllByMessageIdIn(messageIds).stream()
                .collect(Collectors.groupingBy(
                        ChatMessageReaction::getMessageId,
                        Collectors.groupingBy(
                                ChatMessageReaction::getEmoji,
                                Collectors.mapping(
                                        ChatMessageReaction::getUserId,
                                        Collectors.toList()
                                )
                        )
                ));

        List<ChatRoomMember> activeMembers = activeMembers(roomId);

        return messages.stream()
                .map(message -> {
                    User sender = senders.get(message.getSenderId());
                    ChatMessageDto dto = toDto(
                            message,
                            sender == null ? "System" : sender.getNickname()
                    );
                    if (message.getMessageType() == ChatMessage.MessageType.SYSTEM) {
                        dto.setSystemEvent(message.getRelatedEntityType());
                    }
                    dto.setReactions(reactionsByMessage.getOrDefault(
                            message.getId(),
                            Collections.emptyMap()
                    ));
                    dto.setUnreadCount(calculateUnreadCount(message, activeMembers));
                    return dto;
                })
                .toList();
    }

    public ChatTypingDto createTypingEvent(Long userId, ChatTypingDto request) {
        requireActiveMember(request.getRoomId(), userId);
        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        return ChatTypingDto.builder()
                .roomId(request.getRoomId())
                .userId(userId)
                .nickname(sender.getNickname())
                .typing(request.isTyping())
                .build();
    }

    private String normalizeText(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isBlank()) {
            throw new IllegalArgumentException("빈 메시지는 보낼 수 없습니다.");
        }
        if (text.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException("메시지는 4,000자 이하로 입력해 주세요.");
        }
        return text;
    }

    private String normalizeImageName(String value) {
        String name = value == null ? "사진" : value.trim();
        if (name.isBlank()) {
            return "사진";
        }
        return name.length() > 255 ? name.substring(0, 255) : name;
    }

    private String normalizeImageUrl(String value) {
        String imageUrl = value == null ? "" : value.trim();
        if (!imageUrl.startsWith("/api/v1/chat/images/")) {
            throw new IllegalArgumentException("먼저 이미지를 업로드해 주세요.");
        }
        return imageUrl;
    }

    private void requireActiveMember(Long roomId, Long userId) {
        if (roomId == null || userId == null ||
                !chatRoomMemberRepository.existsByRoomIdAndUserIdAndStatus(
                        roomId, userId, MemberStatus.ACTIVE
                )) {
            throw new IllegalStateException("참여 중인 채팅방에서만 이용할 수 있습니다.");
        }
    }

    private ChatMessage requireOwnedMessage(Long userId, Long roomId, Long messageId) {
        ChatMessage message = chatMessageRepository.findByIdAndRoomId(messageId, roomId)
                .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다."));
        if (!Objects.equals(message.getSenderId(), userId)) {
            throw new IllegalStateException("본인이 보낸 메시지만 변경할 수 있습니다.");
        }
        return message;
    }

    private List<ChatRoomMember> activeMembers(Long roomId) {
        return chatRoomMemberRepository.findAllByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
    }

    private int calculateUnreadCount(ChatMessage message, List<ChatRoomMember> members) {
        if (message.getSenderId() == null || message.getMessageType() == ChatMessage.MessageType.SYSTEM) {
            return 0;
        }

        return (int) members.stream()
                .filter(member -> !Objects.equals(member.getUser().getUserId(), message.getSenderId()))
                .filter(member -> member.getLastReadMessageId() == null ||
                        member.getLastReadMessageId() < message.getId())
                .count();
    }

    private ChatMessageDto toDto(ChatMessage message, String senderNickname) {
        return ChatMessageDto.builder()
                .messageId(message.getId())
                .roomId(message.getRoomId())
                .senderId(message.getSenderId())
                .senderNickname(senderNickname)
                .messageType(message.getMessageType())
                .content(message.getContent())
                .imageUrl(message.getImageUrl())
                .imageMimeType(message.getImageMimeType())
                .imageSize(message.getImageSize())
                .replyToMessageId(message.getReplyToMessageId())
                .relatedEntityType(message.getRelatedEntityType())
                .relatedEntityId(message.getRelatedEntityId())
                .clientMessageKey(message.getClientMessageKey())
                .messageStatus(message.getMessageStatus())
                .sentAt(message.getSentAt())
                .reactions(Collections.emptyMap())
                .unreadCount(0)
                .build();
    }
}
