package com.myjourney.controller;

import com.myjourney.dto.AuthResponse;
import com.myjourney.dto.ProfileResponse;
import com.myjourney.model.RefreshToken;
import com.myjourney.model.User;
import com.myjourney.service.RefreshTokenService;
import com.myjourney.service.UserService;
import com.myjourney.repository.UserRepository;
import com.myjourney.exception.AppException;
import com.myjourney.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    private Integer getJwtUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        try {
            return jwtUtil.extractUserId(authHeader.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    @PostMapping("/register")
    public String register(@RequestBody User user) {
        return userService.register(user);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody Map<String, String> body) {
        // AppException thrown by service is caught by GlobalExceptionHandler
        return userService.login(body.get("identifier"), body.get("password"));
    }

    @PutMapping("/profile/{userId}")
    public ProfileResponse updateProfile(
            @PathVariable Integer userId,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) MultipartFile avatar) {
        return userService.updateProfile(userId, username, avatar);
    }

    // POST /api/change-password/send-code — send code to logged-in user's email
    @PostMapping("/change-password/send-code")
    public ResponseEntity<Void> sendChangePasswordCode(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        userService.sendChangePasswordCode(userId);
        return ResponseEntity.ok().build();
    }

    // PUT /api/change-password — verify code and set new password
    @PutMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        userService.changePasswordWithCode(userId, body.get("code"), body.get("newPassword"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/forgot-password")
    public String forgotPassword(@RequestBody Map<String, String> map) {
        return userService.sendResetCode(map.get("username"), map.get("email"));
    }

    @PostMapping("/reset-password")
    public String resetPassword(@RequestBody Map<String, String> map) {
        return userService.verifyAndResetPassword(map.get("username"), map.get("code"), map.get("newPassword"));
    }

    // POST /api/auth/refresh — exchange a valid refresh token for a new access token + rotated refresh token
    @PostMapping("/auth/refresh")
    public AuthResponse refresh(@RequestBody Map<String, String> body) {
        String tokenValue = body.get("refreshToken");
        if (tokenValue == null || tokenValue.isBlank()) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Refresh token is required");
        }

        // Verify token and rotate (old token deleted, new one issued)
        RefreshToken old = refreshTokenService.verifyToken(tokenValue);
        RefreshToken newRt = refreshTokenService.rotateToken(old);

        // Look up user to build the response
        var user = userRepository.findById(old.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "User not found"));

        String newAccessToken = jwtUtil.generateToken(user.getId(), user.getUsername());
        return new AuthResponse(newAccessToken, newRt.getToken(), user.getUsername(), user.getId(), user.getAvatar());
    }

    // POST /api/auth/logout — revoke the refresh token (explicit logout)
    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(@RequestBody Map<String, String> body) {
        String tokenValue = body.get("refreshToken");
        if (tokenValue != null && !tokenValue.isBlank()) {
            try {
                RefreshToken rt = refreshTokenService.verifyToken(tokenValue);
                refreshTokenService.deleteByUserId(rt.getUserId());
            } catch (Exception ignored) {
                // Token already expired or invalid — treat as already logged out
            }
        }
        return ResponseEntity.ok().build();
    }
}
