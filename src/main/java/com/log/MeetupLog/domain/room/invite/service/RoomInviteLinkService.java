package com.log.MeetupLog.domain.room.invite.service;

import com.log.MeetupLog.domain.room.dto.ChatRoomResponse;
import com.log.MeetupLog.domain.room.entity.*;
import com.log.MeetupLog.domain.room.invite.dto.*;
import com.log.MeetupLog.domain.room.invite.entity.RoomInvite;
import com.log.MeetupLog.domain.room.invite.entity.RoomInviteStatus;
import com.log.MeetupLog.domain.room.invite.repository.RoomInviteRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.service.ChatRoomService;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoomInviteLinkService {

    private final RoomInviteRepository inviteRepository;
    private final ChatRoomMemberRepository roomMemberRepository;
    private final UserRepository userRepository;
    private final ChatRoomService chatRoomService;
    private final JwtTokenProvider jwtTokenProvider;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public RoomInviteLinkResponse create(Long userId, Long roomId, CreateRoomInviteLinkRequest request) {
        ChatRoomMember member = requireOwner(roomId, userId);
        inviteRepository.findForRoom(roomId, RoomInviteStatus.ACTIVE)
                .forEach(RoomInvite::revoke);

        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        int hours = request.getExpiresInHours() == null ? 24 : request.getExpiresInHours();
        int maxUses = request.getMaxUses() == null ? 50 : request.getMaxUses();

        RoomInvite saved = inviteRepository.save(RoomInvite.builder()
                .room(member.getChatRoom())
                .createdBy(member.getUser())
                .tokenHash(hash(rawToken))
                .expiresAt(LocalDateTime.now().plusHours(hours))
                .maxUses(maxUses)
                .build());
        return RoomInviteLinkResponse.created(saved, rawToken);
    }

    public PublicRoomInviteResponse getPublicInfo(String rawToken) {
        return PublicRoomInviteResponse.from(requireInvite(rawToken));
    }

    public RoomInviteLinkResponse getActive(Long userId, Long roomId) {
        requireOwner(roomId, userId);
        return inviteRepository.findForRoom(roomId, RoomInviteStatus.ACTIVE)
                .stream()
                .filter(RoomInvite::isUsable)
                .findFirst()
                .map(RoomInviteLinkResponse::active)
                .orElse(null);
    }

    @Transactional
    public ChatRoomResponse joinAuthenticated(Long userId, String rawToken) {
        if (userId == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        RoomInvite invite = requireUsableInvite(rawToken);
        if (roomMemberRepository.existsByRoomIdAndUserIdAndStatus(
                invite.getRoom().getRoomId(), userId, MemberStatus.ACTIVE)) {
            return chatRoomService.getRoom(userId, invite.getRoom().getRoomId());
        }
        chatRoomService.joinRoomFromInvitation(userId, invite.getRoom().getRoomId());
        invite.consume();
        return chatRoomService.getRoom(userId, invite.getRoom().getRoomId());
    }

    @Transactional
    public GuestInviteLoginResponse joinGuest(String rawToken, String nickname) {
        RoomInvite invite = requireUsableInvite(rawToken);
        User guest = userRepository.save(User.createGuest(nickname.trim()));
        chatRoomService.joinRoomFromInvitation(guest.getUserId(), invite.getRoom().getRoomId());
        invite.consume();

        String token = jwtTokenProvider.createAccessToken(
                guest.getUserId(),
                guest.getAccountType().name(),
                guest.getRole().name()
        );
        return GuestInviteLoginResponse.builder()
                .userId(guest.getUserId())
                .nickname(guest.getNickname())
                .accountType(guest.getAccountType().name())
                .accountToken(token)
                .inviteRoomId(invite.getRoom().getRoomId())
                .inviteRoomName(invite.getRoom().getRoomName())
                .build();
    }

    @Transactional
    public void revoke(Long userId, Long roomId, Long inviteId) {
        requireOwner(roomId, userId);
        RoomInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 초대 링크입니다."));
        if (!invite.getRoom().getRoomId().equals(roomId)) {
            throw new SecurityException("해당 채팅방의 초대 링크가 아닙니다.");
        }
        invite.revoke();
    }

    private RoomInvite requireInvite(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("초대 토큰이 없습니다.");
        }
        return inviteRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 초대 링크입니다."));
    }

    private RoomInvite requireUsableInvite(String rawToken) {
        RoomInvite invite = requireInvite(rawToken);
        if (!invite.isUsable()) {
            invite.expireIfNecessary();
            throw new IllegalStateException("만료되었거나 사용할 수 없는 초대 링크입니다.");
        }
        return invite;
    }

    private ChatRoomMember requireOwner(Long roomId, Long userId) {
        ChatRoomMember member = roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new IllegalStateException("채팅방 참여자가 아닙니다."));
        if (member.getMemberStatus() != MemberStatus.ACTIVE || member.getRoomRole() != RoomRole.OWNER) {
            throw new SecurityException("방장만 초대 링크를 관리할 수 있습니다.");
        }
        return member;
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 해시를 사용할 수 없습니다.", exception);
        }
    }
}
