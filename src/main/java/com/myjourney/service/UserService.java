package com.myjourney.service;

import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Autowired
    private JwtUtil jwtUtil;

    public String register(User user) {
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return "Username already exists";
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

    public String resetPassword(String username, String newPassword) {
        Optional<User> user = userRepository.findByUsername(username);
        if (user.isEmpty()) {
            return "User not found";
        }
        
        User existingUser = user.get();
        existingUser.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(existingUser);
        return "Password reset successful";
    }
}
