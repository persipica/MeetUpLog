package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

    // 1. 방에 해당 유저가 참여 중인지 확인
    @Query("SELECT COUNT(m) > 0 FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.user.userId = :userId AND m.memberStatus = :memberStatus")
    boolean existsByRoomIdAndUserIdAndStatus(@Param("roomId") Long roomId,
                                             @Param("userId") Long userId,
                                             @Param("memberStatus") MemberStatus memberStatus);

    // 2. 방과 유저 ID로 멤버 조회
    @Query("SELECT m FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.user.userId = :userId")
    Optional<ChatRoomMember> findByRoomIdAndUserId(@Param("roomId") Long roomId,
                                                   @Param("userId") Long userId);

    // 3. 특정 방의 활성 인원수 계산
    @Query("SELECT COUNT(m) FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.memberStatus = :memberStatus")
    int countByRoomIdAndStatus(@Param("roomId") Long roomId,
                               @Param("memberStatus") MemberStatus memberStatus);
}