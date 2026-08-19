package com.log.MeetupLog.domain.room.invite.repository;

import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInvite;
import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomMemberInviteRepository extends JpaRepository<RoomMemberInvite, Long> {

    @Query("""
            select i from RoomMemberInvite i
            where i.room.roomId = :roomId and i.invitee.userId = :inviteeId and i.inviteStatus = :status
            """)
    Optional<RoomMemberInvite> findPending(
            @Param("roomId") Long roomId,
            @Param("inviteeId") Long inviteeId,
            @Param("status") RoomMemberInviteStatus status
    );

    @Query("""
            select i from RoomMemberInvite i
            join fetch i.room
            join fetch i.inviter
            where i.invitee.userId = :inviteeId and i.inviteStatus = :status
            order by i.createdAt desc
            """)
    List<RoomMemberInvite> findReceived(
            @Param("inviteeId") Long inviteeId,
            @Param("status") RoomMemberInviteStatus status
    );

    @Query("""
            select i from RoomMemberInvite i
            join fetch i.invitee
            where i.room.roomId = :roomId and i.inviter.userId = :inviterId and i.inviteStatus = :status
            order by i.createdAt desc
            """)
    List<RoomMemberInvite> findSentForRoom(
            @Param("roomId") Long roomId,
            @Param("inviterId") Long inviterId,
            @Param("status") RoomMemberInviteStatus status
    );
}
