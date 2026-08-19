package com.log.MeetupLog.domain.user.controller;

import com.log.MeetupLog.domain.user.service.ProfileImageStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/profile-images")
@RequiredArgsConstructor
public class ProfileImageController {

    private final ProfileImageStorageService profileImageStorageService;

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<byte[]> getProfileImage(@PathVariable String fileName) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        profileImageStorageService.detectContentType(fileName)
                ))
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .body(profileImageStorageService.read(fileName));
    }
}
