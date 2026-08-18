package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    // 활성화된 모임방 최신순 목록 조회
    List<ChatRoom> findAllByRoomStatusOrderByCreatedAtDesc(RoomStatus roomStatus);
}