package com.myjourney.controller;

import com.myjourney.dto.AuthResponse;
import com.myjourney.dto.ProfileResponse;
import com.myjourney.model.User;
import com.myjourney.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class UserController {

    @Autowired
    private UserService userService;

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

    @PostMapping("/forgot-password")
    public String forgotPassword(@RequestBody Map<String, String> map) {
        return userService.sendResetCode(map.get("username"), map.get("email"));
    }

    @PostMapping("/reset-password")
    public String resetPassword(@RequestBody Map<String, String> map) {
        return userService.verifyAndResetPassword(map.get("username"), map.get("code"), map.get("newPassword"));
    }
}
