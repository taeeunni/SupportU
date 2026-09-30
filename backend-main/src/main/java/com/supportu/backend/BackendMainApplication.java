package com.supportu.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class BackendMainApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendMainApplication.class, args);
	}

}