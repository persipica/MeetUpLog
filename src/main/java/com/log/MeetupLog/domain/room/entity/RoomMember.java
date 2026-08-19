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
public class RoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_member_id")
    private Long roomMemberId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

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

    @CreatedDate
    @Column(name = "joined_at", updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @Column(name = "room_user_unique", length = 50)
    private String roomUserUnique; // 방ID_유저ID 조합 키 (예: "1_4")

    @Builder
    public RoomMember(Room room, User user, RoomRole roomRole, MemberStatus memberStatus, NotificationSetting notificationSetting) {
        this.room = room;
        this.user = user;
        this.roomRole = roomRole != null ? roomRole : RoomRole.MEMBER;
        this.memberStatus = memberStatus != null ? memberStatus : MemberStatus.ACTIVE;
        this.notificationSetting = notificationSetting != null ? notificationSetting : NotificationSetting.ALL;
        this.roomUserUnique = (room != null && user != null) ? (room.getRoomId() + "_" + user.getUserId()) : null;
    }

    // 방 퇴장 처리
    public void leave() {
        this.memberStatus = MemberStatus.LEFT;
        this.leftAt = LocalDateTime.now();
    }

    // 방장 위임 등 역할 변경
    public void changeRole(RoomRole newRole) {
        this.roomRole = newRole;
    }

    // 재입장 처리 (과거에 나갔던 방에 다시 들어오는 경우)
    public void rejoin() {
        this.memberStatus = MemberStatus.ACTIVE;
        this.leftAt = null;
    }

}