package com.myjourney.config;

import com.myjourney.filter.JwtAuthenticationFilter;
import com.myjourney.oauth2.CustomOAuth2UserService;
import com.myjourney.oauth2.OAuth2AuthenticationSuccessHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private CustomOAuth2UserService customOAuth2UserService;

    @Autowired
    private OAuth2AuthenticationSuccessHandler oAuth2SuccessHandler;
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            // IF_REQUIRED allows sessions for the OAuth2 state flow while keeping API calls stateless
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/login", "/api/register", "/api/forgot-password", "/api/reset-password",
                                 "/api/auth/refresh", "/api/auth/logout").permitAll()
                .requestMatchers("/api/profile/**").authenticated()
                .requestMatchers("/", "/login.html", "/register.html", "/forgot-password.html",
                               "/journals.html", "/calendar.html", "/day.html", "/detail.html",
                               "/spaces.html", "/space.html", "/dashboard.html", "/profile.html",
                               "/notifications.html", "/oauth2-callback.html").permitAll()
                .requestMatchers("/css/**", "/js/**", "/uploads/**", "/static/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/api/entries/**").authenticated()
                .requestMatchers("/api/spaces/**").authenticated()
                .requestMatchers("/api/notifications/**").authenticated()
                .anyRequest().permitAll()
            )
            .oauth2Login(oauth2 -> oauth2
                .loginPage("/login")  // disable Spring's default OAuth2 login page at /login; let SpaController serve React
                .userInfoEndpoint(info -> info.userService(customOAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
                .failureUrl("/login?error=oauth2")
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
}
