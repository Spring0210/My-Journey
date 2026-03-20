package com.myjourney.service;

import com.myjourney.model.PasswordResetToken;
import com.myjourney.model.User;
import com.myjourney.repository.PasswordResetTokenRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.util.JwtUtil;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.regex.Pattern;

@Service
public class UserService {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Value("${resend.from}")
    private String fromEmail;

    public String register(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return "Username already exists";
        }
        if (user.getEmail() == null || !EMAIL_PATTERN.matcher(user.getEmail()).matches()) {
            return "Invalid email address";
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userRepository.save(user);
        return "Registration successful";
    }

    public Map<String, Object> login(User user) {
        Map<String, Object> response = new HashMap<>();

        Optional<User> existingUser = userRepository.findByUsername(user.getUsername());
        if (existingUser.isEmpty()) {
            response.put("error", "Invalid credentials");
            return response;
        }

        User dbUser = existingUser.get();
        if (!passwordEncoder.matches(user.getPassword(), dbUser.getPassword())) {
            response.put("error", "Invalid credentials");
            return response;
        }

        String token = jwtUtil.generateToken(user.getUsername(), dbUser.getId());

        response.put("message", "Login successful");
        response.put("token", token);
        response.put("username", dbUser.getUsername());
        response.put("userId", dbUser.getId());

        return response;
    }

    @Transactional
    public String sendResetCode(String username, String email) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "User not found";
        }

        User user = userOpt.get();
        if (user.getEmail() == null || !user.getEmail().equalsIgnoreCase(email)) {
            return "Email does not match";
        }

        // Delete any existing token for this user
        tokenRepository.deleteByUsername(username);

        // Generate 6-digit code
        String code = String.format("%06d", new Random().nextInt(1000000));

        PasswordResetToken token = new PasswordResetToken();
        token.setUsername(username);
        token.setCode(code);
        token.setExpiredAt(LocalDateTime.now().plusMinutes(10));
        tokenRepository.save(token);

        // Send email via Resend
        try {
            Resend resend = new Resend(resendApiKey);
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromEmail)
                    .to(email)
                    .subject("My Journey - Password Reset Code")
                    .text("Your password reset code is: " + code + "\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.")
                    .build();
            resend.emails().send(params);
        } catch (ResendException e) {
            return "Failed to send email, please try again later";
        }

        return "Code sent";
    }

    @Transactional
    public String verifyAndResetPassword(String username, String code, String newPassword) {
        Optional<PasswordResetToken> tokenOpt = tokenRepository.findByUsernameAndCode(username, code);
        if (tokenOpt.isEmpty()) {
            return "Invalid code";
        }

        PasswordResetToken token = tokenOpt.get();
        if (token.getExpiredAt().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(token);
            return "Code has expired";
        }

        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            return "User not found";
        }

        User user = userOpt.get();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        tokenRepository.delete(token);

        return "Password reset successful";
    }
}
