package com.log.MeetupLog.domain.room.controller;

import com.log.MeetupLog.domain.room.dto.ChatRoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.service.ChatRoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomService chatRoomService;

    // 1. 방 생성 (로그인한 유저)
    @PostMapping
    public ResponseEntity<ChatRoomResponse> createRoom(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ChatRoomCreateRequest request
    ) {
        ChatRoomResponse response = chatRoomService.createRoom(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. 방 목록 조회
    @GetMapping
    public ResponseEntity<List<ChatRoomResponse>> getActiveRooms() {
        return ResponseEntity.ok(chatRoomService.getActiveRooms());
    }

    // 3. 방 상세 조회
    @GetMapping("/{roomId}")
    public ResponseEntity<ChatRoomResponse> getRoom(@PathVariable Long roomId) {
        return ResponseEntity.ok(chatRoomService.getRoom(roomId));
    }

    // 4. 방 참여 신청
    @PostMapping("/{roomId}/join")
    public ResponseEntity<String> joinRoom(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        chatRoomService.joinRoom(userId, roomId);
        return ResponseEntity.ok("방 참여가 완료되었습니다.");
    }
}