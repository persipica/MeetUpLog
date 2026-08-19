package com.log.MeetupLog.global.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 1. Request Header에서 "Bearer <토큰>" 꺼내기
        String token = resolveToken(request);

        // 2. 토큰이 유효한지 검증 (이미 만들어두신 validateToken 사용)
        if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
            // 토큰에서 userId 꺼내기 (이미 만들어두신 getUserIdFromToken 사용)
            Long userId = jwtTokenProvider.getUserIdFromToken(token);

            // 유저 권한 부여 (기본 ROLE_USER)
            SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_USER");

            // 시큐리티 인증 신분증 생성 (principal 자리에 userId 담기)
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userId, null, Collections.singletonList(authority));

            // 시큐리티 장부에 "인증된 유저"로 저장!
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        // 3. 다음 순서(컨트롤러)로 통과!
        filterChain.doFilter(request, response);
    }

    // Header의 "Authorization: Bearer <JWT>"에서 순수 토큰만 잘라내는 함수
    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}