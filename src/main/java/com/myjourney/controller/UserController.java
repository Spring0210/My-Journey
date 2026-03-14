package com.myjourney.controller;

import com.myjourney.model.User;
import com.myjourney.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

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
    public Map<String, Object> login(@RequestBody User user) {
        return userService.login(user);
    }

    // Step 1: Send reset code to email
    @PostMapping("/forgot-password")
    public String forgotPassword(@RequestBody Map<String, String> map) {
        String username = map.get("username");
        String email = map.get("email");
        return userService.sendResetCode(username, email);
    }

    // Step 2: Verify code and reset password
    @PostMapping("/reset-password")
    public String resetPassword(@RequestBody Map<String, String> map) {
        String username = map.get("username");
        String code = map.get("code");
        String newPassword = map.get("newPassword");
        return userService.verifyAndResetPassword(username, code, newPassword);
    }
}
