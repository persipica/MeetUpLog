package com.log.MeetupLog.domain.user.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class OAuthExchangeRequest {

    /**
     * 기존 query-string 콜백과의 하위 호환용입니다.
     * 신규 흐름에서는 HttpOnly 쿠키를 사용하므로 null일 수 있습니다.
     */
    private String code;
}
