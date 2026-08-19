package com.log.MeetupLog.global.security.config;

import com.log.MeetupLog.global.security.jwt.JwtAuthenticationFilter;
import com.log.MeetupLog.global.security.jwt.JwtTokenProvider;
import com.log.MeetupLog.global.security.oauth.OAuth2LoginSuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            OAuth2LoginSuccessHandler oauth2LoginSuccessHandler
    ) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)

                // 카카오 로그인 진행 중 state 값을 세션에 임시 저장
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.IF_REQUIRED
                        )
                )

                .authorizeHttpRequests(auth -> auth.requestMatchers(
                                        "/guest",
                                        "/guest/**",
                                        "/api/v1/auth/**",
                                        "/oauth2/**",
                                        "/login/oauth2/**",
                                        "/login",
                                        "/error",
                                        "/ws",
                                        "/ws/**"
                                ).permitAll()
                                .requestMatchers(HttpMethod.GET, "/api/v1/invites/*").permitAll()
                                .requestMatchers(HttpMethod.POST, "/api/v1/invites/*/guest").permitAll()
                                .anyRequest().authenticated()
                )

                .oauth2Login(oauth -> oauth
                        .successHandler(oauth2LoginSuccessHandler)
                        .failureHandler((request, response, exception) -> {
                            exception.printStackTrace();

                            response.sendRedirect(
                                    "http://localhost:5173/auth?oauthError=true"
                            );
                        })
                )

                .addFilterBefore(
                        new JwtAuthenticationFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }
}