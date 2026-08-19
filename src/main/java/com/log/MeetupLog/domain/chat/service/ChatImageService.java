package com.log.MeetupLog.domain.chat.service;

import com.log.MeetupLog.domain.chat.dto.ChatImageResponse;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatImageService {

    private static final long MAX_IMAGE_SIZE = 10L * 1024L * 1024L;
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/gif", ".gif",
            "image/webp", ".webp"
    );

    private final ChatRoomMemberRepository memberRepository;

    @Value("${app.chat.upload-dir:./uploads/chat}")
    private String uploadDirectory;

    public ChatImageResponse upload(Long userId, Long roomId, MultipartFile file) {
        if (!memberRepository.existsByRoomIdAndUserIdAndStatus(roomId, userId, MemberStatus.ACTIVE)) {
            throw new IllegalStateException("참여 중인 채팅방에만 이미지를 보낼 수 있습니다.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("업로드할 이미지를 선택해 주세요.");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new IllegalArgumentException("이미지는 10MB 이하만 보낼 수 있습니다.");
        }

        String mimeType = file.getContentType();
        String extension = EXTENSIONS.get(mimeType);
        if (extension == null) {
            throw new IllegalArgumentException("JPG, PNG, GIF, WEBP 이미지만 보낼 수 있습니다.");
        }

        String storedName = UUID.randomUUID() + extension;
        Path root = Path.of(uploadDirectory).toAbsolutePath().normalize();
        Path destination = root.resolve(storedName).normalize();

        if (!destination.startsWith(root)) {
            throw new IllegalArgumentException("올바르지 않은 파일 이름입니다.");
        }

        try {
            Files.createDirectories(root);
            file.transferTo(destination);
        } catch (IOException exception) {
            throw new IllegalStateException("이미지를 저장하지 못했습니다.", exception);
        }

        return ChatImageResponse.builder()
                .imageUrl("/api/v1/chat/images/" + storedName)
                .fileName(safeOriginalName(file.getOriginalFilename()))
                .mimeType(mimeType)
                .size(file.getSize())
                .build();
    }

    public StoredImage load(String storedName) {
        if (storedName == null || !storedName.matches("[0-9a-fA-F-]+\\.(jpg|png|gif|webp)")) {
            throw new IllegalArgumentException("올바르지 않은 이미지 경로입니다.");
        }

        Path root = Path.of(uploadDirectory).toAbsolutePath().normalize();
        Path path = root.resolve(storedName).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path)) {
            throw new IllegalArgumentException("이미지를 찾을 수 없습니다.");
        }

        try {
            String mimeType = Files.probeContentType(path);
            return new StoredImage(new FileSystemResource(path), mimeType == null
                    ? "application/octet-stream"
                    : mimeType);
        } catch (IOException exception) {
            throw new IllegalStateException("이미지를 읽지 못했습니다.", exception);
        }
    }

    private String safeOriginalName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "사진";
        }
        String fileName = Path.of(originalName).getFileName().toString();
        return fileName.length() > 255 ? fileName.substring(0, 255) : fileName;
    }

    public record StoredImage(Resource resource, String mimeType) {
    }
}
