package com.log.MeetupLog.domain.chat.controller;

import com.log.MeetupLog.domain.chat.dto.WebSocketTicketResponse;
import com.log.MeetupLog.global.websocket.ChatWebSocketTicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ChatWebSocketTicketController {

    private final ChatWebSocketTicketService ticketService;

    @PostMapping("/api/v1/chat/ws-ticket")
    public ResponseEntity<WebSocketTicketResponse> issueTicket(
            @AuthenticationPrincipal Long userId
    ) {
        if (userId == null) {
            throw new IllegalStateException("로그인이 필요합니다.");
        }
        return ResponseEntity.ok(ticketService.issue(userId));
    }
}
