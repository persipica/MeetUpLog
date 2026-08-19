package com.log.MeetupLog.domain.friend.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "friend_requests", indexes = {
        @Index(name = "idx_friend_request_receiver_status", columnList = "receiver_id, request_status"),
        @Index(name = "idx_friend_request_requester_status", columnList = "requester_id, request_status")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FriendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "friend_request_id")
    private Long friendRequestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_status", nullable = false, length = 20)
    private FriendRequestStatus requestStatus;

    @Column(name = "request_message", length = 200)
    private String requestMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Builder
    public FriendRequest(User requester, User receiver, String requestMessage) {
        this.requester = requester;
        this.receiver = receiver;
        this.requestMessage = requestMessage == null ? null : requestMessage.trim();
        this.requestStatus = FriendRequestStatus.PENDING;
        this.createdAt = LocalDateTime.now();
    }

    public void accept() {
        requirePending();
        requestStatus = FriendRequestStatus.ACCEPTED;
        respondedAt = LocalDateTime.now();
    }

    public void reject() {
        requirePending();
        requestStatus = FriendRequestStatus.REJECTED;
        respondedAt = LocalDateTime.now();
    }

    public void cancel() {
        requirePending();
        requestStatus = FriendRequestStatus.CANCELED;
        respondedAt = LocalDateTime.now();
    }

    private void requirePending() {
        if (requestStatus != FriendRequestStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 친구 요청입니다.");
        }
    }
}
