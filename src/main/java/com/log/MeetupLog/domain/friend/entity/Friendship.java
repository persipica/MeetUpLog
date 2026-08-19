package com.log.MeetupLog.domain.friend.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "friendships", uniqueConstraints = {
        @UniqueConstraint(name = "uk_friendship_pair", columnNames = {"user_low_id", "user_high_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "friendship_id")
    private Long friendshipId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_low_id", nullable = false)
    private User userLow;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_high_id", nullable = false)
    private User userHigh;

    @Enumerated(EnumType.STRING)
    @Column(name = "friendship_status", nullable = false, length = 20)
    private FriendshipStatus friendshipStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_by")
    private User blockedBy;

    @Column(name = "block_reason", length = 200)
    private String blockReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Friendship(User userLow, User userHigh) {
        this.userLow = userLow;
        this.userHigh = userHigh;
        this.friendshipStatus = FriendshipStatus.ACTIVE;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public void activate() {
        friendshipStatus = FriendshipStatus.ACTIVE;
        blockedBy = null;
        blockReason = null;
        updatedAt = LocalDateTime.now();
    }

    public void block(User actor, String reason) {
        friendshipStatus = FriendshipStatus.BLOCKED;
        blockedBy = actor;
        blockReason = reason == null || reason.isBlank() ? null : reason.trim();
        updatedAt = LocalDateTime.now();
    }

    public User otherUser(Long userId) {
        return userLow.getUserId().equals(userId) ? userHigh : userLow;
    }
}
