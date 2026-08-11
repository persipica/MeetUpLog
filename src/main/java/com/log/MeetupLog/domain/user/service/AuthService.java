package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.GuestLoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginResponse;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public GuestLoginResponse createGuestUser(GuestLoginRequest request) {
        // 1. 게스트 유저 엔티티 생성 및 DB 저장
        User guestUser = User.createGuest(request.getNickname());
        User savedUser = userRepository.save(guestUser);

        // 2. JWT Access Token 발급
        String token = jwtTokenProvider.createAccessToken(
                savedUser.getUserId(),
                savedUser.getAccountType().name(),
                savedUser.getRole().name()
        );

        // 3. DTO 변수명(accountToken)에 맞춰 응답 생성
        return GuestLoginResponse.builder()
                .userId(savedUser.getUserId())
                .nickname(savedUser.getNickname())
                .accountType(savedUser.getAccountType().name())
                .accountToken(token)
                .build();
    }
}