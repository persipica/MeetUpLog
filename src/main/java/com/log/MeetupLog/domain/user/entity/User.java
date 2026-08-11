package com.log.MeetupLog.domain.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")   // 사용자 고유 식별자
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 20)   // 사용자 유형(MEMBER, SOCIAL, GUEST)
    @Builder.Default
    private AccountType accountType = AccountType.MEMBER;

    @Column(name = "email", length = 100, unique = true)    // 자체 로그인에 사용하는 이메일
    private String email;

    @Column(name = "password_hash", length = 255)   // 단방향 해시 처리된 비밀번호
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 50)   // 서비스에 표시되는 닉네임
    private String nickname;

    @Column(name = "profile_image_url", length = 500)   // 사용자 프로필 이미지 URL
    private String profileImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)   // 서비스 역할 (USER, OWNER)
    @Builder.Default
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false, length = 20) // 계정 상태 (ACTIVE, INACTIVE)
    @Builder.Default
    private AccountStatus accountStatus = AccountStatus.ACTIVE;

    @Column(name = "converted_at")  // 게스트 계정이 일반 회원으로 전환된 시각
    private LocalDateTime convertedAt;

    @CreationTimestamp  // 계정 생성 시각
    @Column(name = "crated_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp    // 계정 정보 마지막 수정 시각
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static User createGuest(String nickname) {   // 게스트 계정이 생성 되었을 때 만들어지는 게스트 객체
        return User.builder()
                .nickname(nickname)
                .accountType(AccountType.GUEST)
                .role(Role.USER)
                .accountStatus(AccountStatus.ACTIVE)
                .build();
    }
}
