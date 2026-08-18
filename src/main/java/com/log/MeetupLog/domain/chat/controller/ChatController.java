package com.log.MeetupLog.domain.chat.controller;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessageSendingOperations messagingTemplate;
    private final ChatService chatService;

    // 실시간 메시지 송수신 & DB 저장
    @MessageMapping("/chat/message")
    public void message(ChatMessageDto message) {
        // ChatMessage.MessageType.SYSTEM 검사
        if (ChatMessage.MessageType.SYSTEM.equals(message.getMessageType())) {
            message.setContent(message.getSenderNickname() + "님이 입장하셨습니다.");
        }

        // DB 저장
        chatService.saveMessage(message);

        // 방 구독자들에게 실시간 브로드캐스팅
        messagingTemplate.convertAndSend("/sub/room/" + message.getRoomId(), message);
    }

    // 이전 대화 내역 조회 API
    @GetMapping("/api/v1/rooms/{roomId}/messages")
    @ResponseBody
    public ResponseEntity<List<ChatMessageDto>> getRoomMessages(@PathVariable("roomId") Long roomId) {
        List<ChatMessageDto> messages = chatService.getMessagesByRoomId(roomId);
        return ResponseEntity.ok(messages);
    }
}