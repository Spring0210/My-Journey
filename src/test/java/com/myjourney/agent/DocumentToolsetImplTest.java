package com.myjourney.agent;

import com.myjourney.agent.dto.ToolComment;
import com.myjourney.agent.dto.ToolDocumentDetail;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.agent.dto.ToolSpaceSummary;
import com.myjourney.exception.AppException;
import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.repository.DocumentRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.testsupport.AgentTestFixture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Integration tests for the agent toolset's read + write paths. Verifies
// that the impl correctly routes to the underlying services AND that
// space membership is enforced for every tool.
@SpringBootTest
@Transactional
class DocumentToolsetImplTest {

    @Autowired DocumentToolset toolset;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository spaceMemberRepository;
    @Autowired DocumentRepository documentRepository;

    @Test
    void searchDocuments_crossSpace_returnsOnlyMembershipScopedHits() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        ToolSearchResult r = toolset.searchDocuments(
                f.user1.getId(), "alpha", null, null, null, null, 25);

        assertThat(r.hits()).hasSize(1);
        assertThat(r.hits().get(0).spaceId()).isEqualTo(f.space1.getId());
        assertThat(r.hits().get(0).title()).contains("alpha");
    }

    @Test
    void searchDocuments_scopedToSpace_returnsOnlyThatSpacesHits() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        ToolSearchResult r = toolset.searchDocuments(
                f.user1.getId(), "alpha", f.space1.getId(), null, null, null, 25);

        assertThat(r.hits()).hasSize(1);
        assertThat(r.hits().get(0).spaceId()).isEqualTo(f.space1.getId());
    }

    @Test
    void getDocument_returnsDetailForMember() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);
        Long docId = firstDocId(f.space1);

        ToolDocumentDetail d = toolset.getDocument(f.user1.getId(), docId);

        assertThat(d.id()).isEqualTo(docId);
        assertThat(d.spaceId()).isEqualTo(f.space1.getId());
        assertThat(d.docType()).isEqualTo("NOTE");
        assertThat(d.attachments()).isEmpty();
        assertThat(d.recentComments()).isEmpty();
    }

    @Test
    void getDocument_rejectsNonMember() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);
        Long otherSpacesDocId = firstDocId(f.space2);

        // user1 is not a member of space2 -- toolset must refuse.
        assertThatThrownBy(() -> toolset.getDocument(f.user1.getId(), otherSpacesDocId))
                .isInstanceOf(AppException.class);
    }

    @Test
    void listSpaces_returnsOnlyMembershipSpaces() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        List<ToolSpaceSummary> spaces = toolset.listSpaces(f.user1.getId());
        assertThat(spaces).extracting(ToolSpaceSummary::id).contains(f.space1.getId());
        assertThat(spaces).extracting(ToolSpaceSummary::id).doesNotContain(f.space2.getId());
    }

    @Test
    void createDocument_inSharedSpace_isNoteWithNoEntryDate() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        // Shared space -> always NOTE, regardless of what the LLM said.
        // The entry_date arg below is intentionally non-null to prove it
        // gets dropped server-side (entry_date is JOURNAL-only).
        ToolDocumentDetail d = toolset.createDocument(
                f.user1.getId(), "team update", "body",
                f.space1.getId(), java.time.LocalDate.of(2026, 5, 20),
                List.of("topic-a", "topic-b"));

        assertThat(d.id()).isNotNull();
        assertThat(d.spaceId()).isEqualTo(f.space1.getId());
        assertThat(d.docType()).isEqualTo("NOTE");
        assertThat(d.entryDate()).isNull();
        assertThat(d.tags()).containsExactly("topic-a", "topic-b");
    }

    @Test
    void createDocument_inPersonalSpace_isJournalWithTodayWhenEntryDateOmitted() {
        var alice = AgentTestFixture.saveUser(userRepository, "alice");
        var personal = AgentTestFixture.savePersonalSpace(spaceRepository, alice);
        AgentTestFixture.saveOwnerMember(spaceMemberRepository, personal, alice);

        ToolDocumentDetail d = toolset.createDocument(
                alice.getId(), "today reflection", "body",
                personal.getId(), null, null);

        assertThat(d.docType()).isEqualTo("JOURNAL");
        assertThat(d.entryDate()).isEqualTo(java.time.LocalDate.now());
    }

    @Test
    void createDocument_inPersonalSpace_honorsExplicitEntryDate() {
        var alice = AgentTestFixture.saveUser(userRepository, "alice");
        var personal = AgentTestFixture.savePersonalSpace(spaceRepository, alice);
        AgentTestFixture.saveOwnerMember(spaceMemberRepository, personal, alice);

        // User said "log this for 2026-05-15" -> the LLM passes that date.
        java.time.LocalDate userDate = java.time.LocalDate.of(2026, 5, 15);
        ToolDocumentDetail d = toolset.createDocument(
                alice.getId(), "backdated", "body",
                personal.getId(), userDate, null);

        assertThat(d.docType()).isEqualTo("JOURNAL");
        assertThat(d.entryDate()).isEqualTo(userDate);
    }

    @Test
    void createDocument_omittedSpaceId_routesToPersonalSpace() {
        var alice = AgentTestFixture.saveUser(userRepository, "alice");
        var personal = AgentTestFixture.savePersonalSpace(spaceRepository, alice);
        AgentTestFixture.saveOwnerMember(spaceMemberRepository, personal, alice);

        // space_id omitted -> personal space -> JOURNAL invariant still holds.
        ToolDocumentDetail d = toolset.createDocument(
                alice.getId(), "untagged thought", "body",
                null, null, null);

        assertThat(d.spaceId()).isEqualTo(personal.getId());
        assertThat(d.docType()).isEqualTo("JOURNAL");
        assertThat(d.entryDate()).isEqualTo(java.time.LocalDate.now());
    }

    @Test
    void addComment_thenGetComments_roundTrips() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);
        Long docId = firstDocId(f.space1);

        ToolComment added = toolset.addComment(f.user1.getId(), docId, "first!");

        assertThat(added.id()).isNotNull();
        assertThat(added.content()).isEqualTo("first!");

        List<ToolComment> all = toolset.getComments(f.user1.getId(), docId);
        assertThat(all).extracting(ToolComment::content).contains("first!");
    }

    @Test
    void createSpace_returnsNonPersonalSummary_andListsAsMemberSpace() {
        // Start with just a user; no fixture spaces.
        var alice = com.myjourney.testsupport.AgentTestFixture.saveUser(userRepository, "alice");

        ToolSpaceSummary created = toolset.createSpace(
                alice.getId(), "Team KB", "shared notes");

        assertThat(created.id()).isNotNull();
        assertThat(created.name()).isEqualTo("Team KB");
        assertThat(created.isPersonal()).isFalse();
        // Owner is the sole member at creation time.
        assertThat(created.memberCount()).isEqualTo(1);

        // listSpaces must surface the new space to the same user.
        List<ToolSpaceSummary> mine = toolset.listSpaces(alice.getId());
        assertThat(mine).extracting(ToolSpaceSummary::id).contains(created.id());
    }

    @Test
    void createSpace_acceptsNullDescription() {
        var alice = com.myjourney.testsupport.AgentTestFixture.saveUser(userRepository, "alice");

        ToolSpaceSummary created = toolset.createSpace(alice.getId(), "Side", null);

        assertThat(created.name()).isEqualTo("Side");
    }

    private Long firstDocId(Space space) {
        return documentRepository.findAll().stream()
                .filter(d -> d.getSpace().getId().equals(space.getId()))
                .findFirst()
                .map(Document::getId)
                .orElseThrow(() -> new IllegalStateException("Fixture doc missing for space " + space.getId()));
    }
}
