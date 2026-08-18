package com.log.MeetupLog.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class OAuth2CodeExchangeRequest {

    @NotBlank
    private String code;
}