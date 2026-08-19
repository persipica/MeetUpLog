package com.log.MeetupLog.global.security.oauth;

import com.log.MeetupLog.domain.user.dto.AuthResponse;
import com.log.MeetupLog.domain.user.entity.User;
import com.log.MeetupLog.domain.user.service.KakaoAccountService;
import com.log.MeetupLog.domain.user.service.OAuthLoginCodeService;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    public static final String EXCHANGE_COOKIE_NAME = "ml_oauth_exchange";
    public static final String EXCHANGE_COOKIE_PATH = "/api/v1/auth/oauth";

    private final KakaoAccountService kakaoAccountService;
    private final OAuthLoginCodeService oauthLoginCodeService;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.oauth-cookie-secure:false}")
    private boolean secureCookie;

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException, ServletException {
        if (!(authentication.getPrincipal() instanceof OAuth2User oauth2User)) {
            response.sendRedirect(frontendUrl + "/auth?oauthError=invalid_principal");
            return;
        }

        Map<String, Object> attributes = oauth2User.getAttributes();
        Map<String, Object> kakaoAccount = asMap(attributes.get("kakao_account"));
        Map<String, Object> profile = asMap(kakaoAccount.get("profile"));

        String kakaoId = stringValue(attributes.get("id"));
        String email = stringValue(kakaoAccount.get("email"));
        String nickname = stringValue(profile.get("nickname"));
        String profileImageUrl = stringValue(profile.get("profile_image_url"));

        User user = kakaoAccountService.synchronizeKakaoUser(
                kakaoId,
                email,
                nickname,
                profileImageUrl
        );

        String accountToken = jwtTokenProvider.createAccessToken(
                user.getUserId(),
                user.getAccountType().name(),
                user.getRole().name()
        );

        AuthResponse authResponse = AuthResponse.builder()
                .accountToken(accountToken)
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .accountType(user.getAccountType())
                .build();

        String exchangeCode = oauthLoginCodeService.issue(authResponse);

        ResponseCookie exchangeCookie = ResponseCookie
                .from(EXCHANGE_COOKIE_NAME, exchangeCode)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path(EXCHANGE_COOKIE_PATH)
                .maxAge(Duration.ofMinutes(2))
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, exchangeCookie.toString());
        response.sendRedirect(frontendUrl + "/auth?oauth=success");
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map<?, ?> rawMap)) {
            return Map.of();
        }

        Map<String, Object> result = new java.util.HashMap<>();
        rawMap.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }
}
