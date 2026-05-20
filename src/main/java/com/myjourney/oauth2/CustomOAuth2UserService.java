package com.myjourney.oauth2;

import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.SpaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SpaceService spaceService;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User googleUser = super.loadUser(request);

        String googleId = googleUser.getName(); // Google subject ID
        String email    = googleUser.getAttribute("email");
        String name     = googleUser.getAttribute("name");
        String picture  = googleUser.getAttribute("picture");

        // 1. Try to find by Google subject ID (repeat sign-ins)
        Optional<User> byGoogleId = userRepository.findByGoogleId(googleId);
        if (byGoogleId.isPresent()) {
            User user = byGoogleId.get();
            // Keep avatar in sync with Google if the user has no custom avatar
            if (user.getAvatar() == null && picture != null) {
                user.setAvatar(picture);
                userRepository.save(user);
            }
            return new CustomOAuth2User(googleUser, user.getId(), user.getUsername(), user.getAvatar());
        }

        // 2. First Google sign-in — link to an existing account by email, or create a new one
        Optional<User> byEmail = userRepository.findByEmail(email);
        User user;
        if (byEmail.isPresent()) {
            // Link the Google ID to the existing password-based account
            user = byEmail.get();
            user.setGoogleId(googleId);
            if (user.getAvatar() == null && picture != null) {
                user.setAvatar(picture);
            }
            userRepository.save(user);
        } else {
            // Create a brand-new user for this Google account
            user = new User();
            user.setGoogleId(googleId);
            user.setEmail(email);
            user.setUsername(generateUniqueUsername(email, name));
            user.setAvatar(picture);
            // No password — this user can only sign in via Google
            userRepository.save(user);
        }

        // Auto-provision a personal space for any first-time sign-in if missing.
        // For users created before this pivot, V4 backfilled this — but the
        // call is idempotent so we keep it as a safety net.
        spaceService.createPersonalSpace(user);

        return new CustomOAuth2User(googleUser, user.getId(), user.getUsername(), user.getAvatar());
    }

    // Derive a unique username from the Google email prefix; append numbers on conflict
    private String generateUniqueUsername(String email, String displayName) {
        String base = email != null
                ? email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9]", "")
                : displayName.toLowerCase().replaceAll("[^a-z0-9]", "");

        if (base.isEmpty()) base = "user";

        if (userRepository.findByUsername(base).isEmpty()) return base;

        int i = 2;
        while (userRepository.findByUsername(base + i).isPresent()) i++;
        return base + i;
    }
}
