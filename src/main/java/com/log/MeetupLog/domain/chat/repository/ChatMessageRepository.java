package com.log.MeetupLog.domain.chat.repository;

import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdOrderBySentAtAsc(Long roomId);
    Optional<ChatMessage> findByClientMessageKey(String clientMessageKey);
    Optional<ChatMessage> findTopByRoomIdOrderBySentAtDesc(Long roomId);
    Optional<ChatMessage> findByIdAndRoomId(Long id, Long roomId);
    List<ChatMessage> findByRoomIdAndIdLessThanEqualOrderBySentAtAsc(Long roomId, Long id);
}
