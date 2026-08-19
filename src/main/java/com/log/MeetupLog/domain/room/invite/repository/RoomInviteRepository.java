package com.log.MeetupLog.domain.room.invite.repository;

import com.log.MeetupLog.domain.room.invite.entity.RoomInvite;
import com.log.MeetupLog.domain.room.invite.entity.RoomInviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomInviteRepository extends JpaRepository<RoomInvite, Long> {

    @Query("select i from RoomInvite i join fetch i.room join fetch i.createdBy where i.tokenHash = :hash")
    Optional<RoomInvite> findByTokenHash(@Param("hash") String hash);

    @Query("""
            select i from RoomInvite i
            where i.room.roomId = :roomId and i.inviteStatus = :status
            order by i.createdAt desc
            """)
    List<RoomInvite> findForRoom(
            @Param("roomId") Long roomId,
            @Param("status") RoomInviteStatus status
    );
}
