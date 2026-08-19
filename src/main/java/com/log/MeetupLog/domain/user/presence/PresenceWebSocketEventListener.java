package com.log.MeetupLog.domain.user.presence;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@RequiredArgsConstructor
public class PresenceWebSocketEventListener {

    private final PresenceService presenceService;
    private final SimpMessageSendingOperations messagingTemplate;

    @EventListener
    public void connected(SessionConnectedEvent springEvent) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(springEvent.getMessage());
        Principal principal = springEvent.getUser();
        String sessionId = accessor.getSessionId();
        if (principal == null || sessionId == null) return;

        PresenceEvent event = presenceService.connect(
                Long.valueOf(principal.getName()),
                sessionId
        );
        messagingTemplate.convertAndSend("/sub/presence", event);
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent springEvent) {
        Principal principal = springEvent.getUser();
        String sessionId = springEvent.getSessionId();
        if (principal == null || sessionId == null) return;

        PresenceEvent event = presenceService.disconnect(
                Long.valueOf(principal.getName()),
                sessionId
        );
        messagingTemplate.convertAndSend("/sub/presence", event);
    }
}
