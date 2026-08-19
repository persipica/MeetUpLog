package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.domain.user.dto.KakaoTokenResponse;
import com.log.MeetupLog.domain.user.dto.KakaoUserInfoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class KakaoService {

    private static final String KAKAO_TOKEN_URL =
            "https://kauth.kakao.com/oauth/token";

    private static final String KAKAO_USER_INFO_URL =
            "https://kapi.kakao.com/v2/user/me";

    private final RestTemplate restTemplate;

    @Value("${app.kakao.client-id}")
    private String clientId;

    @Value("${app.kakao.client-secret}")
    private String clientSecret;

    @Value("${app.kakao.redirect-uri}")
    private String redirectUri;

    /**
     * 카카오 인가 코드로 Access Token을 발급받습니다.
     */
    public String getKakaoAccessToken(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("카카오 인가 코드가 없습니다.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(MediaType.parseMediaTypes(MediaType.APPLICATION_JSON_VALUE));

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        HttpEntity<MultiValueMap<String, String>> request =
                new HttpEntity<>(params, headers);

        ResponseEntity<KakaoTokenResponse> response = restTemplate.exchange(
                KAKAO_TOKEN_URL,
                HttpMethod.POST,
                request,
                KakaoTokenResponse.class
        );

        KakaoTokenResponse responseBody = response.getBody();

        if (!response.getStatusCode().is2xxSuccessful()
                || responseBody == null
                || responseBody.getAccessToken() == null
                || responseBody.getAccessToken().isBlank()) {
            throw new IllegalStateException("카카오 Access Token 발급에 실패했습니다.");
        }

        return responseBody.getAccessToken();
    }

    /**
     * 카카오 Access Token으로 사용자 정보를 조회합니다.
     */
    public KakaoUserInfoResponse getUserInfo(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalArgumentException("카카오 Access Token이 없습니다.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(MediaType.parseMediaTypes(MediaType.APPLICATION_JSON_VALUE));

        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<KakaoUserInfoResponse> response = restTemplate.exchange(
                KAKAO_USER_INFO_URL,
                HttpMethod.GET,
                request,
                KakaoUserInfoResponse.class
        );

        KakaoUserInfoResponse responseBody = response.getBody();

        if (!response.getStatusCode().is2xxSuccessful() || responseBody == null) {
            throw new IllegalStateException("카카오 사용자 정보 조회에 실패했습니다.");
        }

        return responseBody;
    }
}