package com.log.MeetupLog.domain.room.controller;

import com.log.MeetupLog.domain.room.dto.ChatRoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.dto.ChatRoomMemberResponse;
import com.log.MeetupLog.domain.room.dto.ChatRoomUpdateRequest;
import com.log.MeetupLog.domain.room.dto.RoomNotificationRequest;
import com.log.MeetupLog.domain.room.dto.RoomNotificationResponse;
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
    public ResponseEntity<List<ChatRoomResponse>> getActiveRooms(
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(chatRoomService.getMyActiveRooms(userId));
    }

    // 3. 방 상세 조회
    @GetMapping("/{roomId}")
    public ResponseEntity<ChatRoomResponse> getRoom(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        return ResponseEntity.ok(chatRoomService.getRoom(userId, roomId));
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<List<ChatRoomMemberResponse>> getRoomMembers(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        return ResponseEntity.ok(chatRoomService.getRoomMembers(userId, roomId));
    }

    @PatchMapping("/{roomId}")
    public ResponseEntity<ChatRoomResponse> updateRoom(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId,
            @Valid @RequestBody ChatRoomUpdateRequest request
    ) {
        return ResponseEntity.ok(chatRoomService.updateRoom(userId, roomId, request));
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        chatRoomService.deleteRoom(userId, roomId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roomId}/leave")
    public ResponseEntity<Void> leaveRoom(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        chatRoomService.leaveRoom(userId, roomId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{roomId}/notification-setting")
    public ResponseEntity<RoomNotificationResponse> getNotificationSetting(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        return ResponseEntity.ok(chatRoomService.getNotificationSetting(userId, roomId));
    }

    @PutMapping("/{roomId}/notification-setting")
    public ResponseEntity<RoomNotificationResponse> updateNotificationSetting(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId,
            @Valid @RequestBody RoomNotificationRequest request
    ) {
        return ResponseEntity.ok(
                chatRoomService.updateNotificationSetting(userId, roomId, request)
        );
    }

    // 방 입장은 친구 초대 수락 또는 유효한 게스트 링크를 통해서만 처리합니다.
}
