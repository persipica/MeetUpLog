package com.log.MeetupLog.domain.room.service;

import com.log.MeetupLog.domain.chat.service.ChatService;
import com.log.MeetupLog.domain.room.dto.RoomCreateRequest;
import com.log.MeetupLog.domain.room.dto.RoomDetailResponseDto;
import com.log.MeetupLog.domain.room.dto.RoomResponse;
import com.log.MeetupLog.domain.room.entity.*;
import com.log.MeetupLog.domain.room.repository.RoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.RoomRepository;
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
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final UserRepository userRepository;
    private final ChatService chatService;

    // 1. 방 개설 (방장은 OWNER 역할로 chat_room_members에 자동 등록)
    @Transactional
    public RoomResponse createRoom(Long userId, RoomCreateRequest request) {
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        Room room = Room.builder()
                .createdBy(creator)
                .roomName(request.getRoomName())
                .roomType(RoomType.GROUP)
                .roomImageUrl(request.getRoomImageUrl())
                .description(request.getDescription())
                .decisionCreateScope(DecisionCreateScope.ALL)
                .maxMembers(request.getMaxMembers() != null ? request.getMaxMembers() : 9)
                .roomStatus(RoomStatus.ACTIVE)
                .build();

        Room savedRoom = roomRepository.save(room);

        // 방 개설자를 첫 번째 멤버(OWNER)로 등록
        RoomMember ownerMember = RoomMember.builder()
                .room(savedRoom)
                .user(creator)
                .roomRole(RoomRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .notificationSetting(NotificationSetting.ALL)
                .build();
        roomMemberRepository.save(ownerMember);

        return RoomResponse.from(savedRoom, 1);
    }

    // 2. 활성화된 모임방 목록 조회
    public List<RoomResponse> getActiveRooms() {
        return roomRepository.findAllByRoomStatusOrderByCreatedAtDesc(RoomStatus.ACTIVE).stream()
                .map(room -> {
                    long memberCount = roomMemberRepository.countByRoomIdAndMemberStatus(room.getRoomId(), MemberStatus.ACTIVE);
                    return RoomResponse.from(room, (int) memberCount);
                })
                .collect(Collectors.toList());
    }

    // 3. 모임방 상세 조회 (참여자 목록 포함)
    public RoomDetailResponseDto getRoomDetail(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));

        List<RoomMember> activeMembers = roomMemberRepository.findByRoomIdAndMemberStatus(roomId, MemberStatus.ACTIVE);

        List<RoomDetailResponseDto.MemberSummaryDto> memberSummaries = activeMembers.stream()
                .map(m -> RoomDetailResponseDto.MemberSummaryDto.builder()
                        .userId(m.getUser().getUserId())
                        .nickname(m.getUser().getNickname())
                        .roomRole(m.getRoomRole().name())
                        .joinedAt(m.getJoinedAt())
                        .build())
                .collect(Collectors.toList());

        return RoomDetailResponseDto.builder()
                .roomId(room.getRoomId())
                .roomName(room.getRoomName())
                .description(room.getDescription())
                .roomImageUrl(room.getRoomImageUrl())
                .currentMembers(activeMembers.size())
                .maxMembers(room.getMaxMembers())
                .createdById(room.getCreatedBy().getUserId())
                .createdByNickname(room.getCreatedBy().getNickname())
                .createdAt(room.getCreatedAt())
                .members(memberSummaries)
                .build();
    }

    // 4. 모임방 참여하기
    @Transactional
    public void joinRoom(Long userId, Long roomId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));

        if (room.getRoomStatus() != RoomStatus.ACTIVE) {
            throw new IllegalStateException("입장할 수 없는 방입니다.");
        }

        // 이미 활성 참여 중인지 확인
        boolean isAlreadyActive = roomMemberRepository.findByRoomIdAndUserIdAndMemberStatus(roomId, userId, MemberStatus.ACTIVE).isPresent();
        if (isAlreadyActive) {
            throw new IllegalStateException("이미 참여 중인 방입니다.");
        }

        // 정원 초과 검증
        long currentMembers = roomMemberRepository.countByRoomIdAndMemberStatus(roomId, MemberStatus.ACTIVE);
        if (currentMembers >= room.getMaxMembers()) {
            throw new IllegalStateException("정원이 마감되었습니다.");
        }

        // 과거 참여 이력이 있으면 재입장(rejoin), 없으면 새로 생성
        RoomMember member = roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .map(m -> {
                    m.rejoin();
                    return m;
                })
                .orElseGet(() -> RoomMember.builder()
                        .room(room)
                        .user(user)
                        .roomRole(RoomRole.MEMBER)
                        .memberStatus(MemberStatus.ACTIVE)
                        .notificationSetting(NotificationSetting.ALL)
                        .build());

        roomMemberRepository.save(member);

        // ChatService에 입장 시스템 메시지 발송 위임
        chatService.sendSystemMessage(roomId, user.getNickname() + "님이 입장하셨습니다.");
    }

    // 5. 모임방 퇴장하기 (Leave + 퇴장 시스템 메시지 발송)
    @Transactional
    public void leaveRoom(Long userId, Long roomId) {
        RoomMember member = roomMemberRepository.findByRoomIdAndUserIdAndMemberStatus(roomId, userId, MemberStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("참여 중이지 않은 방이거나 이미 퇴장한 방입니다."));

        // 상태 변경
        member.leave();
        String leaverNickname = member.getUser().getNickname();

        // 방장이 나갈 경우: 다른 멤버에게 OWNER 위임 또는 방 종료
        if (RoomRole.OWNER.equals(member.getRoomRole())) {
            List<RoomMember> remainingMembers = roomMemberRepository.findByRoomIdAndMemberStatus(roomId, MemberStatus.ACTIVE).stream()
                    .filter(m -> !m.getUser().getUserId().equals(userId))
                    .collect(Collectors.toList());

            if (!remainingMembers.isEmpty()) {
                RoomMember nextOwner = remainingMembers.get(0);
                nextOwner.changeRole(RoomRole.OWNER);
            } else {
                roomRepository.findById(roomId).ifPresent(Room::closeRoom);
            }
        }

        // ChatService에 시스템 메시지 발송 위임
        chatService.sendSystemMessage(roomId, leaverNickname + "님이 퇴장하셨습니다.");
    }
}