package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.RoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {

    // 1. 방과 유저 ID로 멤버 조회 (재입장 여부 확인용)
    @Query("SELECT m FROM RoomMember m WHERE m.room.roomId = :roomId AND m.user.userId = :userId")
    Optional<RoomMember> findByRoomIdAndUserId(@Param("roomId") Long roomId,
                                               @Param("userId") Long userId);

    // 2. 특정 방의 활성 인원수 계산
    @Query("SELECT COUNT(m) FROM RoomMember m WHERE m.room.roomId = :roomId AND m.memberStatus = :memberStatus")
    long countByRoomIdAndMemberStatus(@Param("roomId") Long roomId,
                                      @Param("memberStatus") MemberStatus memberStatus);

    // 3. 특정 방의 특정 상태(ACTIVE) 멤버 목록 전체 조회 (상세 조회용)
    @Query("SELECT m FROM RoomMember m WHERE m.room.roomId = :roomId AND m.memberStatus = :memberStatus")
    List<RoomMember> findByRoomIdAndMemberStatus(@Param("roomId") Long roomId,
                                                 @Param("memberStatus") MemberStatus memberStatus);

    // 4. 특정 방에 특정 유저가 특정 상태(ACTIVE)로 존재하는지 조회 (퇴장 및 중복 검증용)
    @Query("SELECT m FROM RoomMember m WHERE m.room.roomId = :roomId AND m.user.userId = :userId AND m.memberStatus = :memberStatus")
    Optional<RoomMember> findByRoomIdAndUserIdAndMemberStatus(@Param("roomId") Long roomId,
                                                              @Param("userId") Long userId,
                                                              @Param("memberStatus") MemberStatus memberStatus);

    // 5. 중복 참여 여부 boolean 확인 (기존 호환용)
    @Query("SELECT COUNT(m) > 0 FROM RoomMember m WHERE m.room.roomId = :roomId AND m.user.userId = :userId AND m.memberStatus = :memberStatus")
    boolean existsByRoomIdAndUserIdAndStatus(@Param("roomId") Long roomId,
                                             @Param("userId") Long userId,
                                             @Param("memberStatus") MemberStatus memberStatus);
}