package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.dto.profile.ConvertGuestRequest;
import com.log.MeetupLog.domain.user.dto.profile.GuestConversionResponse;
import com.log.MeetupLog.domain.user.dto.profile.UpdateMyProfileRequest;
import com.log.MeetupLog.domain.user.dto.profile.UserProfileResponse;
import com.log.MeetupLog.domain.user.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping
    public UserProfileResponse getMyProfile(@AuthenticationPrincipal Long userId) {
        return userProfileService.getMyProfile(userId);
    }

    @PatchMapping
    public UserProfileResponse updateMyProfile(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody UpdateMyProfileRequest request
    ) {
        return userProfileService.updateMyProfile(userId, request);
    }

    @PostMapping("/profile-image")
    public UserProfileResponse uploadProfileImage(
            @AuthenticationPrincipal Long userId,
            @RequestPart("file") MultipartFile file
    ) {
        return userProfileService.uploadProfileImage(userId, file);
    }

    @DeleteMapping("/profile-image")
    public UserProfileResponse removeProfileImage(@AuthenticationPrincipal Long userId) {
        return userProfileService.removeProfileImage(userId);
    }

    @PostMapping("/convert")
    public GuestConversionResponse convertGuest(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ConvertGuestRequest request
    ) {
        return userProfileService.convertGuest(userId, request);
    }

    @DeleteMapping("/kakao-link")
    public ResponseEntity<Void> unlinkKakao(@AuthenticationPrincipal Long userId) {
        userProfileService.unlinkKakao(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> withdrawMember(@AuthenticationPrincipal Long userId) {
        userProfileService.withdrawMember(userId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
