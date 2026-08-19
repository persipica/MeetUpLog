package com.log.MeetupLog.global.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

@Component
public class ChatWebSocketHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(
            ServerHttpRequest request,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        Object userId = attributes.get(ChatWebSocketHandshakeInterceptor.USER_ID_ATTRIBUTE);
        return userId == null ? null : () -> String.valueOf(userId);
    }
}
