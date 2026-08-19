package com.log.MeetupLog.domain.user.presence;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class PresenceService {

    private final ConcurrentMap<Long, Set<String>> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, PresenceStatus> selectedStatuses = new ConcurrentHashMap<>();

    public PresenceEvent connect(Long userId, String sessionId) {
        sessions.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet())
                .add(sessionId);
        selectedStatuses.putIfAbsent(userId, PresenceStatus.ONLINE);
        return event(userId, currentStatus(userId));
    }

    public PresenceEvent disconnect(Long userId, String sessionId) {
        Set<String> userSessions = sessions.get(userId);
        if (userSessions != null) {
            userSessions.remove(sessionId);
            if (userSessions.isEmpty()) {
                sessions.remove(userId);
                selectedStatuses.remove(userId);
            }
        }
        return event(userId, currentStatus(userId));
    }

    public PresenceEvent change(Long userId, String rawPresence) {
        PresenceStatus next;
        try {
            next = PresenceStatus.valueOf(
                    rawPresence == null ? "" : rawPresence.trim().toUpperCase()
            );
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("올바른 상태를 선택해 주세요.");
        }

        selectedStatuses.put(userId, next);
        return event(userId, currentStatus(userId));
    }

    public PresenceStatus currentStatus(Long userId) {
        Set<String> userSessions = sessions.get(userId);
        if (userSessions == null || userSessions.isEmpty()) {
            return PresenceStatus.OFFLINE;
        }
        return selectedStatuses.getOrDefault(userId, PresenceStatus.ONLINE);
    }

    private PresenceEvent event(Long userId, PresenceStatus status) {
        return PresenceEvent.builder()
                .userId(userId)
                .id(userId)
                .identity("id:" + userId)
                .presence(status.name())
                .changedAt(Instant.now())
                .build();
    }
}
