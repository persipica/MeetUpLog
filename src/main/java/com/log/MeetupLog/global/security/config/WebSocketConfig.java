package com.log.MeetupLog.global.security.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 메시지 구독 요청 prefix (클라이언트가 메시지를 받을 때: /sub/room/{roomId})
        registry.enableSimpleBroker("/sub");
        // 메시지 발행 요청 prefix (클라이언트가 메시지를 보낼 때: /pub/chat/message)
        registry.setApplicationDestinationPrefixes("/pub");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 웹소켓 연결 엔드포인트: ws://localhost:8080/ws-chat
        registry.addEndpoint("/ws-chat")
                .setAllowedOriginPatterns("*");
        // 프론트 SockJS 환경 지원이 필요하다면 뒤에 .withSockJS() 추가
    }
}