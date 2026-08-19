package com.log.MeetupLog.domain.chat.controller;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.dto.ChatMessageEditRequest;
import com.log.MeetupLog.domain.chat.dto.ChatReadReceiptDto;
import com.log.MeetupLog.domain.chat.dto.ChatReactionDto;
import com.log.MeetupLog.domain.chat.dto.ChatTypingDto;
import com.log.MeetupLog.domain.chat.service.ChatReactionService;
import com.log.MeetupLog.domain.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;
import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessageSendingOperations messagingTemplate;
    private final ChatService chatService;
    private final ChatReactionService chatReactionService;

    // 실시간 메시지 송수신 & DB 저장
    @MessageMapping("/chat/message")
    public void message(ChatMessageDto message, Principal principal) {
        Long userId = requireUserId(principal);
        ChatMessageDto savedMessage = chatService.saveUserMessage(userId, message);
        messagingTemplate.convertAndSend(
                "/sub/room/" + savedMessage.getRoomId(),
                savedMessage
        );
    }

    @MessageMapping("/chat/typing")
    public void typing(ChatTypingDto request, Principal principal) {
        Long userId = requireUserId(principal);
        ChatTypingDto event = chatService.createTypingEvent(userId, request);
        messagingTemplate.convertAndSend(
                "/sub/room/" + event.getRoomId() + "/typing",
                event
        );
    }

    @MessageMapping("/chat/reaction")
    public void reaction(ChatReactionDto request, Principal principal) {
        Long userId = requireUserId(principal);
        ChatReactionDto event = chatReactionService.toggle(userId, request);
        messagingTemplate.convertAndSend(
                "/sub/room/" + event.getRoomId() + "/reactions",
                event
        );
    }

    @MessageMapping("/chat/read")
    public void read(ChatReadReceiptDto request, Principal principal) {
        Long userId = requireUserId(principal);
        ChatReadReceiptDto event = chatService.markMessagesRead(userId, request);
        messagingTemplate.convertAndSend(
                "/sub/room/" + event.getRoomId() + "/read",
                event
        );
    }

    // 이전 대화 내역 조회 API
    @GetMapping("/api/v1/rooms/{roomId}/messages")
    @ResponseBody
    public ResponseEntity<List<ChatMessageDto>> getRoomMessages(
            @AuthenticationPrincipal Long userId,
            @PathVariable("roomId") Long roomId
    ) {
        List<ChatMessageDto> messages = chatService.getMessagesByRoomId(userId, roomId);
        return ResponseEntity.ok(messages);
    }

    @PatchMapping("/api/v1/rooms/{roomId}/messages/{messageId}")
    @ResponseBody
    public ResponseEntity<ChatMessageDto> editMessage(
            @AuthenticationPrincipal Long userId,
            @PathVariable("roomId") Long roomId,
            @PathVariable("messageId") Long messageId,
            @RequestBody ChatMessageEditRequest request
    ) {
        ChatMessageDto message = chatService.editUserMessage(
                userId,
                roomId,
                messageId,
                request.getContent()
        );
        messagingTemplate.convertAndSend("/sub/room/" + roomId, message);
        return ResponseEntity.ok(message);
    }

    @DeleteMapping("/api/v1/rooms/{roomId}/messages/{messageId}")
    @ResponseBody
    public ResponseEntity<ChatMessageDto> deleteMessage(
            @AuthenticationPrincipal Long userId,
            @PathVariable("roomId") Long roomId,
            @PathVariable("messageId") Long messageId
    ) {
        ChatMessageDto message = chatService.deleteUserMessage(userId, roomId, messageId);
        messagingTemplate.convertAndSend("/sub/room/" + roomId, message);
        return ResponseEntity.ok(message);
    }

    private Long requireUserId(Principal principal) {
        if (principal == null || principal.getName() == null) {
            throw new IllegalStateException("인증된 WebSocket 사용자만 메시지를 보낼 수 있습니다.");
        }

        try {
            return Long.valueOf(principal.getName());
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("WebSocket 사용자 식별자가 올바르지 않습니다.");
        }
    }
}
