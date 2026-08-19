package com.log.MeetupLog.domain.friend.repository;

import com.log.MeetupLog.domain.friend.entity.FriendRequest;
import com.log.MeetupLog.domain.friend.entity.FriendRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    @Query("""
            select r from FriendRequest r
            join fetch r.requester
            join fetch r.receiver
            where r.requestStatus = :status
              and ((r.requester.userId = :first and r.receiver.userId = :second)
                or (r.requester.userId = :second and r.receiver.userId = :first))
            """)
    Optional<FriendRequest> findBetweenWithStatus(
            @Param("first") Long first,
            @Param("second") Long second,
            @Param("status") FriendRequestStatus status
    );

    @Query("""
            select r from FriendRequest r
            join fetch r.requester
            where r.receiver.userId = :receiverId and r.requestStatus = :status
            order by r.createdAt desc
            """)
    List<FriendRequest> findReceived(
            @Param("receiverId") Long receiverId,
            @Param("status") FriendRequestStatus status
    );

    @Query("""
            select r from FriendRequest r
            join fetch r.receiver
            where r.requester.userId = :requesterId and r.requestStatus = :status
            order by r.createdAt desc
            """)
    List<FriendRequest> findSent(
            @Param("requesterId") Long requesterId,
            @Param("status") FriendRequestStatus status
    );
}
