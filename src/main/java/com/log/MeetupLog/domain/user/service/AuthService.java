package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import com.log.MeetupLog.domain.user.dto.KakaoUserInfoResponse;
import com.log.MeetupLog.domain.user.dto.GuestLoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginResponse;
import com.log.MeetupLog.domain.user.dto.LoginRequest;
import com.log.MeetupLog.domain.user.dto.SignUpRequest;
import com.log.MeetupLog.domain.user.entity.AccountStatus;
import com.log.MeetupLog.domain.user.entity.AccountType;
import com.log.MeetupLog.domain.user.entity.Role;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.repository.UserRepository;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final KakaoService kakaoService;

// 1. 자체 회원가입 (MEMBER)

    @Transactional
    public AuthResponse signUp(SignUpRequest request) {
        // 이메일 중복 검사
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        // 비밀번호 암호화 (BCrypt)
        String encodedPassword = passwordEncoder.encode(request.getPassword());

        // 유저 엔티티 생성 및 저장
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(encodedPassword)
                .nickname(request.getNickname())
                .accountType(AccountType.MEMBER)
                .role(Role.USER)
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);

        // JWT 토큰 발급
        String token = jwtTokenProvider.createAccessToken(
                savedUser.getUserId(),
                savedUser.getAccountType().name(),
                savedUser.getRole().name()
        );

        return AuthResponse.builder()
                .accountToken(token)
                .userId(savedUser.getUserId())
                .email(savedUser.getEmail())
                .nickname(savedUser.getNickname())
                .accountType(savedUser.getAccountType())
                .build();
    }

// 2. 자체 로그인 (MEMBER)

    public AuthResponse login(LoginRequest request) {
        // 이메일 존재 여부 확인
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다."));

        // 계정 상태 체크
        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new IllegalStateException("비활성화되거나 정지된 계정입니다.");
        }

        // 비밀번호 일치 검사
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // JWT 토큰 발급
        String token = jwtTokenProvider.createAccessToken(
                user.getUserId(),
                user.getAccountType().name(),
                user.getRole().name()
        );

        return AuthResponse.builder()
                .accountToken(token)
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .accountType(user.getAccountType())
                .build();
    }
// 4. 카카오 소셜 로그인

    @Transactional
    public AuthResponse kakaoLogin(String code) {
        // 1) 인가 코드로 카카오 액세스 토큰 획득
        String kakaoAccessToken = kakaoService.getKakaoAccessToken(code);

        // 2) 카카오 액세스 토큰으로 프로필 정보 획득
        KakaoUserInfoResponse userInfo = kakaoService.getUserInfo(kakaoAccessToken);
        Long kakaoId = userInfo.getId();

        // 이메일이 없는 경우 카카오ID 기반 가상 이메일 생성
        String email = (userInfo.getKakaoAccount() != null && userInfo.getKakaoAccount().getEmail() != null)
                ? userInfo.getKakaoAccount().getEmail()
                : "kakao_" + kakaoId + "@kakao.com";

        String nickname = "카카오유저";
        if (userInfo.getKakaoAccount() != null && userInfo.getKakaoAccount().getProfile() != null) {
            nickname = userInfo.getKakaoAccount().getProfile().getNickname();
        }

        // 3) DB 조회 및 신규 회원이면 자동 가입
        final String userEmail = email;
        final String userNickname = nickname;
        User user = userRepository.findByEmail(userEmail)
                .orElseGet(() -> userRepository.save(
                        User.builder()
                                .email(userEmail)
                                .nickname(userNickname)
                                .passwordHash("") // 소셜 로그인은 자체 비밀번호 불필요
                                .accountType(AccountType.SOCIAL)
                                .role(Role.USER)
                                .accountStatus(AccountStatus.ACTIVE)
                                .build()
                ));

        // 4) 우리 서비스 전용 JWT Access Token 발급
        String token = jwtTokenProvider.createAccessToken(
                user.getUserId(),
                user.getAccountType().name(),
                user.getRole().name()
        );

        return AuthResponse.builder()
                .accountToken(token)
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .accountType(user.getAccountType())
                .build();
    }



//3. 게스트 로그인

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