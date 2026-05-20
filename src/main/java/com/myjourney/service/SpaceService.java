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
import com.myjourney.model.SpacePost;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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

    @Autowired
    private CloudStorageService cloudStorageService;

    @Autowired
    private SpacePostRepository spacePostRepository;

    @Autowired
    private AiService aiService;

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

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode(), space.getCoverImage());
    }

    // Join a space via invite code
    @Transactional
    public SpaceResponse joinSpace(Integer userId, String inviteCode) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        Space space = spaceRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "Invalid invite code"));

        // Personal spaces have invite_code=NULL, so they shouldn't reach here,
        // but reject defensively in case someone crafts a request.
        if (space.isPersonal()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Cannot join a personal space");
        }

        if (spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Already a member of this space");
        }

        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(user);
        member.setRole(Role.MEMBER);
        spaceMemberRepository.save(member);

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode(), space.getCoverImage());
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
        if (space.isPersonal()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Personal spaces cannot be renamed");
        }

        if (name != null && !name.isBlank()) space.setName(name);
        if (description != null) space.setDescription(description);
        spaceRepository.save(space);

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode(), space.getCoverImage());
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

    // Kick a member from a space — owner only, cannot kick self
    @Transactional
    public void kickMember(Integer spaceId, Integer ownerId, Integer targetUserId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        if (!space.getOwner().getId().equals(ownerId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the owner can remove members");
        }
        if (space.isPersonal()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Personal spaces have no other members");
        }

        if (ownerId.equals(targetUserId)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Owner cannot remove themselves");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        SpaceMember member = spaceMemberRepository.findBySpaceAndUser(space, target)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "User is not a member of this space"));

        spaceMemberRepository.delete(member);
    }

    // Delete a space — owner only
    @Transactional
    public void deleteSpace(Integer spaceId, Integer userId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        if (!space.getOwner().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the owner can delete this space");
        }
        if (space.isPersonal()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Personal spaces cannot be deleted");
        }

        spaceRepository.delete(space);
    }

    // Generate AI summary of recent space activity — accessible to all members
    public String generateAiSummary(Integer spaceId, Integer userId) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        if (!spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }
        List<SpacePost> posts = spacePostRepository.findTop30BySpaceOrderByCreatedAtDesc(space);
        if (posts.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "No posts to summarize yet");
        }
        return aiService.generateSpaceSummary(space.getName(), posts);
    }

    // Upload or replace cover image — owner only
    @Transactional
    public SpaceResponse updateCoverImage(Integer spaceId, Integer userId, MultipartFile coverFile) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        if (!space.getOwner().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the owner can update the cover image");
        }

        String url = cloudStorageService.uploadFile(coverFile, "my-journey/space-covers");
        space.setCoverImage(url);
        spaceRepository.save(space);

        return new SpaceResponse(space.getId(), space.getName(), space.getDescription(), space.getInviteCode(), space.getCoverImage());
    }

    // Auto-create the user's personal space on signup.
    // Called by UserService.register and CustomOAuth2UserService for new accounts.
    // Idempotent: returns the existing personal space if one already exists.
    @Transactional
    public Space createPersonalSpace(User owner) {
        Optional<Space> existing = spaceRepository.findFirstByOwnerAndPersonalTrue(owner);
        if (existing.isPresent()) return existing.get();

        Space space = new Space();
        space.setName("Personal");
        space.setOwner(owner);
        space.setPersonal(true);
        // invite_code stays NULL — personal spaces are not joinable by code.
        spaceRepository.save(space);

        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(owner);
        member.setRole(Role.OWNER);
        spaceMemberRepository.save(member);

        return space;
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
