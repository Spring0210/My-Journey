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
import jakarta.servlet.http.HttpServletResponse;

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
                .requestMatchers("/api/login", "/api/register", "/api/register/send-code",
                                 "/api/forgot-password", "/api/reset-password",
                                 "/api/auth/refresh", "/api/auth/logout").permitAll()
                .requestMatchers("/api/profile/**").authenticated()
                .requestMatchers("/", "/login.html", "/register.html", "/forgot-password.html",
                               "/journals.html", "/calendar.html", "/day.html", "/detail.html",
                               "/spaces.html", "/space.html", "/dashboard.html", "/profile.html",
                               "/notifications.html", "/oauth2-callback.html").permitAll()
                .requestMatchers("/css/**", "/js/**", "/uploads/**", "/static/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                // Health endpoint used by the CI deploy gate; returns {"status":"UP"}.
                // Only /actuator/health is exposed — other actuator endpoints stay locked.
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/entries/**").authenticated()
                .requestMatchers("/api/spaces/**").authenticated()
                .requestMatchers("/api/notifications/**").authenticated()
                .requestMatchers("/api/media/**").authenticated()
                .requestMatchers("/api/documents/**").authenticated()
                .anyRequest().permitAll()
            )
            .exceptionHandling(ex -> ex
                // Return 401 JSON for unauthenticated API requests instead of redirecting to the login page.
                // Without this, Spring Security redirects to /login, fetch follows the redirect,
                // gets index.html (200), and the frontend never triggers its token-refresh logic.
                .authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    res.setContentType("application/json");
                    res.getWriter().write("{\"error\":\"Unauthorized\"}");
                })
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
