package com.myjourney.service;

import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

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

    public String login(User user) {
        Optional<User> optionalUser = userRepository.findByUsername(user.getUsername());
        if (optionalUser.isPresent() && encoder.matches(user.getPassword(), optionalUser.get().getPassword())) {
            return "Login successful";
        }
        return "Login failed";
    }
}
