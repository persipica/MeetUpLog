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
}