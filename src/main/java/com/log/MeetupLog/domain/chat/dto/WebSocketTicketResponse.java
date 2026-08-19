package com.log.MeetupLog.domain.chat.dto;

import java.time.Instant;

public record WebSocketTicketResponse(String ticket, Instant expiresAt) {
}
