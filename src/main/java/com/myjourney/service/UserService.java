package com.myjourney.service;

import com.myjourney.dto.AuthResponse;
import com.myjourney.dto.ProfileResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.PasswordResetToken;
import com.myjourney.model.RefreshToken;
import com.myjourney.model.User;
import com.myjourney.repository.PasswordResetTokenRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.util.JwtUtil;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
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

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private CloudStorageService cloudStorageService;

    @Value("${resend.api-key}")
    private String resendApiKey;

    @Value("${resend.from}")
    private String fromEmail;

    // Returns a plain string — frontend checks response text for register/password flows
    public String register(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return "Username already exists";
        }
        if (user.getEmail() == null || !EMAIL_PATTERN.matcher(user.getEmail()).matches()) {
            return "Invalid email address";
        }
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return "Email already in use";
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userRepository.save(user);
        return "Registration successful";
    }

    // Throws AppException on failure so the controller stays clean
    public AuthResponse login(String identifier, String password) {
        Optional<User> userOpt = identifier.contains("@")
                ? userRepository.findByEmail(identifier)
                : userRepository.findByUsername(identifier);

        if (userOpt.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid credentials");
        }
        User found = userOpt.get();
        // Google OAuth users have no password — prompt them to use Google sign-in
        if (found.getPassword() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "This account uses Google sign-in. Please sign in with Google.");
        }
        if (!passwordEncoder.matches(password, found.getPassword())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid credentials");
        }

        String token = jwtUtil.generateToken(found.getId(), found.getUsername());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(found.getId());
        return new AuthResponse(token, refreshToken.getToken(), found.getUsername(), found.getId(), found.getAvatar());
    }

    @Transactional
    public ProfileResponse updateProfile(Integer userId, String newUsername, MultipartFile avatarFile) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (newUsername != null && !newUsername.isBlank() && !newUsername.equals(user.getUsername())) {
            if (userRepository.findByUsername(newUsername).isPresent()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "Username already taken");
            }
            user.setUsername(newUsername);
        }

        if (avatarFile != null && !avatarFile.isEmpty()) {
            // Delete old avatar from Cloudinary before uploading the new one
            if (user.getAvatar() != null) {
                cloudStorageService.deleteFile(user.getAvatar());
            }
            String avatarUrl = cloudStorageService.uploadFile(avatarFile, "my-journey/avatars");
            user.setAvatar(avatarUrl);
        }

        userRepository.save(user);
        return new ProfileResponse(user.getUsername(), user.getAvatar());
    }

    // Send a verification code to the logged-in user's registered email
    @Transactional
    public void sendChangePasswordCode(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "No email address on this account");
        }

        // Reuse the same PasswordResetToken table
        tokenRepository.deleteByUsername(user.getUsername());

        String code = String.format("%06d", new Random().nextInt(1000000));
        PasswordResetToken token = new PasswordResetToken();
        token.setUsername(user.getUsername());
        token.setCode(code);
        token.setExpiredAt(LocalDateTime.now().plusMinutes(10));
        tokenRepository.save(token);

        try {
            Resend resend = new Resend(resendApiKey);
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromEmail)
                    .to(user.getEmail())
                    .subject("My Journey - Change Password Code")
                    .text("Your verification code is: " + code + "\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.")
                    .build();
            resend.emails().send(params);
        } catch (ResendException e) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to send email, please try again later");
        }
    }

    // Verify code and set new password for logged-in user
    @Transactional
    public void changePasswordWithCode(Integer userId, String code, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (newPassword == null || newPassword.length() < 6) {
            throw new AppException(HttpStatus.BAD_REQUEST, "New password must be at least 6 characters");
        }

        Optional<PasswordResetToken> tokenOpt = tokenRepository.findByUsernameAndCode(user.getUsername(), code);
        if (tokenOpt.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid verification code");
        }

        PasswordResetToken token = tokenOpt.get();
        if (token.getExpiredAt().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(token);
            throw new AppException(HttpStatus.BAD_REQUEST, "Code has expired");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        tokenRepository.delete(token);
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

        tokenRepository.deleteByUsername(username);

        String code = String.format("%06d", new Random().nextInt(1000000));

        PasswordResetToken token = new PasswordResetToken();
        token.setUsername(username);
        token.setCode(code);
        token.setExpiredAt(LocalDateTime.now().plusMinutes(10));
        tokenRepository.save(token);

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
