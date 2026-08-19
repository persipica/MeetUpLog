package com.log.MeetupLog.global.websocket;

import com.log.MeetupLog.domain.chat.dto.WebSocketTicketResponse;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatWebSocketTicketService {

    private static final Duration VALIDITY = Duration.ofMinutes(2);
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    public WebSocketTicketResponse issue(Long userId) {
        cleanupExpired();
        String value = UUID.randomUUID().toString().replace("-", "");
        Instant expiresAt = Instant.now().plus(VALIDITY);
        tickets.put(value, new Ticket(userId, expiresAt));
        return new WebSocketTicketResponse(value, expiresAt);
    }

    public Long consume(String value) {
        if (value == null || value.isBlank()) return null;
        Ticket ticket = tickets.remove(value);
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) return null;
        return ticket.userId();
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        tickets.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private record Ticket(Long userId, Instant expiresAt) {
    }
}
