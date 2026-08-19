package com.log.MeetupLog.global.error;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException exception) {
        return ResponseEntity
                .status(exception.getStatus())
                .body(ApiErrorResponse.of(
                        exception.getCode(),
                        exception.getMessage(),
                        exception.getField()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        var error = exception.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String field = error == null ? null : error.getField();
        String message = error == null ? "입력값을 확인해 주세요." : error.getDefaultMessage();

        return ResponseEntity.badRequest()
                .body(ApiErrorResponse.of("VALIDATION_ERROR", message, field));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleUploadSize(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiErrorResponse.of(
                        "PROFILE_IMAGE_TOO_LARGE",
                        "프로필 이미지는 5MB 이하만 업로드할 수 있습니다.",
                        "file"
                ));
    }
}
