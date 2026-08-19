package com.log.MeetupLog.domain.room.invite.controller;

import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.invite.dto.RoomMemberInviteRequest;
import com.log.MeetupLog.domain.room.invite.dto.RoomMemberInviteResponse;
import com.log.MeetupLog.domain.room.invite.service.RoomMemberInviteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class RoomMemberInviteController {

    private final RoomMemberInviteService inviteService;

    @PostMapping("/api/v1/rooms/{roomId}/member-invites")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomMemberInviteResponse send(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId,
            @Valid @RequestBody RoomMemberInviteRequest request
    ) {
        return inviteService.send(userId, roomId, request.getInviteeUserId());
    }

    @GetMapping("/api/v1/rooms/{roomId}/member-invites/sent")
    public List<RoomMemberInviteResponse> sent(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        return inviteService.sent(userId, roomId);
    }

    @GetMapping("/api/v1/room-member-invites/received")
    public List<RoomMemberInviteResponse> received(@AuthenticationPrincipal Long userId) {
        return inviteService.received(userId);
    }

    @PostMapping("/api/v1/room-member-invites/{inviteId}/accept")
    public ChatRoomResponse accept(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long inviteId
    ) {
        return inviteService.accept(userId, inviteId);
    }

    @PostMapping("/api/v1/room-member-invites/{inviteId}/reject")
    public ResponseEntity<Void> reject(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long inviteId
    ) {
        inviteService.reject(userId, inviteId);
        return ResponseEntity.noContent().build();
    }
}
