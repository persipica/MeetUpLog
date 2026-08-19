package com.log.MeetupLog.domain.room.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chat_rooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id")
    private Long roomId;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 20)
    private RoomType roomType;

    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;

    @Column(name = "room_image_url", length = 500)
    private String roomImageUrl;

    @Column(name = "description", length = 300)
    private String description;

    @Column(name = "topic_type", nullable = false, length = 30)
    private String topicType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision_create_scope", nullable = false, length = 20)
    private DecisionCreateScope decisionCreateScope;

    @Column(name = "max_members", nullable = false)
    private int maxMembers;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_status", nullable = false, length = 20)
    private RoomStatus roomStatus;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatRoomMember> members = new ArrayList<>();

    @Builder
    public ChatRoom(RoomType roomType, String roomName, String roomImageUrl, String description, String topicType,
                    User createdBy, DecisionCreateScope decisionCreateScope, Integer maxMembers, RoomStatus roomStatus) {
        this.roomType = roomType != null ? roomType : RoomType.GROUP;
        this.roomName = roomName;
        this.roomImageUrl = roomImageUrl;
        this.description = description;
        this.topicType = topicType == null || topicType.isBlank() ? "ETC" : topicType;
        this.createdBy = createdBy;
        this.decisionCreateScope = decisionCreateScope != null ? decisionCreateScope : DecisionCreateScope.ALL;
        this.maxMembers = maxMembers != null ? maxMembers : 9;
        this.roomStatus = roomStatus != null ? roomStatus : RoomStatus.ACTIVE;
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public void rename(String roomName) {
        if (roomName == null || roomName.isBlank()) {
            throw new IllegalArgumentException("채팅방 이름을 입력해 주세요.");
        }
        this.roomName = roomName.trim();
    }

    public void deleteRoom() {
        this.roomStatus = RoomStatus.DELETED;
    }
}
