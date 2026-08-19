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
@Table(name = "room_member_invites", indexes = {
        @Index(name = "idx_room_member_invitee_status", columnList = "invitee_id, invite_status"),
        @Index(name = "idx_room_member_room_status", columnList = "room_id, invite_status")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoomMemberInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_member_invite_id")
    private Long roomMemberInviteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inviter_id", nullable = false)
    private User inviter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invitee_id", nullable = false)
    private User invitee;

    @Enumerated(EnumType.STRING)
    @Column(name = "invite_status", nullable = false, length = 20)
    private RoomMemberInviteStatus inviteStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Builder
    public RoomMemberInvite(ChatRoom room, User inviter, User invitee, LocalDateTime expiresAt) {
        this.room = room;
        this.inviter = inviter;
        this.invitee = invitee;
        this.inviteStatus = RoomMemberInviteStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.expiresAt = expiresAt == null ? this.createdAt.plusDays(7) : expiresAt;
    }

    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }

    public void accept() {
        requirePending();
        inviteStatus = RoomMemberInviteStatus.ACCEPTED;
        respondedAt = LocalDateTime.now();
    }

    public void reject() {
        requirePending();
        inviteStatus = RoomMemberInviteStatus.REJECTED;
        respondedAt = LocalDateTime.now();
    }

    public void expire() {
        if (inviteStatus == RoomMemberInviteStatus.PENDING) {
            inviteStatus = RoomMemberInviteStatus.EXPIRED;
            respondedAt = LocalDateTime.now();
        }
    }

    private void requirePending() {
        if (inviteStatus != RoomMemberInviteStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 채팅방 초대입니다.");
        }
        if (isExpired()) {
            expire();
            throw new IllegalStateException("만료된 채팅방 초대입니다.");
        }
    }
}
