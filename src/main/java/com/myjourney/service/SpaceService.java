package com.myjourney.service;

import com.myjourney.dto.MemberInfo;
import com.myjourney.dto.SpaceDetailResponse;
import com.myjourney.dto.SpaceResponse;
import com.myjourney.dto.SpaceSummaryResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.SpaceMember.Role;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
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

    // Create a new space; the creator becomes OWNER
    @Transactional
    public SpaceResponse createSpace(Integer userId, String name, String description) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

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

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode());
    }

    // Join a space via invite code
    @Transactional
    public SpaceResponse joinSpace(Integer userId, String inviteCode) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        Space space = spaceRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "Invalid invite code"));

        if (spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Already a member of this space");
        }

        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(user);
        member.setRole(Role.MEMBER);
        spaceMemberRepository.save(member);

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode());
    }

    // Get all spaces the user belongs to
    public List<SpaceSummaryResponse> getMySpaces(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        return spaceMemberRepository.findByUser(user).stream().map(m -> {
            Space s = m.getSpace();
            return new SpaceSummaryResponse(
                    s.getId(), s.getName(), s.getDescription(),
                    s.getCoverImage(), s.getInviteCode(),
                    m.getRole().name(), s.getOwner().getUsername());
        }).toList();
    }

    // Get space detail — accessible to members only
    public SpaceDetailResponse getSpaceDetail(Integer spaceId, Integer userId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (!spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        List<MemberInfo> members = spaceMemberRepository.findBySpace(space).stream().map(m ->
                new MemberInfo(
                        m.getUser().getId(),
                        m.getUser().getUsername(),
                        m.getUser().getAvatar(), // include avatar for frontend display
                        m.getRole().name(),
                        m.getJoinedAt())
        ).toList();

        return new SpaceDetailResponse(
                space.getId(), space.getName(), space.getDescription(),
                space.getCoverImage(), space.getInviteCode(),
                space.getOwner().getUsername(), members);
    }

    // Update space name and description — owner only
    @Transactional
    public SpaceResponse updateSpace(Integer spaceId, Integer userId, String name, String description) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        if (!space.getOwner().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the owner can edit this space");
        }

        if (name != null && !name.isBlank()) space.setName(name);
        if (description != null) space.setDescription(description);
        spaceRepository.save(space);

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode());
    }

    // Leave a space — owner cannot leave, must delete instead
    @Transactional
    public void leaveSpace(Integer spaceId, Integer userId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        Optional<SpaceMember> memberOpt = spaceMemberRepository.findBySpaceAndUser(space, user);
        if (memberOpt.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Not a member of this space");
        }
        if (memberOpt.get().getRole() == Role.OWNER) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Owner cannot leave. Delete the space instead.");
        }

        spaceMemberRepository.delete(memberOpt.get());
    }

    // Delete a space — owner only
    @Transactional
    public void deleteSpace(Integer spaceId, Integer userId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        if (!space.getOwner().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the owner can delete this space");
        }

        spaceRepository.delete(space);
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
