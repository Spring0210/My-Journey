package com.myjourney.testsupport;

import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.User;
import com.myjourney.repository.DocumentRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;

import java.util.ArrayList;
import java.util.UUID;

// Reusable test fixture for agent-toolset integration tests.
// Names are randomized so tests can run inside a single @Transactional rollback
// against the dev MySQL without colliding on the User.username unique index when
// a previous run's rollback didn't propagate (e.g. abrupt JVM shutdown).
public final class AgentTestFixture {

    public final User user1;
    public final User user2;
    public final Space space1;
    public final Space space2;

    private AgentTestFixture(User user1, User user2, Space space1, Space space2) {
        this.user1 = user1;
        this.user2 = user2;
        this.space1 = space1;
        this.space2 = space2;
    }

    // Two users, two non-personal spaces. user1 owns space1, user2 owns space2.
    // Each space has one NOTE document whose title contains "alpha".
    public static AgentTestFixture createTwoUsersTwoSpacesAlpha(
            UserRepository userRepo,
            SpaceRepository spaceRepo,
            SpaceMemberRepository memberRepo,
            DocumentRepository docRepo) {

        User u1 = saveUser(userRepo, "alice");
        User u2 = saveUser(userRepo, "bob");
        Space s1 = saveSpace(spaceRepo, u1, "space-one");
        Space s2 = saveSpace(spaceRepo, u2, "space-two");
        saveOwnerMember(memberRepo, s1, u1);
        saveOwnerMember(memberRepo, s2, u2);
        saveDoc(docRepo, s1, u1, "alpha doc in s1");
        saveDoc(docRepo, s2, u2, "alpha doc in s2");
        return new AgentTestFixture(u1, u2, s1, s2);
    }

    public static User saveUser(UserRepository repo, String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User u = new User();
        u.setUsername(prefix + "-" + suffix);
        u.setEmail(prefix + "-" + suffix + "@example.test");
        u.setPassword("test-pwd");
        return repo.save(u);
    }

    public static Space saveSpace(SpaceRepository repo, User owner, String prefix) {
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        Space s = new Space();
        s.setName(prefix + "-" + suffix);
        s.setOwner(owner);
        // 8-char invite code (matches the V2 column width) ensures the unique
        // index is satisfied even with many concurrent test runs.
        s.setInviteCode(suffix + UUID.randomUUID().toString().substring(0, 2));
        s.setPersonal(false);
        return repo.save(s);
    }

    public static Space savePersonalSpace(SpaceRepository repo, User owner) {
        Space s = new Space();
        s.setName("Personal");
        s.setOwner(owner);
        s.setPersonal(true);
        // invite_code stays null -- personal spaces are not joinable by code.
        return repo.save(s);
    }

    public static void saveOwnerMember(SpaceMemberRepository repo, Space space, User user) {
        SpaceMember m = new SpaceMember();
        m.setSpace(space);
        m.setUser(user);
        m.setRole(SpaceMember.Role.OWNER);
        repo.save(m);
    }

    public static Document saveDoc(DocumentRepository repo, Space space, User author, String title) {
        Document d = new Document();
        d.setSpace(space);
        d.setAuthor(author);
        d.setTitle(title);
        d.setContent("body of " + title);
        d.setDocType(Document.DocType.NOTE);
        d.setTags(new ArrayList<>());
        return repo.save(d);
    }
}
