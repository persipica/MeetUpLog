package com.log.MeetupLog.domain.user.presence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenceEvent {
    private Long userId;
    private Long id;
    private String identity;
    private String presence;
    private Instant changedAt;
}
