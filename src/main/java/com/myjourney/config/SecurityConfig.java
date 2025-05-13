package com.myjourney.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // 关闭 CSRF（适合 API）
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/**").permitAll()  // 放行 /api/ 路径
                        .anyRequest().authenticated()            // 其他需要认证
                )
                .httpBasic(Customizer.withDefaults()); // 使用基本模式，防止报错

        return http.build();
    }
}
