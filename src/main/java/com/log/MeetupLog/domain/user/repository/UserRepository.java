package com.log.MeetupLog.domain.user.repository;

import com.log.MeetupLog.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByKakaoId(String kakaoId);

    default Optional<User> findByKakaoUserId(String kakaoUserId) {
        return findByKakaoId(kakaoUserId);
    }

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    boolean existsByEmailAndUserIdNot(String email, Long userId);

    boolean existsByNicknameAndUserIdNot(String nickname, Long userId);
}
