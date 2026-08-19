package com.log.MeetupLog.domain.friend.repository;

import com.log.MeetupLog.domain.friend.entity.Friendship;
import com.log.MeetupLog.domain.friend.entity.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("""
            select f from Friendship f
            join fetch f.userLow
            join fetch f.userHigh
            where (f.userLow.userId = :userId or f.userHigh.userId = :userId)
              and f.friendshipStatus = :status
            order by f.updatedAt desc
            """)
    List<Friendship> findAllForUser(
            @Param("userId") Long userId,
            @Param("status") FriendshipStatus status
    );

    @Query("""
            select f from Friendship f
            join fetch f.userLow
            join fetch f.userHigh
            where (f.userLow.userId = :first and f.userHigh.userId = :second)
               or (f.userLow.userId = :second and f.userHigh.userId = :first)
            """)
    Optional<Friendship> findPair(@Param("first") Long first, @Param("second") Long second);

    @Query("""
            select count(f) > 0 from Friendship f
            where ((f.userLow.userId = :first and f.userHigh.userId = :second)
               or (f.userLow.userId = :second and f.userHigh.userId = :first))
              and f.friendshipStatus = com.log.MeetupLog.domain.friend.entity.FriendshipStatus.ACTIVE
            """)
    boolean areActiveFriends(@Param("first") Long first, @Param("second") Long second);
}
