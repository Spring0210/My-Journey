package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ToolDispatcherTest {

    private DocumentToolset toolset;
    private ToolDispatcher dispatcher;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setup() {
        toolset = mock(DocumentToolset.class);
        dispatcher = new ToolDispatcher(toolset);
    }

    @Test
    void searchDocuments_parsesAllArgs_thenInvokesToolset() throws Exception {
        when(toolset.searchDocuments(eq(42), eq("onboarding"), eq(7),
                eq(LocalDate.parse("2026-05-01")), eq(LocalDate.parse("2026-05-15")),
                eq(List.of("a", "b")), eq(20)))
                .thenReturn(new ToolSearchResult(List.of()));

        JsonNode args = mapper.readTree("""
                {"query":"onboarding","space_id":7,
                 "date_from":"2026-05-01","date_to":"2026-05-15",
                 "tags":["a","b"],"limit":20}
                """);

        Object out = dispatcher.dispatch(42, "search_documents", args);

        assertThat(out).isInstanceOf(ToolSearchResult.class);
        verify(toolset).searchDocuments(42, "onboarding", 7,
                LocalDate.parse("2026-05-01"), LocalDate.parse("2026-05-15"),
                List.of("a", "b"), 20);
    }

    @Test
    void searchDocuments_defaultsLimitToTen_whenAbsent() throws Exception {
        JsonNode args = mapper.readTree("{\"query\":\"q\"}");
        when(toolset.searchDocuments(any(), any(), any(), any(), any(), any(), eq(10)))
                .thenReturn(new ToolSearchResult(List.of()));

        dispatcher.dispatch(42, "search_documents", args);

        verify(toolset).searchDocuments(42, "q", null, null, null, null, 10);
    }

    @Test
    void searchDocuments_missingQueryThrowsBadRequest() throws Exception {
        JsonNode args = mapper.readTree("{\"limit\":5}");

        assertThatThrownBy(() -> dispatcher.dispatch(42, "search_documents", args))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(toolset);
    }

    @Test
    void getDocument_parsesDocumentId() throws Exception {
        JsonNode args = mapper.readTree("{\"document_id\":99}");

        dispatcher.dispatch(42, "get_document", args);

        verify(toolset).getDocument(42, 99L);
    }

    @Test
    void listSpaces_takesNoArgs() throws Exception {
        dispatcher.dispatch(42, "list_spaces", mapper.readTree("{}"));
        verify(toolset).listSpaces(42);
    }

    @Test
    void createDocument_routesAllFields() throws Exception {
        JsonNode args = mapper.readTree("""
                {"title":"T","content":"C","space_id":3,
                 "doc_type":"JOURNAL","entry_date":"2026-05-20",
                 "tags":["x"]}
                """);

        dispatcher.dispatch(42, "create_document", args);

        verify(toolset).createDocument(42, "T", "C", 3, "JOURNAL",
                LocalDate.parse("2026-05-20"), List.of("x"));
    }

    @Test
    void updateDocument_passesNullForOmittedOptionalFields() throws Exception {
        JsonNode args = mapper.readTree("{\"document_id\":5,\"title\":\"new title\"}");

        dispatcher.dispatch(42, "update_document", args);

        verify(toolset).updateDocument(42, 5L, "new title", null, null);
    }

    @Test
    void addComment_requiresContent() throws Exception {
        JsonNode args = mapper.readTree("{\"document_id\":5}");

        assertThatThrownBy(() -> dispatcher.dispatch(42, "add_comment", args))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(toolset);
    }

    @Test
    void unknownToolName_throwsBadRequest() {
        assertThatThrownBy(() -> dispatcher.dispatch(42, "bogus_tool", null))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(toolset);
    }

    @Test
    void invalidDate_throwsBadRequest() throws Exception {
        JsonNode args = mapper.readTree("{\"query\":\"q\",\"date_from\":\"not-a-date\"}");

        assertThatThrownBy(() -> dispatcher.dispatch(42, "search_documents", args))
                .isInstanceOf(AppException.class);
        verifyNoInteractions(toolset);
    }
}
