package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import com.log.MeetupLog.domain.user.dto.SignUpRequest;
import com.log.MeetupLog.domain.user.dto.LoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginResponse;
import com.log.MeetupLog.domain.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // 자체 회원가입 (POST /api/v1/auth/signup)
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signUp(@Valid @RequestBody SignUpRequest request) {
        AuthResponse response = authService.signUp(request);
        return ResponseEntity.ok(response);
    }

    // 자체 로그인 (POST /api/v1/auth/login)
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    // 카카오 소셜 로그인 (GET /api/v1/auth/kakao/callback?code=...)
    @GetMapping("/kakao/callback")
    public ResponseEntity<AuthResponse> kakaoCallback(@RequestParam("code") String code) {
        AuthResponse response = authService.kakaoLogin(code);
        return ResponseEntity.ok(response);
    }


    // 게스트 로그인 / 임시 계정 생성 API / POST 요청 처리: http://localhost:8080/guest
    @PostMapping("/guest")
    public ResponseEntity<GuestLoginResponse> guestLogin(@Valid @RequestBody GuestLoginRequest request) {
        // @Valid: Request DTO의 @NotBlank, @Size 유효성 검사를 작동시킴
        // @RequestBody: 프론트가 보낸 JSON 데이터를 자바 객체(GuestLoginRequest)로 변환해 줌

        GuestLoginResponse response = authService.createGuestUser(request);
        return ResponseEntity.ok(response);
    }
    // 인증 테스트용 API (GET /guest/test)
    @GetMapping("/test")
    public ResponseEntity<String> testToken(@AuthenticationPrincipal Long userId) {
        return ResponseEntity.ok("인증 성공! 현재 로그인한 유저 ID: " + userId);
    }
}