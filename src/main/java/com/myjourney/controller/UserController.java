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

    @PostMapping("reset-password")
    public String resetPassword(@RequestBody Map<String, String> map) {
        String username = map.get("username");
        String newPassword = map.get("newPassword");
        return userService.resetPassword(username, newPassword);
    }
}
