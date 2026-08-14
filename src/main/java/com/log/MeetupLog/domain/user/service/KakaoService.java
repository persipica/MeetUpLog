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

    private final RestTemplate restTemplate;

    @Value("${kakao.client-id}")
    private String clientId;
    @Value("${kakao.client-secret}")
    private String clientSecret;
    @Value("${kakao.redirect-uri}")
    private String redirectUri;


// 1. 인가 코드로 카카오 Access Token 발급 요청

    public String getKakaoAccessToken(String code) {
        String tokenUrl = "https://kauth.kakao.com/oauth/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        ResponseEntity<KakaoTokenResponse> response = restTemplate.exchange(
                tokenUrl,
                HttpMethod.POST,
                request,
                KakaoTokenResponse.class
        );

        if (response.getBody() != null) {
            return response.getBody().getAccessToken();
        }
        throw new IllegalArgumentException("카카오 토큰 발급에 실패했습니다.");
    }

// 2. 카카오 Access Token으로 사용자 정보 조회

    public KakaoUserInfoResponse getUserInfo(String accessToken) {
        String userInfoUrl = "https://kapi.kakao.com/v2/user/me";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<KakaoUserInfoResponse> response = restTemplate.exchange(
                userInfoUrl,
                HttpMethod.GET,
                request,
                KakaoUserInfoResponse.class
        );

        if (response.getBody() != null) {
            return response.getBody();
        }
        throw new IllegalArgumentException("카카오 사용자 정보 조회에 실패했습니다.");
    }
}