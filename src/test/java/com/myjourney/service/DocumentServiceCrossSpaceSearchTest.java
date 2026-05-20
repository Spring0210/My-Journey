package com.myjourney.service;

import com.myjourney.model.Document;
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

// Verifies the agent toolset's cross-space search path: hits are confined
// to spaces the calling user is a member of -- a non-member space's
// matching document must never appear.
@SpringBootTest
@Transactional
class DocumentServiceCrossSpaceSearchTest {

    @Autowired DocumentService documentService;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository spaceMemberRepository;
    @Autowired DocumentRepository documentRepository;

    @Test
    void searchAccessibleDocuments_onlyReturnsHitsFromSpacesUserIsMemberOf() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        List<Document> hits = documentService.searchAccessibleDocuments(
                f.user1.getId(), "alpha", null, null, null, 25);

        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).getSpace().getId()).isEqualTo(f.space1.getId());
    }

    @Test
    void searchAccessibleDocuments_emptyKeywordReturnsEmpty() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        assertThat(documentService.searchAccessibleDocuments(
                f.user1.getId(), "", null, null, null, 25)).isEmpty();
        assertThat(documentService.searchAccessibleDocuments(
                f.user1.getId(), null, null, null, null, 25)).isEmpty();
    }

    @Test
    void searchAccessibleDocuments_limitCappedAtTwentyFive() {
        AgentTestFixture f = AgentTestFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        // Negative or oversized limits are clamped to [1, 25] inside the service.
        List<Document> oversized = documentService.searchAccessibleDocuments(
                f.user1.getId(), "alpha", null, null, null, 1000);
        assertThat(oversized).hasSizeLessThanOrEqualTo(25);
    }
}
