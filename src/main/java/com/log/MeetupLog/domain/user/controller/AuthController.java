package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import com.log.MeetupLog.domain.user.dto.GuestLoginRequest;
import com.log.MeetupLog.domain.user.dto.GuestLoginResponse;
import com.log.MeetupLog.domain.user.dto.LoginRequest;
import com.log.MeetupLog.domain.user.dto.OAuthExchangeRequest;
import com.log.MeetupLog.domain.user.dto.SignUpRequest;
import com.log.MeetupLog.domain.user.service.AuthService;
import com.log.MeetupLog.domain.user.service.OAuthLoginCodeService;
import com.log.MeetupLog.global.security.oauth.OAuth2LoginSuccessHandler;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final OAuthLoginCodeService oauthLoginCodeService;

    @Value("${app.oauth-cookie-secure:false}")
    private boolean secureCookie;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signUp(
            @Valid @RequestBody SignUpRequest request
    ) {
        return ResponseEntity.ok(authService.signUp(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request
    ) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/check-email")
    public ResponseEntity<Map<String, Boolean>> checkEmail(
            @RequestParam String email
    ) {
        return ResponseEntity.ok(
                Map.of("available", authService.isEmailAvailable(email))
        );
    }

    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNickname(
            @RequestParam String nickname
    ) {
        return ResponseEntity.ok(
                Map.of("available", authService.isNicknameAvailable(nickname))
        );
    }

    @PostMapping("/guest")
    public ResponseEntity<GuestLoginResponse> guestLogin(
            @Valid @RequestBody GuestLoginRequest request
    ) {
        return ResponseEntity.ok(authService.createGuestUser(request));
    }

    @PostMapping("/oauth/exchange")
    public ResponseEntity<AuthResponse> exchangeOAuthLogin(
            @CookieValue(
                    name = OAuth2LoginSuccessHandler.EXCHANGE_COOKIE_NAME,
                    required = false
            ) String cookieCode,
            @RequestBody(required = false) OAuthExchangeRequest request,
            HttpServletResponse response
    ) {
        String bodyCode = request == null ? null : request.getCode();
        String exchangeCode = cookieCode != null && !cookieCode.isBlank()
                ? cookieCode
                : bodyCode;

        AuthResponse authResponse = oauthLoginCodeService.consume(exchangeCode);

        ResponseCookie expiredCookie = ResponseCookie
                .from(OAuth2LoginSuccessHandler.EXCHANGE_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path(OAuth2LoginSuccessHandler.EXCHANGE_COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, expiredCookie.toString());
        return ResponseEntity.ok(authResponse);
    }

    @GetMapping("/test")
    public ResponseEntity<String> testToken(
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(
                "인증 성공! 현재 로그인한 유저 ID: " + userId
        );
    }
}
