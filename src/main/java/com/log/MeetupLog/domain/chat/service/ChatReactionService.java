package com.log.MeetupLog.domain.chat.service;

import com.log.MeetupLog.domain.chat.dto.ChatReactionDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.entity.ChatMessageReaction;
import com.log.MeetupLog.domain.chat.repository.ChatMessageReactionRepository;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatReactionService {

    private static final int MAX_EMOJI_LENGTH = 32;

    private final ChatMessageRepository messageRepository;
    private final ChatMessageReactionRepository reactionRepository;
    private final ChatRoomMemberRepository memberRepository;

    @Transactional
    public ChatReactionDto toggle(Long userId, ChatReactionDto request) {
        if (request.getRoomId() == null || request.getMessageId() == null) {
            throw new IllegalArgumentException("채팅방과 메시지 정보가 필요합니다.");
        }

        String emoji = normalizeEmoji(request.getEmoji());
        requireActiveMember(request.getRoomId(), userId);

        ChatMessage message = messageRepository.findById(request.getMessageId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 메시지입니다."));

        if (!request.getRoomId().equals(message.getRoomId())) {
            throw new IllegalArgumentException("채팅방의 메시지가 아닙니다.");
        }
        if (message.getMessageStatus() == ChatMessage.MessageStatus.DELETED) {
            throw new IllegalStateException("삭제된 메시지에는 반응할 수 없습니다.");
        }

        reactionRepository.findByMessageIdAndUserIdAndEmoji(
                message.getId(), userId, emoji
        ).ifPresentOrElse(
                reactionRepository::delete,
                () -> reactionRepository.save(ChatMessageReaction.builder()
                        .messageId(message.getId())
                        .userId(userId)
                        .emoji(emoji)
                        .build())
        );

        List<Long> userIds = reactionRepository
                .findAllByMessageIdAndEmoji(message.getId(), emoji)
                .stream()
                .map(ChatMessageReaction::getUserId)
                .sorted()
                .toList();

        return ChatReactionDto.builder()
                .roomId(message.getRoomId())
                .messageId(message.getId())
                .emoji(emoji)
                .userIds(userIds)
                .build();
    }

    private String normalizeEmoji(String value) {
        String emoji = value == null ? "" : value.trim();
        if (emoji.isBlank() || emoji.length() > MAX_EMOJI_LENGTH) {
            throw new IllegalArgumentException("올바른 반응 이모지를 선택해 주세요.");
        }
        return emoji;
    }

    private void requireActiveMember(Long roomId, Long userId) {
        if (!memberRepository.existsByRoomIdAndUserIdAndStatus(
                roomId, userId, MemberStatus.ACTIVE
        )) {
            throw new SecurityException("채팅방 참여자만 반응할 수 있습니다.");
        }
    }
}
