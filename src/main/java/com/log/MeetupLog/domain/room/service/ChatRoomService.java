package com.log.MeetupLog.domain.room.service;

import com.log.MeetupLog.domain.room.dto.ChatRoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.entity.*;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final UserRepository userRepository;

    // 1. 방 개설 (방장은 OWNER 역할로 chat_room_members에 자동 등록)
    @Transactional
    public ChatRoomResponse createRoom(Long userId, ChatRoomCreateRequest request) {
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        ChatRoom room = ChatRoom.builder()
                .createdBy(creator)
                .roomName(request.getRoomName())
                .roomType(RoomType.GROUP)
                .roomImageUrl(request.getRoomImageUrl())
                .description(request.getDescription())
                .decisionCreateScope(DecisionCreateScope.ALL)
                .maxMembers(request.getMaxMembers())
                .roomStatus(RoomStatus.ACTIVE)
                .build();

        ChatRoom savedRoom = chatRoomRepository.save(room);

        // 방 개설자를 첫 번째 멤버(OWNER)로 등록
        ChatRoomMember ownerMember = ChatRoomMember.builder()
                .chatRoom(savedRoom)
                .user(creator)
                .roomRole(RoomRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .notificationSetting(NotificationSetting.ALL)
                .build();
        chatRoomMemberRepository.save(ownerMember);

        return ChatRoomResponse.from(savedRoom, 1);
    }

    // 2. 활성화된 모임방 목록 조회
    public List<ChatRoomResponse> getActiveRooms() {
        return chatRoomRepository.findAllByRoomStatusOrderByCreatedAtDesc(RoomStatus.ACTIVE).stream()
                .map(room -> {
                    int memberCount = chatRoomMemberRepository.countByRoomIdAndStatus(room.getRoomId(), MemberStatus.ACTIVE);
                    return ChatRoomResponse.from(room, memberCount);
                })
                .collect(Collectors.toList());
    }

    // 3. 모임방 단건 상세 조회
    public ChatRoomResponse getRoom(Long roomId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));
        int memberCount = chatRoomMemberRepository.countByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        return ChatRoomResponse.from(room, memberCount);
    }

    // 4. 모임방 참여하기
    @Transactional
    public void joinRoom(Long userId, Long roomId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));

        if (room.getRoomStatus() != RoomStatus.ACTIVE) {
            throw new IllegalStateException("입장할 수 없는 방입니다.");
        }

        if (chatRoomMemberRepository.existsByRoomIdAndUserIdAndStatus(roomId, userId, MemberStatus.ACTIVE)) {
            throw new IllegalStateException("이미 참여 중인 방입니다.");
        }

        int currentMembers = chatRoomMemberRepository.countByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        if (currentMembers >= room.getMaxMembers()) {
            throw new IllegalStateException("정원이 마감되었습니다.");
        }

        ChatRoomMember member = chatRoomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElse(ChatRoomMember.builder()
                        .chatRoom(room)
                        .user(user)
                        .roomRole(RoomRole.MEMBER)
                        .memberStatus(MemberStatus.ACTIVE)
                        .notificationSetting(NotificationSetting.ALL)
                        .build());

        chatRoomMemberRepository.save(member);
    }
}