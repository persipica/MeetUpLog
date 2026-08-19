package com.log.MeetupLog.domain.room.invite.controller;

import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.invite.dto.*;
import com.log.MeetupLog.domain.room.invite.service.RoomInviteLinkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class RoomInviteLinkController {

    private final RoomInviteLinkService inviteLinkService;

    @PostMapping("/api/v1/rooms/{roomId}/invite-links")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomInviteLinkResponse create(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId,
            @Valid @RequestBody CreateRoomInviteLinkRequest request
    ) {
        return inviteLinkService.create(userId, roomId, request);
    }

    @GetMapping("/api/v1/rooms/{roomId}/invite-links/active")
    public ResponseEntity<RoomInviteLinkResponse> active(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        RoomInviteLinkResponse response = inviteLinkService.getActive(userId, roomId);
        return response == null
                ? ResponseEntity.noContent().build()
                : ResponseEntity.ok(response);
    }

    @DeleteMapping("/api/v1/rooms/{roomId}/invite-links/{inviteId}")
    public ResponseEntity<Void> revoke(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId,
            @PathVariable Long inviteId
    ) {
        inviteLinkService.revoke(userId, roomId, inviteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/invites/{token}")
    public PublicRoomInviteResponse info(@PathVariable String token) {
        return inviteLinkService.getPublicInfo(token);
    }

    @PostMapping("/api/v1/invites/{token}/join")
    public ChatRoomResponse join(
            @AuthenticationPrincipal Long userId,
            @PathVariable String token
    ) {
        return inviteLinkService.joinAuthenticated(userId, token);
    }

    @PostMapping("/api/v1/invites/{token}/guest")
    public GuestInviteLoginResponse guest(
            @PathVariable String token,
            @Valid @RequestBody GuestInviteLoginRequest request
    ) {
        return inviteLinkService.joinGuest(token, request.getNickname());
    }
}
