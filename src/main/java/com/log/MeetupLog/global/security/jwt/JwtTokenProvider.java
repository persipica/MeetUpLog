package com.log.MeetupLog.global.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}") // application.yml에 적어둔 비밀키 문자열을 가져옴
    private String secretKeyPlain;

    @Value("${jwt.access-token-validity-in-seconds}")   // application.yml의 토큰 유효시간 가져옴.
    private long accessTokenValidityInSeconds;

    private SecretKey secretKey;

    @PostConstruct
    protected void init() {
        // application.yml의 문자열 키를 HMAC-SHA 알고리즘용 SecretKey 객체로 변환함.
        this.secretKey = Keys.hmacShaKeyFor(secretKeyPlain.getBytes(StandardCharsets.UTF_8));
    }

    // 유저 식별자(userId), 계정유형(MEMBER, SOCIAL, GUEST), 권한(USER)을 받아서 토큰 생성함.
    public String createAccessToken(Long userId, String accountType, String role) {
        Claims claims = Jwts.claims()
                .subject(String.valueOf(userId))        // 누구 토큰인지
                .add("accountType", accountType)     // 사용자 유형
                .add("role", role)                   // 서비스 역할
                .build();

        Date now = new Date();
        Date validity = new Date(now.getTime() + (accessTokenValidityInSeconds * 1000));    // 현재 + 만료까지 시간

        return Jwts.builder()           // 최종 토큰 문자열로 완성.
                .claims(claims)         // 위에 유저 정보
                .issuedAt(now)
                .expiration(validity)   // 만료 시각
                .signWith(secretKey)
                .compact();
    }

    // 토큰에서 userId 추출함.
    public Long getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return Long.parseLong(claims.getSubject());
    }

    // 토큰 유효성 검증(위조, 시간만료) 시도.
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;    // 정보 맞고 시간도 만료 안됬으면 true
        } catch (SecurityException | MalformedJwtException e) {
            log.info("잘못된 JWT 서명입니다.");
        } catch (ExpiredJwtException e) {
            log.info("만료된 JWT 토큰입니다.");
        } catch (UnsupportedJwtException e) {
            log.info("지원되지 않는 JWT 토큰입니다.");
        } catch (IllegalArgumentException e) {
            log.info("JWT 토큰이 비어있습니다.");
        }
        return false;
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {   // 만료된 토큰이 들어와도 에러 안뜨고
            return e.getClaims();           // 유저 정보 꺼내줌
        }
    }
}