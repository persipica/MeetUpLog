package com.log.MeetupLog.domain.friend.service;

import com.log.MeetupLog.domain.friend.dto.*;
import com.log.MeetupLog.domain.friend.entity.*;
import com.log.MeetupLog.domain.friend.repository.FriendRequestRepository;
import com.log.MeetupLog.domain.friend.repository.FriendshipRepository;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.entity.AccountStatus;
import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.domain.user.presence.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FriendService {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final PresenceService presenceService;

    public List<FriendUserResponse> getFriends(Long userId) {
        requireMemberUser(userId);
        return friendshipRepository.findAllForUser(userId, FriendshipStatus.ACTIVE).stream()
                .map(friendship -> {
                    User friend = friendship.otherUser(userId);
                    return FriendUserResponse.from(
                            friend,
                            "FRIEND",
                            presenceService.currentStatus(friend.getUserId()).name()
                    );
                })
                .toList();
    }

    public List<FriendUserResponse> search(Long userId, String rawQuery) {
        requireMemberUser(userId);
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            throw new IllegalArgumentException("검색어를 2자 이상 입력해주세요.");
        }

        String lowered = query.toLowerCase(Locale.ROOT);
        return userRepository.findAll().stream()
                .filter(user -> !user.getUserId().equals(userId))
                .filter(user -> user.getAccountStatus() == AccountStatus.ACTIVE)
                .filter(user -> user.getAccountType() != AccountType.GUEST)
                .filter(user -> (user.getNickname() != null && user.getNickname().toLowerCase(Locale.ROOT).contains(lowered))
                        || (user.getEmail() != null && user.getEmail().toLowerCase(Locale.ROOT).contains(lowered)))
                .limit(20)
                .map(user -> FriendUserResponse.from(
                        user,
                        relationship(userId, user.getUserId()),
                        presenceService.currentStatus(user.getUserId()).name()
                ))
                .toList();
    }

    @Transactional
    public FriendRequestResponse sendRequest(Long requesterId, FriendActionRequest request) {
        if (requesterId.equals(request.getReceiverId())) {
            throw new IllegalArgumentException("본인에게 친구 요청을 보낼 수 없습니다.");
        }
        User requester = requireMemberUser(requesterId);
        User receiver = requireMemberUser(request.getReceiverId());

        friendshipRepository.findPair(requesterId, receiver.getUserId()).ifPresent(friendship -> {
            if (friendship.getFriendshipStatus() == FriendshipStatus.ACTIVE) {
                throw new IllegalStateException("이미 친구인 사용자입니다.");
            }
            throw new IllegalStateException("차단 관계에서는 친구 요청을 보낼 수 없습니다.");
        });
        if (friendRequestRepository.findBetweenWithStatus(
                requesterId, receiver.getUserId(), FriendRequestStatus.PENDING).isPresent()) {
            throw new IllegalStateException("이미 대기 중인 친구 요청이 있습니다.");
        }

        FriendRequest saved = friendRequestRepository.save(FriendRequest.builder()
                .requester(requester)
                .receiver(receiver)
                .requestMessage(request.getMessage())
                .build());
        return FriendRequestResponse.sent(saved);
    }

    public List<FriendRequestResponse> getReceivedRequests(Long userId) {
        requireMemberUser(userId);
        return friendRequestRepository.findReceived(userId, FriendRequestStatus.PENDING).stream()
                .map(FriendRequestResponse::received)
                .toList();
    }

    public List<FriendRequestResponse> getSentRequests(Long userId) {
        requireMemberUser(userId);
        return friendRequestRepository.findSent(userId, FriendRequestStatus.PENDING).stream()
                .map(FriendRequestResponse::sent)
                .toList();
    }

    @Transactional
    public FriendUserResponse accept(Long userId, Long requestId) {
        requireMemberUser(userId);
        FriendRequest request = requireReceivedPending(userId, requestId);
        request.accept();

        Long requesterId = request.getRequester().getUserId();
        Friendship friendship = friendshipRepository.findPair(userId, requesterId)
                .orElseGet(() -> Friendship.builder()
                        .userLow(userId < requesterId ? request.getReceiver() : request.getRequester())
                        .userHigh(userId < requesterId ? request.getRequester() : request.getReceiver())
                        .build());
        friendship.activate();
        friendshipRepository.save(friendship);
        return FriendUserResponse.from(
                request.getRequester(),
                "FRIEND",
                presenceService.currentStatus(request.getRequester().getUserId()).name()
        );
    }

    @Transactional
    public void reject(Long userId, Long requestId) {
        requireMemberUser(userId);
        requireReceivedPending(userId, requestId).reject();
    }

    @Transactional
    public void remove(Long userId, Long friendId) {
        requireMemberUser(userId);
        Friendship friendship = friendshipRepository.findPair(userId, friendId)
                .orElseThrow(() -> new IllegalArgumentException("친구 관계가 아닙니다."));
        if (friendship.getFriendshipStatus() != FriendshipStatus.ACTIVE) {
            throw new IllegalStateException("활성 친구 관계가 아닙니다.");
        }
        friendshipRepository.delete(friendship);
    }

    @Transactional
    public void block(Long userId, Long targetId, String reason) {
        User actor = requireMemberUser(userId);
        requireUser(targetId);
        Friendship friendship = friendshipRepository.findPair(userId, targetId)
                .orElseThrow(() -> new IllegalArgumentException("친구 관계가 아닙니다."));
        friendship.block(actor, reason);
    }

    public boolean areFriends(Long first, Long second) {
        return friendshipRepository.areActiveFriends(first, second);
    }

    private String relationship(Long me, Long other) {
        return friendshipRepository.findPair(me, other)
                .map(friendship -> friendship.getFriendshipStatus() == FriendshipStatus.ACTIVE ? "FRIEND" : "BLOCKED")
                .orElseGet(() -> friendRequestRepository
                        .findBetweenWithStatus(me, other, FriendRequestStatus.PENDING)
                        .map(request -> request.getRequester().getUserId().equals(me) ? "REQUEST_SENT" : "REQUEST_RECEIVED")
                        .orElse("NONE"));
    }

    private FriendRequest requireReceivedPending(Long userId, Long requestId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 친구 요청입니다."));
        if (!request.getReceiver().getUserId().equals(userId)) {
            throw new SecurityException("친구 요청을 처리할 권한이 없습니다.");
        }
        if (request.getRequestStatus() != FriendRequestStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 친구 요청입니다.");
        }
        return request;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
    }

    private User requireMemberUser(Long userId) {
        User user = requireUser(userId);
        if (user.getAccountType() == AccountType.GUEST) {
            throw new SecurityException("게스트 계정은 친구 기능을 사용할 수 없습니다.");
        }
        return user;
    }
}
