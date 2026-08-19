package com.log.MeetupLog.domain.user.presence;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class PresenceWebSocketController {

    private final PresenceService presenceService;
    private final SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/presence")
    public void change(PresenceEvent request, Principal principal) {
        Long userId = requireUserId(principal);
        PresenceEvent event = presenceService.change(userId, request.getPresence());
        messagingTemplate.convertAndSend("/sub/presence", event);
    }

    private Long requireUserId(Principal principal) {
        if (principal == null || principal.getName() == null) {
            throw new IllegalStateException("WebSocket 인증이 필요합니다.");
        }
        return Long.valueOf(principal.getName());
    }
}
