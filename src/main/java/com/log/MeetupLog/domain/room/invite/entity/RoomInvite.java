package com.log.MeetupLog.domain.room.invite.entity;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "room_invites", indexes = {
        @Index(name = "idx_room_invite_room_status", columnList = "room_id, invite_status")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoomInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "invite_id")
    private Long inviteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "max_uses", nullable = false)
    private int maxUses;

    @Column(name = "used_count", nullable = false)
    private int usedCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "invite_status", nullable = false, length = 20)
    private RoomInviteStatus inviteStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Builder
    public RoomInvite(
            ChatRoom room,
            User createdBy,
            String tokenHash,
            LocalDateTime expiresAt,
            Integer maxUses
    ) {
        this.room = room;
        this.createdBy = createdBy;
        this.tokenHash = tokenHash;
        this.createdAt = LocalDateTime.now();
        this.expiresAt = expiresAt == null ? this.createdAt.plusHours(24) : expiresAt;
        this.maxUses = maxUses == null ? 50 : maxUses;
        this.usedCount = 0;
        this.inviteStatus = RoomInviteStatus.ACTIVE;
    }

    public boolean isUsable() {
        return inviteStatus == RoomInviteStatus.ACTIVE
                && expiresAt.isAfter(LocalDateTime.now())
                && usedCount < maxUses;
    }

    public void consume() {
        if (!isUsable()) {
            expireIfNecessary();
            throw new IllegalStateException("만료되었거나 사용할 수 없는 초대 링크입니다.");
        }
        usedCount += 1;
        if (usedCount >= maxUses) {
            inviteStatus = RoomInviteStatus.EXPIRED;
        }
    }

    public void revoke() {
        inviteStatus = RoomInviteStatus.REVOKED;
    }

    public void expireIfNecessary() {
        if (inviteStatus == RoomInviteStatus.ACTIVE
                && (expiresAt.isBefore(LocalDateTime.now()) || usedCount >= maxUses)) {
            inviteStatus = RoomInviteStatus.EXPIRED;
        }
    }
}
