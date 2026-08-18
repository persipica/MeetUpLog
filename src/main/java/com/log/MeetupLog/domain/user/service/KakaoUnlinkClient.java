package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.global.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Component
public class KakaoUnlinkClient {

    private static final URI KAKAO_UNLINK_URI = URI.create("https://kapi.kakao.com/v1/user/unlink");

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final String adminKey;

    public KakaoUnlinkClient(@Value("${app.kakao.admin-key:}") String adminKey) {
        this.adminKey = adminKey == null ? "" : adminKey.trim();
    }

    public void unlink(String kakaoUserId) {
        if (adminKey.isBlank()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "KAKAO_ADMIN_KEY_MISSING",
                    "카카오 연동 해제용 Admin Key가 설정되지 않았습니다."
            );
        }

        String body = "target_id_type=user_id&target_id="
                + URLEncoder.encode(kakaoUserId, StandardCharsets.UTF_8);

        HttpRequest request = HttpRequest.newBuilder(KAKAO_UNLINK_URI)
                .header("Authorization", "KakaoAK " + adminKey)
                .header("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "KAKAO_UNLINK_FAILED",
                        "카카오 서버에서 연동을 해제하지 못했습니다."
                );
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "KAKAO_UNLINK_INTERRUPTED",
                    "카카오 연동 해제 요청이 중단되었습니다."
            );
        } catch (IOException exception) {
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "KAKAO_UNLINK_CONNECTION_FAILED",
                    "카카오 서버에 연결하지 못했습니다."
            );
        }
    }
}
