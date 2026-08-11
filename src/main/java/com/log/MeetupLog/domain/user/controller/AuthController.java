package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.dto.GuestLoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginResponse;
import com.log.MeetupLog.domain.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/guest")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // 게스트 로그인 / 임시 계정 생성 API / POST 요청 처리: http://localhost:8080/guest
    @PostMapping("/guest")
    public ResponseEntity<GuestLoginResponse> guestLogin(@Valid @RequestBody GuestLoginRequest request) {
        // @Valid: Request DTO의 @NotBlank, @Size 유효성 검사를 작동시킴
        // @RequestBody: 프론트가 보낸 JSON 데이터를 자바 객체(GuestLoginRequest)로 변환해 줌

        GuestLoginResponse response = authService.createGuestUser(request);
        return ResponseEntity.ok(response);
    }
}