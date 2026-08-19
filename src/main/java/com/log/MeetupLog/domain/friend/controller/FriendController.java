package com.log.MeetupLog.domain.friend.controller;

import com.log.MeetupLog.domain.friend.dto.*;
import com.log.MeetupLog.domain.friend.service.FriendService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @GetMapping
    public List<FriendUserResponse> getFriends(@AuthenticationPrincipal Long userId) {
        return friendService.getFriends(userId);
    }

    @GetMapping("/search")
    public List<FriendUserResponse> search(
            @AuthenticationPrincipal Long userId,
            @RequestParam("query") String query
    ) {
        return friendService.search(userId, query);
    }

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public FriendRequestResponse request(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody FriendActionRequest request
    ) {
        return friendService.sendRequest(userId, request);
    }

    @GetMapping("/requests/received")
    public List<FriendRequestResponse> received(@AuthenticationPrincipal Long userId) {
        return friendService.getReceivedRequests(userId);
    }

    @GetMapping("/requests/sent")
    public List<FriendRequestResponse> sent(@AuthenticationPrincipal Long userId) {
        return friendService.getSentRequests(userId);
    }

    @PostMapping("/requests/{requestId}/accept")
    public FriendUserResponse accept(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long requestId
    ) {
        return friendService.accept(userId, requestId);
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<Void> reject(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long requestId
    ) {
        friendService.reject(userId, requestId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long friendId
    ) {
        friendService.remove(userId, friendId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{friendId}/block")
    public ResponseEntity<Void> block(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long friendId,
            @Valid @RequestBody FriendBlockRequest request
    ) {
        friendService.block(userId, friendId, request.getReason());
        return ResponseEntity.noContent().build();
    }
}
