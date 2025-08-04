package com.myjourney.service;

import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public String register(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return "Username already exists";
        }
        user.setPassword(encoder.encode(user.getPassword()));
        userRepository.save(user);
        return "Registration successful";
    }

    public Map<String, Object> login(User user) {
        Optional<User> optionalUser = userRepository.findByUsername(user.getUsername());
        if (optionalUser.isPresent() && encoder.matches(user.getPassword(), optionalUser.get().getPassword())) {
            Map<String, Object> result = new HashMap<>();
            result.put("message", "Login successful");
            result.put("userId", optionalUser.get().getId());
            result.put("username", user.getUsername());
            return result;
        }
        throw new RuntimeException("Login failed");
    }

    public String resetPassword(String username, String newPassword) {
        Optional<User> optionalUser = userRepository.findByUsername(username);
        if(optionalUser.isPresent()) {
            User user = optionalUser.get();
            user.setPassword(encoder.encode(newPassword));
            userRepository.save(user);
            return "Password reset successful";
        }
        return "User not found";
    }
}
