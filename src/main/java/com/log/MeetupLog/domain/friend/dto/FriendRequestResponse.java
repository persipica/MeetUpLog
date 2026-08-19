package com.log.MeetupLog.domain.friend.dto;

import com.log.MeetupLog.domain.friend.entity.FriendRequest;
import com.log.MeetupLog.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class FriendRequestResponse {
    private Long requestId;
    private Long userId;
    private String nickname;
    private String email;
    private String profileImageUrl;
    private String message;
    private String status;
    private LocalDateTime createdAt;

    public static FriendRequestResponse received(FriendRequest request) {
        return from(request, request.getRequester());
    }

    public static FriendRequestResponse sent(FriendRequest request) {
        return from(request, request.getReceiver());
    }

    private static FriendRequestResponse from(FriendRequest request, User counterpart) {
        return FriendRequestResponse.builder()
                .requestId(request.getFriendRequestId())
                .userId(counterpart.getUserId())
                .nickname(counterpart.getNickname())
                .email(counterpart.getEmail())
                .profileImageUrl(counterpart.getProfileImageUrl())
                .message(request.getRequestMessage())
                .status(request.getRequestStatus().name())
                .createdAt(request.getCreatedAt())
                .build();
    }
}
