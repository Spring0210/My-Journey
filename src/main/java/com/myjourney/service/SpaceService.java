package com.myjourney.service;

import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.SpaceMember.Role;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@Service
public class SpaceService {

    private static final String INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private SpaceMemberRepository spaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    // Create a new space, creator becomes OWNER
    @Transactional
    public Map<String, Object> createSpace(Integer userId, String name, String description) {
        Map<String, Object> response = new HashMap<>();

        User owner = userRepository.findById(userId).orElse(null);
        if (owner == null) {
            response.put("error", "User not found");
            return response;
        }

        Space space = new Space();
        space.setName(name);
        space.setDescription(description);
        space.setOwner(owner);
        space.setInviteCode(generateUniqueInviteCode());
        spaceRepository.save(space);

        // Add owner as a member with OWNER role
        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(owner);
        member.setRole(Role.OWNER);
        spaceMemberRepository.save(member);

        response.put("id", space.getId());
        response.put("name", space.getName());
        response.put("description", space.getDescription());
        response.put("inviteCode", space.getInviteCode());
        return response;
    }

    // Join a space via invite code
    @Transactional
    public Map<String, Object> joinSpace(Integer userId, String inviteCode) {
        Map<String, Object> response = new HashMap<>();

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            response.put("error", "User not found");
            return response;
        }

        Optional<Space> spaceOpt = spaceRepository.findByInviteCode(inviteCode.toUpperCase());
        if (spaceOpt.isEmpty()) {
            response.put("error", "Invalid invite code");
            return response;
        }

        Space space = spaceOpt.get();

        if (spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            response.put("error", "Already a member of this space");
            return response;
        }

        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(user);
        member.setRole(Role.MEMBER);
        spaceMemberRepository.save(member);

        response.put("id", space.getId());
        response.put("name", space.getName());
        response.put("description", space.getDescription());
        return response;
    }

    // Get all spaces the user belongs to
    public List<Map<String, Object>> getMySpaces(Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        List<SpaceMember> memberships = spaceMemberRepository.findByUser(user);

        return memberships.stream().map(m -> {
            Map<String, Object> item = new HashMap<>();
            Space s = m.getSpace();
            item.put("id", s.getId());
            item.put("name", s.getName());
            item.put("description", s.getDescription());
            item.put("coverImage", s.getCoverImage());
            item.put("inviteCode", s.getInviteCode());
            item.put("role", m.getRole().name());
            item.put("ownerUsername", s.getOwner().getUsername());
            return item;
        }).toList();
    }

    // Get space detail (only accessible to members)
    public Map<String, Object> getSpaceDetail(Integer spaceId, Integer userId) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            response.put("error", "Access denied");
            return response;
        }

        List<Map<String, Object>> members = spaceMemberRepository.findBySpace(space).stream().map(m -> {
            Map<String, Object> memberInfo = new HashMap<>();
            memberInfo.put("userId", m.getUser().getId());
            memberInfo.put("username", m.getUser().getUsername());
            memberInfo.put("role", m.getRole().name());
            memberInfo.put("joinedAt", m.getJoinedAt());
            return memberInfo;
        }).toList();

        response.put("id", space.getId());
        response.put("name", space.getName());
        response.put("description", space.getDescription());
        response.put("coverImage", space.getCoverImage());
        response.put("inviteCode", space.getInviteCode());
        response.put("ownerUsername", space.getOwner().getUsername());
        response.put("members", members);
        return response;
    }

    // Update space name and description (owner only)
    @Transactional
    public Map<String, Object> updateSpace(Integer spaceId, Integer userId, String name, String description) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        if (!space.getOwner().getId().equals(userId)) {
            response.put("error", "Only the owner can edit this space");
            return response;
        }

        if (name != null && !name.isBlank()) space.setName(name);
        if (description != null) space.setDescription(description);
        spaceRepository.save(space);

        response.put("id", space.getId());
        response.put("name", space.getName());
        response.put("description", space.getDescription());
        return response;
    }

    // Leave a space (owner cannot leave, must delete)
    @Transactional
    public Map<String, Object> leaveSpace(Integer spaceId, Integer userId) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        Optional<SpaceMember> memberOpt = spaceMemberRepository.findBySpaceAndUser(space, user);
        if (memberOpt.isEmpty()) {
            response.put("error", "Not a member of this space");
            return response;
        }

        if (memberOpt.get().getRole() == Role.OWNER) {
            response.put("error", "Owner cannot leave. Delete the space instead.");
            return response;
        }

        spaceMemberRepository.delete(memberOpt.get());
        response.put("message", "Left space successfully");
        return response;
    }

    // Delete a space (owner only)
    @Transactional
    public Map<String, Object> deleteSpace(Integer spaceId, Integer userId) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        if (!space.getOwner().getId().equals(userId)) {
            response.put("error", "Only the owner can delete this space");
            return response;
        }

        spaceRepository.delete(space);
        response.put("message", "Space deleted successfully");
        return response;
    }

    private String generateUniqueInviteCode() {
        String code;
        do {
            code = generateCode();
        } while (spaceRepository.findByInviteCode(code).isPresent());
        return code;
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            sb.append(INVITE_CODE_CHARS.charAt(random.nextInt(INVITE_CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
