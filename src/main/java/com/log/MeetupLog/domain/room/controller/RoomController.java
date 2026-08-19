package com.log.MeetupLog.domain.room.controller;

import com.log.MeetupLog.domain.room.dto.RoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.RoomDetailResponseDto;
import com.log.MeetupLog.domain.room.dto.RoomResponse;
import com.log.MeetupLog.domain.room.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    private Long extractUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new IllegalArgumentException("인증 정보가 없습니다. 토큰을 확인해주세요.");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof Long) {
            return (Long) principal;
        }
        return Long.parseLong(principal.toString());
    }

    // 1. 방 생성
    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(
            Authentication authentication,
            @Valid @RequestBody RoomCreateRequest request
    ) {
        Long userId = extractUserId(authentication);
        RoomResponse response = roomService.createRoom(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. 방 목록 조회
    @GetMapping
    public ResponseEntity<List<RoomResponse>> getActiveRooms() {
        return ResponseEntity.ok(roomService.getActiveRooms());
    }

    // 3. 방 상세 조회
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomDetailResponseDto> getRoomDetail(@PathVariable("roomId") Long roomId) {
        return ResponseEntity.ok(roomService.getRoomDetail(roomId));
    }

    // 4. 방 참여 신청
    @PostMapping("/{roomId}/join")
    public ResponseEntity<String> joinRoom(
            Authentication authentication,
            @PathVariable("roomId") Long roomId
    ) {
        Long userId = extractUserId(authentication);
        roomService.joinRoom(userId, roomId);
        return ResponseEntity.ok("방 참여가 완료되었습니다.");
    }

    // 5. 방 퇴장
    @PostMapping("/{roomId}/leave")
    public ResponseEntity<String> leaveRoom(
            Authentication authentication,
            @PathVariable("roomId") Long roomId
    ) {
        Long userId = extractUserId(authentication);
        roomService.leaveRoom(userId, roomId);
        return ResponseEntity.ok("방에서 성공적으로 퇴장하였습니다.");
    }
}