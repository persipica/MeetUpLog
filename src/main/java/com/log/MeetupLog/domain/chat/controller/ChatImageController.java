package com.log.MeetupLog.domain.chat.controller;

import com.log.MeetupLog.domain.chat.dto.ChatImageResponse;
import com.log.MeetupLog.domain.chat.service.ChatImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ChatImageController {

    private final ChatImageService imageService;

    @PostMapping(value = "/rooms/{roomId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChatImageResponse> upload(
            @AuthenticationPrincipal Long userId,
            @PathVariable("roomId") Long roomId,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(imageService.upload(userId, roomId, file));
    }

    @GetMapping("/chat/images/{fileName:.+}")
    public ResponseEntity<Resource> image(@PathVariable("fileName") String fileName) {
        ChatImageService.StoredImage image = imageService.load(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.mimeType()))
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .body(image.resource());
    }
}
