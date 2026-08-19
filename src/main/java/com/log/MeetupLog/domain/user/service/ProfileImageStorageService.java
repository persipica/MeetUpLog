package com.log.MeetupLog.domain.user.service;

import com.log.MeetupLog.global.error.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ProfileImageStorageService {

    private static final long MAX_FILE_SIZE = 5L * 1024L * 1024L;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final String PUBLIC_PREFIX = "/api/v1/profile-images/";

    private final Path uploadDirectory;

    public ProfileImageStorageService(
            @Value("${app.profile.upload-dir:uploads/profile}") String uploadDirectory
    ) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) {
        validate(file);

        String extension = "image/png".equals(file.getContentType()) ? ".png" : ".jpg";
        String storedFileName = UUID.randomUUID() + extension;
        Path target = resolve(storedFileName);

        try {
            Files.createDirectories(uploadDirectory);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "PROFILE_IMAGE_SAVE_FAILED",
                    "프로필 이미지를 저장하지 못했습니다."
            );
        }

        return PUBLIC_PREFIX + storedFileName;
    }

    public byte[] read(String fileName) {
        Path file = resolve(fileName);

        if (!Files.isRegularFile(file)) {
            throw new ApiException(
                    HttpStatus.NOT_FOUND,
                    "PROFILE_IMAGE_NOT_FOUND",
                    "프로필 이미지를 찾을 수 없습니다."
            );
        }

        try {
            return Files.readAllBytes(file);
        } catch (IOException exception) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "PROFILE_IMAGE_READ_FAILED",
                    "프로필 이미지를 읽지 못했습니다."
            );
        }
    }

    public String detectContentType(String fileName) {
        String lower = fileName.toLowerCase(Locale.ROOT);
        return lower.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    public void deleteByPublicUrl(String profileImageUrl) {
        if (profileImageUrl == null || !profileImageUrl.startsWith(PUBLIC_PREFIX)) {
            return;
        }

        String fileName = profileImageUrl.substring(PUBLIC_PREFIX.length());
        try {
            Files.deleteIfExists(resolve(fileName));
        } catch (IOException ignored) {
            // DB 변경은 정상 처리하고, 남은 파일은 운영 정리 작업에서 제거합니다.
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "PROFILE_IMAGE_EMPTY",
                    "업로드할 프로필 이미지를 선택해 주세요.",
                    "file"
            );
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "PROFILE_IMAGE_TOO_LARGE",
                    "프로필 이미지는 5MB 이하만 업로드할 수 있습니다.",
                    "file"
            );
        }

        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PROFILE_IMAGE_TYPE",
                    "JPG 또는 PNG 이미지만 업로드할 수 있습니다.",
                    "file"
            );
        }

        try {
            if (ImageIO.read(file.getInputStream()) == null) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_PROFILE_IMAGE",
                        "올바른 이미지 파일이 아닙니다.",
                        "file"
                );
            }
        } catch (IOException exception) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PROFILE_IMAGE",
                    "이미지 파일을 확인하지 못했습니다.",
                    "file"
            );
        }
    }

    private Path resolve(String fileName) {
        if (fileName == null || !fileName.equals(Path.of(fileName).getFileName().toString())) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PROFILE_IMAGE_PATH",
                    "올바르지 않은 이미지 경로입니다."
            );
        }

        Path resolved = uploadDirectory.resolve(fileName).normalize();
        if (!resolved.startsWith(uploadDirectory)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PROFILE_IMAGE_PATH",
                    "올바르지 않은 이미지 경로입니다."
            );
        }
        return resolved;
    }
}
