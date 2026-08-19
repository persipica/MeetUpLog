package com.log.MeetupLog.domain.room.service;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.chat.service.ChatService;
import com.log.MeetupLog.domain.room.dto.ChatRoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.ChatRoomEventResponse;
import com.log.MeetupLog.domain.room.dto.ChatRoomMemberResponse;
import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.dto.ChatRoomUpdateRequest;
import com.log.MeetupLog.domain.room.dto.RoomNotificationRequest;
import com.log.MeetupLog.domain.room.dto.RoomNotificationResponse;
import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.DecisionCreateScope;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.NotificationSetting;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import com.log.MeetupLog.domain.room.entity.RoomType;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.domain.user.presence.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final ChatService chatService;
    private final SimpMessageSendingOperations messagingTemplate;
    private final PresenceService presenceService;

    @Transactional
    public ChatRoomResponse createRoom(Long userId, ChatRoomCreateRequest request) {
        User creator = requireUser(userId);
        if (creator.getAccountType() == AccountType.GUEST) {
            throw new SecurityException("게스트 계정은 채팅방을 만들 수 없습니다.");
        }

        ChatRoom room = ChatRoom.builder()
                .createdBy(creator)
                .roomName(request.getRoomName().trim())
                .roomType(RoomType.GROUP)
                .roomImageUrl(request.getRoomImageUrl())
                .description(request.getDescription())
                .topicType(request.getTopicType())
                .decisionCreateScope(DecisionCreateScope.ALL)
                .maxMembers(request.getMaxMembers())
                .roomStatus(RoomStatus.ACTIVE)
                .build();

        ChatRoom savedRoom = chatRoomRepository.save(room);
        ChatRoomMember ownerMember = ChatRoomMember.builder()
                .chatRoom(savedRoom)
                .user(creator)
                .roomRole(RoomRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .notificationSetting(NotificationSetting.ALL)
                .build();
        chatRoomMemberRepository.save(ownerMember);

        ChatMessageDto systemMessage = chatService.saveSystemMessage(
                savedRoom.getRoomId(),
                creator.getNickname() + "님이 채팅방을 만들었습니다.",
                "JOIN",
                creator.getUserId()
        );
        messagingTemplate.convertAndSend(
                "/sub/room/" + savedRoom.getRoomId(),
                systemMessage
        );

        return toResponse(savedRoom, 1, ownerMember, systemMessage.getContent());
    }

    public List<ChatRoomResponse> getMyActiveRooms(Long userId) {
        return chatRoomMemberRepository
                .findAllByUserIdAndStatus(userId, MemberStatus.ACTIVE)
                .stream()
                .filter(member -> member.getChatRoom().getRoomStatus() == RoomStatus.ACTIVE)
                .map(member -> {
                    ChatRoom room = member.getChatRoom();
                    int count = chatRoomMemberRepository.countByRoomIdAndStatus(
                            room.getRoomId(), MemberStatus.ACTIVE
                    );
                    return toResponse(room, count, member, lastMessage(room.getRoomId()));
                })
                .toList();
    }

    public ChatRoomResponse getRoom(Long userId, Long roomId) {
        ChatRoomMember member = requireActiveMember(roomId, userId);
        ChatRoom room = member.getChatRoom();
        int count = chatRoomMemberRepository.countByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        return toResponse(room, count, member, lastMessage(roomId));
    }

    public List<ChatRoomMemberResponse> getRoomMembers(Long userId, Long roomId) {
        requireActiveMember(roomId, userId);
        return chatRoomMemberRepository
                .findAllByRoomIdAndStatus(roomId, MemberStatus.ACTIVE)
                .stream()
                .map(member -> ChatRoomMemberResponse.from(
                        member,
                        presenceService.currentStatus(member.getUser().getUserId()).name()
                ))
                .toList();
    }

    @Transactional
    public void joinRoom(Long userId, Long roomId) {
        join(userId, roomId);
    }

    @Transactional
    public void joinRoomFromInvitation(Long userId, Long roomId) {
        join(userId, roomId);
    }

    @Transactional
    public ChatRoomResponse updateRoom(Long userId, Long roomId, ChatRoomUpdateRequest request) {
        ChatRoomMember owner = requireOwner(roomId, userId);
        ChatRoom room = owner.getChatRoom();
        room.rename(request.getRoomName());

        publishRoomEvent("ROOM_UPDATED", room, owner.getUser());
        int count = chatRoomMemberRepository.countByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        return toResponse(room, count, owner, lastMessage(roomId));
    }

    @Transactional
    public void deleteRoom(Long userId, Long roomId) {
        ChatRoomMember owner = requireOwner(roomId, userId);
        ChatRoom room = owner.getChatRoom();

        chatRoomMemberRepository.findAllByRoomIdAndStatus(roomId, MemberStatus.ACTIVE)
                .forEach(ChatRoomMember::leaveBecauseRoomDeleted);
        room.deleteRoom();
        chatRoomMemberRepository.flush();
        chatRoomRepository.flush();
        publishRoomEvent("ROOM_DELETED", room, owner.getUser());
    }

    @Transactional
    public void leaveRoom(Long userId, Long roomId) {
        ChatRoomMember member = requireActiveMember(roomId, userId);
        if (member.getRoomRole() == RoomRole.OWNER) {
            throw new IllegalStateException("방장은 채팅방을 나갈 수 없습니다. 채팅방 삭제를 이용해 주세요.");
        }

        member.leave();
        ChatMessageDto systemMessage = chatService.saveSystemMessage(
                roomId,
                member.getUser().getNickname() + "님이 퇴장했습니다.",
                "LEAVE",
                userId
        );
        messagingTemplate.convertAndSend("/sub/room/" + roomId, systemMessage);
        publishRoomEvent("MEMBER_LEFT", member.getChatRoom(), member.getUser());
    }

    public RoomNotificationResponse getNotificationSetting(Long userId, Long roomId) {
        return RoomNotificationResponse.from(requireActiveMember(roomId, userId));
    }

    @Transactional
    public RoomNotificationResponse updateNotificationSetting(
            Long userId,
            Long roomId,
            RoomNotificationRequest request
    ) {
        ChatRoomMember member = requireActiveMember(roomId, userId);
        String mode = request.getMode().trim().toUpperCase();

        switch (mode) {
            case "ENABLED" -> member.enableNotifications();
            case "MUTE_30_MINUTES" -> member.muteNotificationsUntil(LocalDateTime.now().plusMinutes(30));
            case "MUTE_1_HOUR" -> member.muteNotificationsUntil(LocalDateTime.now().plusHours(1));
            case "MUTE_2_HOURS" -> member.muteNotificationsUntil(LocalDateTime.now().plusHours(2));
            case "MUTE_UNTIL_ENABLED" -> member.muteNotificationsIndefinitely();
            default -> throw new IllegalArgumentException("지원하지 않는 알림 설정입니다.");
        }

        return RoomNotificationResponse.from(member);
    }

    private void join(Long userId, Long roomId) {
        User user = requireUser(userId);
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));

        if (room.getRoomStatus() != RoomStatus.ACTIVE) {
            throw new IllegalStateException("입장할 수 없는 방입니다.");
        }
        if (chatRoomMemberRepository.existsByRoomIdAndUserIdAndStatus(
                roomId, userId, MemberStatus.ACTIVE
        )) {
            throw new IllegalStateException("이미 참여 중인 방입니다.");
        }

        int currentMembers = chatRoomMemberRepository.countByRoomIdAndStatus(
                roomId, MemberStatus.ACTIVE
        );
        if (currentMembers >= room.getMaxMembers()) {
            throw new IllegalStateException("정원이 마감되었습니다.");
        }

        ChatRoomMember existing = chatRoomMemberRepository
                .findByRoomIdAndUserId(roomId, userId)
                .orElse(null);
        if (existing != null && (existing.getMemberStatus() == MemberStatus.KICKED
                || existing.getMemberStatus() == MemberStatus.BLOCKED)) {
            throw new IllegalStateException("강퇴 또는 차단된 사용자는 다시 입장할 수 없습니다.");
        }

        ChatRoomMember member = chatRoomMemberRepository
                .findByRoomIdAndUserId(roomId, userId)
                .orElseGet(() -> ChatRoomMember.builder()
                        .chatRoom(room)
                        .user(user)
                        .roomRole(RoomRole.MEMBER)
                        .memberStatus(MemberStatus.ACTIVE)
                        .notificationSetting(NotificationSetting.ALL)
                        .build());
        member.rejoin();
        chatRoomMemberRepository.save(member);

        ChatMessageDto systemMessage = chatService.saveSystemMessage(
                roomId,
                user.getNickname() + "님이 입장했습니다.",
                "JOIN",
                userId
        );
        messagingTemplate.convertAndSend("/sub/room/" + roomId, systemMessage);
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
    }

    private ChatRoomMember requireActiveMember(Long roomId, Long userId) {
        ChatRoomMember member = chatRoomMemberRepository
                .findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new IllegalStateException("채팅방 참여자가 아닙니다."));
        if (member.getMemberStatus() != MemberStatus.ACTIVE) {
            throw new IllegalStateException("현재 참여 중인 채팅방이 아닙니다.");
        }
        return member;
    }

    private ChatRoomMember requireOwner(Long roomId, Long userId) {
        ChatRoomMember member = requireActiveMember(roomId, userId);
        if (member.getRoomRole() != RoomRole.OWNER) {
            throw new SecurityException("방장만 채팅방을 설정할 수 있습니다.");
        }
        return member;
    }

    private void publishRoomEvent(String eventType, ChatRoom room, User actor) {
        messagingTemplate.convertAndSend(
                "/sub/room/" + room.getRoomId() + "/events",
                ChatRoomEventResponse.builder()
                        .eventType(eventType)
                        .roomId(room.getRoomId())
                        .roomName(room.getRoomName())
                        .actorId(actor.getUserId())
                        .actorNickname(actor.getNickname())
                        .occurredAt(LocalDateTime.now())
                        .build()
        );
    }

    private String lastMessage(Long roomId) {
        return chatMessageRepository.findTopByRoomIdOrderBySentAtDesc(roomId)
                .map(ChatMessage::getContent)
                .orElse("새 대화를 시작해보세요.");
    }

    private ChatRoomResponse toResponse(
            ChatRoom room,
            int currentMembers,
            ChatRoomMember member,
            String lastMessage
    ) {
        return ChatRoomResponse.from(room, currentMembers, member, lastMessage);
    }
}
