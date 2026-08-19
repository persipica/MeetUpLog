package com.log.MeetupLog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@EnableJpaAuditing
@SpringBootApplication
public class MeetupLogApplication {

	public static void main(String[] args) {
		SpringApplication.run(MeetupLogApplication.class, args);
	}

}
