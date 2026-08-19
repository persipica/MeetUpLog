package com.log.MeetupLog.global.websocket;

import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ChatWebSocketAuthorizationInterceptor implements ChannelInterceptor {

    private static final Pattern ROOM_DESTINATION =
            Pattern.compile("^/sub/room/(\\d+)(?:/(?:typing|reactions|read|events))?$");

    private final ChatRoomMemberRepository memberRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (accessor.getCommand() != StompCommand.SUBSCRIBE) return message;

        String destination = accessor.getDestination();
        if ("/sub/presence".equals(destination)) {
            if (accessor.getUser() == null) {
                throw new IllegalStateException("WebSocket 인증이 필요합니다.");
            }
            return message;
        }

        Matcher matcher = ROOM_DESTINATION.matcher(destination == null ? "" : destination);
        if (!matcher.matches()) {
            throw new IllegalStateException("허용되지 않은 구독 경로입니다.");
        }

        Principal principal = accessor.getUser();
        if (principal == null) throw new IllegalStateException("WebSocket 인증이 필요합니다.");

        Long userId;
        try {
            userId = Long.valueOf(principal.getName());
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("WebSocket 사용자 식별자가 올바르지 않습니다.");
        }

        Long roomId = Long.valueOf(matcher.group(1));
        boolean member = memberRepository.existsByRoomIdAndUserIdAndStatus(
                roomId, userId, MemberStatus.ACTIVE
        );
        if (!member) throw new IllegalStateException("참여 중인 채팅방만 구독할 수 있습니다.");
        return message;
    }
}
