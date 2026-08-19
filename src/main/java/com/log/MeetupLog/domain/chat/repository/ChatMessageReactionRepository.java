package com.log.MeetupLog.domain.chat.repository;

import com.log.MeetupLog.domain.chat.entity.ChatMessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChatMessageReactionRepository
        extends JpaRepository<ChatMessageReaction, Long> {

    Optional<ChatMessageReaction> findByMessageIdAndUserIdAndEmoji(
            Long messageId,
            Long userId,
            String emoji
    );

    List<ChatMessageReaction> findAllByMessageIdAndEmoji(Long messageId, String emoji);

    List<ChatMessageReaction> findAllByMessageIdIn(Collection<Long> messageIds);
}
