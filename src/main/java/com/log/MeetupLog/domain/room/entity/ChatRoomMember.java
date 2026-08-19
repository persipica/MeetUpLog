package com.log.MeetupLog.domain.room.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_room_members", uniqueConstraints = {
        @UniqueConstraint(name = "room_user_unique", columnNames = {"room_id", "user_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class ChatRoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_member_id")
    private Long roomMemberId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_role", nullable = false, length = 20)
    private RoomRole roomRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_status", nullable = false, length = 20)
    private MemberStatus memberStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_setting", nullable = false, length = 20)
    private NotificationSetting notificationSetting;

    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Column(name = "notification_muted_until")
    private LocalDateTime notificationMutedUntil;

    @CreatedDate
    @Column(name = "joined_at", updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @Column(name = "room_user_unique", length = 50)
    private String roomUserUnique; // 방ID_유저ID 조합 키 (예: "1_4")

    @Builder
    public ChatRoomMember(ChatRoom chatRoom, User user, RoomRole roomRole, MemberStatus memberStatus, NotificationSetting notificationSetting) {
        this.chatRoom = chatRoom;
        this.user = user;
        this.roomRole = roomRole != null ? roomRole : RoomRole.MEMBER;
        this.memberStatus = memberStatus != null ? memberStatus : MemberStatus.ACTIVE;
        this.notificationSetting = notificationSetting != null ? notificationSetting : NotificationSetting.ALL;
        this.roomUserUnique = (chatRoom != null && user != null) ? (chatRoom.getRoomId() + "_" + user.getUserId()) : null;
    }

    public void rejoin() {
        this.memberStatus = MemberStatus.ACTIVE;
        this.leftAt = null;
        if (this.roomRole == null) {
            this.roomRole = RoomRole.MEMBER;
        }
    }

    public void markRead(Long messageId) {
        if (messageId == null) {
            return;
        }
        if (this.lastReadMessageId == null || messageId > this.lastReadMessageId) {
            this.lastReadMessageId = messageId;
        }
    }

    public void leave() {
        this.memberStatus = MemberStatus.LEFT;
        this.leftAt = LocalDateTime.now();
    }

    /**
     * 방 자체가 삭제될 때는 모든 참여자를 비활성화하고 방장 역할도 함께 제거합니다.
     * 일반 퇴장과 분리해 후속 로직이 다른 참여자를 새 방장으로 승격하지 못하게 합니다.
     */
    public void leaveBecauseRoomDeleted() {
        this.memberStatus = MemberStatus.LEFT;
        this.roomRole = RoomRole.MEMBER;
        this.leftAt = LocalDateTime.now();
        this.notificationSetting = NotificationSetting.OFF;
        this.notificationMutedUntil = null;
    }

    public void enableNotifications() {
        this.notificationSetting = NotificationSetting.ALL;
        this.notificationMutedUntil = null;
    }

    public void muteNotificationsUntil(LocalDateTime mutedUntil) {
        this.notificationSetting = NotificationSetting.ALL;
        this.notificationMutedUntil = mutedUntil;
    }

    public void muteNotificationsIndefinitely() {
        this.notificationSetting = NotificationSetting.OFF;
        this.notificationMutedUntil = null;
    }

    public boolean isNotificationsMuted() {
        return this.notificationSetting == NotificationSetting.OFF
                || (this.notificationMutedUntil != null
                && this.notificationMutedUntil.isAfter(LocalDateTime.now()));
    }
}
