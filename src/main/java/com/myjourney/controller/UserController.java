package com.myjourney.controller;

import com.myjourney.dto.AuthResponse;
import com.myjourney.dto.ProfileResponse;
import com.myjourney.model.User;
import com.myjourney.service.UserService;
import com.myjourney.util.JwtUtil;
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
}
