package com.log.MeetupLog.global.error;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        String code,
        String message,
        String field,
        LocalDateTime timestamp
) {
    public static ApiErrorResponse of(String code, String message, String field) {
        return new ApiErrorResponse(code, message, field, LocalDateTime.now());
    }
}
