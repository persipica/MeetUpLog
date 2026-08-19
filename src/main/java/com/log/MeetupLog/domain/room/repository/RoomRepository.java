package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.Room;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    // 1. 특정 상태(ACTIVE 등)의 모임방 목록을 생성일 최신순으로 조회
    List<Room> findAllByRoomStatusOrderByCreatedAtDesc(RoomStatus roomStatus);

    // 2. 특정 상태의 모임방 기본 조회
    List<Room> findByRoomStatus(RoomStatus roomStatus);
}