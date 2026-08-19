package com.log.MeetupLog.domain.friend.dto;

import com.log.MeetupLog.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendUserResponse {
    private Long userId;
    private String email;
    private String nickname;
    private String profileImageUrl;
    private String statusMessage;
    private String relationship;
    private String presence;

    public static FriendUserResponse from(User user, String relationship) {
        return from(user, relationship, "OFFLINE");
    }

    public static FriendUserResponse from(User user, String relationship, String presence) {
        return FriendUserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .profileImageUrl(user.getProfileImageUrl())
                .statusMessage(user.getStatusMessage())
                .relationship(relationship)
                .presence(presence)
                .build();
    }
}
