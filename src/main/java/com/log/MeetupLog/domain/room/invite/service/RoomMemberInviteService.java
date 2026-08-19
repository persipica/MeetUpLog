package com.log.MeetupLog.domain.room.invite.service;

import com.log.MeetupLog.domain.friend.service.FriendService;
import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.entity.*;
import com.log.MeetupLog.domain.room.invite.dto.RoomMemberInviteResponse;
import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInvite;
import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInviteStatus;
import com.log.MeetupLog.domain.room.invite.repository.RoomMemberInviteRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.service.ChatRoomService;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoomMemberInviteService {

    private final RoomMemberInviteRepository inviteRepository;
    private final ChatRoomMemberRepository roomMemberRepository;
    private final UserRepository userRepository;
    private final FriendService friendService;
    private final ChatRoomService chatRoomService;

    @Transactional
    public RoomMemberInviteResponse send(Long inviterId, Long roomId, Long inviteeId) {
        ChatRoomMember inviterMember = requireActiveMember(roomId, inviterId);
        if (inviterMember.getRoomRole() != RoomRole.OWNER) {
            throw new SecurityException("방장만 참여자를 초대할 수 있습니다.");
        }
        ChatRoom room = inviterMember.getChatRoom();
        if (room.getRoomStatus() != RoomStatus.ACTIVE) {
            throw new IllegalStateException("초대할 수 없는 채팅방입니다.");
        }
        if (inviterId.equals(inviteeId)) {
            throw new IllegalArgumentException("본인을 초대할 수 없습니다.");
        }
        if (!friendService.areFriends(inviterId, inviteeId)) {
            throw new IllegalStateException("친구만 채팅방에 초대할 수 있습니다.");
        }
        if (roomMemberRepository.existsByRoomIdAndUserIdAndStatus(roomId, inviteeId, MemberStatus.ACTIVE)) {
            throw new IllegalStateException("이미 참여 중인 사용자입니다.");
        }
        roomMemberRepository.findByRoomIdAndUserId(roomId, inviteeId).ifPresent(member -> {
            if (member.getMemberStatus() == MemberStatus.KICKED || member.getMemberStatus() == MemberStatus.BLOCKED) {
                throw new IllegalStateException("강퇴 또는 차단된 사용자는 초대할 수 없습니다.");
            }
        });
        if (inviteRepository.findPending(roomId, inviteeId, RoomMemberInviteStatus.PENDING).isPresent()) {
            throw new IllegalStateException("이미 대기 중인 채팅방 초대가 있습니다.");
        }
        int current = roomMemberRepository.countByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        if (current >= room.getMaxMembers()) {
            throw new IllegalStateException("채팅방 정원이 마감되었습니다.");
        }

        User invitee = userRepository.findById(inviteeId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
        RoomMemberInvite saved = inviteRepository.save(RoomMemberInvite.builder()
                .room(room)
                .inviter(inviterMember.getUser())
                .invitee(invitee)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());
        return RoomMemberInviteResponse.from(saved);
    }

    public List<RoomMemberInviteResponse> received(Long userId) {
        return inviteRepository.findReceived(userId, RoomMemberInviteStatus.PENDING).stream()
                .filter(invite -> !invite.isExpired())
                .map(RoomMemberInviteResponse::from)
                .toList();
    }

    public List<RoomMemberInviteResponse> sent(Long userId, Long roomId) {
        requireActiveMember(roomId, userId);
        return inviteRepository.findSentForRoom(roomId, userId, RoomMemberInviteStatus.PENDING).stream()
                .filter(invite -> !invite.isExpired())
                .map(RoomMemberInviteResponse::from)
                .toList();
    }

    @Transactional
    public ChatRoomResponse accept(Long userId, Long inviteId) {
        RoomMemberInvite invite = requireReceivedPending(userId, inviteId);
        chatRoomService.joinRoomFromInvitation(userId, invite.getRoom().getRoomId());
        invite.accept();
        return chatRoomService.getRoom(userId, invite.getRoom().getRoomId());
    }

    @Transactional
    public void reject(Long userId, Long inviteId) {
        requireReceivedPending(userId, inviteId).reject();
    }

    private RoomMemberInvite requireReceivedPending(Long userId, Long inviteId) {
        RoomMemberInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 채팅방 초대입니다."));
        if (!invite.getInvitee().getUserId().equals(userId)) {
            throw new SecurityException("채팅방 초대를 처리할 권한이 없습니다.");
        }
        if (invite.getInviteStatus() != RoomMemberInviteStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 채팅방 초대입니다.");
        }
        if (invite.isExpired()) {
            invite.expire();
            throw new IllegalStateException("만료된 채팅방 초대입니다.");
        }
        return invite;
    }

    private ChatRoomMember requireActiveMember(Long roomId, Long userId) {
        ChatRoomMember member = roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new IllegalStateException("채팅방 참여자가 아닙니다."));
        if (member.getMemberStatus() != MemberStatus.ACTIVE) {
            throw new IllegalStateException("현재 참여 중인 채팅방이 아닙니다.");
        }
        return member;
    }
}
