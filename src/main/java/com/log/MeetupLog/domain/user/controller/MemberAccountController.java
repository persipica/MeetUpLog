package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.dto.profile.ChangePasswordRequest;
import com.log.MeetupLog.domain.user.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/members/me")
@RequiredArgsConstructor
public class MemberAccountController {

    private final UserProfileService userProfileService;

    @PatchMapping("/password")
    public Map<String, String> changePassword(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        return userProfileService.changePassword(userId, request);
    }
}
