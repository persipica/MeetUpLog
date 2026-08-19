package com.log.MeetupLog.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 20)
    @Builder.Default
    private AccountType accountType = AccountType.MEMBER;

    @Column(name = "email", length = 100, unique = true)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "status_message", length = 120)
    private String statusMessage;

    @Column(name = "kakao_id", length = 100, unique = true)
    private String kakaoId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status", nullable = false, length = 20)
    @Builder.Default
    private AccountStatus accountStatus = AccountStatus.ACTIVE;

    @Column(name = "converted_at")
    private LocalDateTime convertedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static User createGuest(String nickname) {
        return User.builder()
                .nickname(nickname)
                .statusMessage("게스트로 참여 중")
                .accountType(AccountType.GUEST)
                .role(Role.USER)
                .accountStatus(AccountStatus.ACTIVE)
                .build();
    }

    public static User createSocial(
            String kakaoId,
            String email,
            String nickname,
            String profileImageUrl
    ) {
        return User.builder()
                .kakaoId(kakaoId)
                .email(email)
                .nickname(nickname)
                .profileImageUrl(profileImageUrl)
                .statusMessage("")
                .accountType(AccountType.SOCIAL)
                .role(Role.USER)
                .accountStatus(AccountStatus.ACTIVE)
                .build();
    }

    public boolean isKakaoAccount() {
        return accountType == AccountType.SOCIAL;
    }

    public boolean isMemberAccount() {
        return accountType == AccountType.MEMBER;
    }

    public boolean isGuestAccount() {
        return accountType == AccountType.GUEST;
    }

    public void changeStatusMessage(String statusMessage) {
        this.statusMessage = statusMessage;
    }

    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    public void changeProfileImage(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public void changePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void convertToMember(String email, String nickname, String passwordHash) {
        if (!isGuestAccount()) {
            throw new IllegalStateException("게스트 계정만 일반 회원으로 전환할 수 있습니다.");
        }

        this.email = email;
        this.nickname = nickname;
        this.passwordHash = passwordHash;
        this.accountType = AccountType.MEMBER;
        this.accountStatus = AccountStatus.ACTIVE;
        this.statusMessage = "";
        this.convertedAt = LocalDateTime.now();
    }

    public void synchronizeKakaoProfile(
            String kakaoId,
            String email,
            String nickname,
            String profileImageUrl
    ) {
        if (!isKakaoAccount()) {
            throw new IllegalStateException("카카오 계정만 카카오 프로필을 동기화할 수 있습니다.");
        }

        this.kakaoId = kakaoId;
        this.email = email;
        this.nickname = nickname;
        this.profileImageUrl = profileImageUrl;
        this.accountStatus = AccountStatus.ACTIVE;
    }

    public void withdraw(String anonymizedEmail, String anonymizedNickname) {
        this.accountStatus = AccountStatus.INACTIVE;
        this.email = anonymizedEmail;
        this.nickname = anonymizedNickname;
        this.passwordHash = null;
        this.profileImageUrl = null;
        this.statusMessage = "";
        this.kakaoId = null;
    }

    public void unlinkKakao(String anonymizedEmail, String anonymizedNickname) {
        if (!isKakaoAccount()) {
            throw new IllegalStateException("카카오 계정이 아닙니다.");
        }

        withdraw(anonymizedEmail, anonymizedNickname);
    }

    /**
     * 기존 ProfileService가 호출하는 호환 메서드입니다.
     * 실제 카카오 API 연동 해제는 KakaoUnlinkClient 호출 후 실행해야 합니다.
     */
    public void unlinkKakao() {
        this.kakaoId = null;
    }

    /**
     * kakaoUserId 명칭을 사용한 코드와의 하위 호환용 별칭입니다.
     */
    public String getKakaoUserId() {
        return kakaoId;
    }
}
