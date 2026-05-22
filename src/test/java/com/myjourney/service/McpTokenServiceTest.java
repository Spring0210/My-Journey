package com.myjourney.service;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class McpTokenServiceTest {

    private McpApiTokenRepository tokenRepo;
    private McpAccessLogRepository logRepo;
    private UserRepository userRepo;
    private McpTokenService service;

    @BeforeEach
    void setup() {
        tokenRepo = mock(McpApiTokenRepository.class);
        logRepo   = mock(McpAccessLogRepository.class);
        userRepo  = mock(UserRepository.class);
        service   = new McpTokenService(tokenRepo, logRepo, userRepo);
    }

    @Test
    void createToken_returnsRawTokenWithMjPrefix_andPersistsHashOnly() {
        User user = new User();
        user.setId(7);
        when(userRepo.findById(7)).thenReturn(Optional.of(user));
        when(tokenRepo.save(any(McpApiToken.class))).thenAnswer(inv -> inv.getArgument(0));

        McpTokenService.CreatedToken result = service.createToken(7, "Claude Desktop", 30);

        assertThat(result.rawToken()).startsWith("mj_");
        assertThat(result.rawToken()).hasSizeGreaterThanOrEqualTo(35);

        ArgumentCaptor<McpApiToken> captor = ArgumentCaptor.forClass(McpApiToken.class);
        verify(tokenRepo).save(captor.capture());
        McpApiToken saved = captor.getValue();

        // The raw token must NOT be stored anywhere.
        assertThat(saved.getTokenHash()).isNotEqualTo(result.rawToken());
        assertThat(saved.getTokenHash()).hasSize(64); // SHA-256 hex
        assertThat(saved.getPrefix()).isEqualTo(result.rawToken().substring(0, 8));
        assertThat(saved.getName()).isEqualTo("Claude Desktop");
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getExpiredAt()).isAfter(LocalDateTime.now().plusDays(29));
    }

    @Test
    void verifyToken_returnsTokenWhenHashMatchesAndNotExpired() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        stored.setExpiredAt(LocalDateTime.now().plusDays(10));
        when(tokenRepo.findByTokenHash(any())).thenReturn(Optional.of(stored));

        Optional<McpApiToken> result = service.verifyToken("mj_anything");

        assertThat(result).containsSame(stored);
    }

    @Test
    void verifyToken_returnsEmptyWhenExpired() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        stored.setExpiredAt(LocalDateTime.now().minusDays(1));
        when(tokenRepo.findByTokenHash(any())).thenReturn(Optional.of(stored));

        Optional<McpApiToken> result = service.verifyToken("mj_anything");

        assertThat(result).isEmpty();
    }

    @Test
    void verifyToken_returnsEmptyForMissingPrefix() {
        Optional<McpApiToken> result = service.verifyToken("not_mj_prefixed");
        assertThat(result).isEmpty();
        verify(tokenRepo, never()).findByTokenHash(any());
    }

    @Test
    void verifyToken_returnsEmptyForNullOrBlank() {
        assertThat(service.verifyToken(null)).isEmpty();
        assertThat(service.verifyToken("")).isEmpty();
        assertThat(service.verifyToken("   ")).isEmpty();
    }

    @Test
    void touchLastUsed_callsRepository() {
        service.touchLastUsed(42L);
        verify(tokenRepo).touchLastUsedAt(eqLong(42L), any(LocalDateTime.class));
    }

    private static long eqLong(long v) { return org.mockito.ArgumentMatchers.eq(v); }

    @Test
    void revokeToken_deletesWhenOwnedByCaller() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        User owner = new User(); owner.setId(7);
        stored.setUser(owner);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(stored));

        service.revokeToken(7, 42L);

        verify(tokenRepo).delete(stored);
    }

    @Test
    void revokeToken_throwsWhenNotOwner() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        User owner = new User(); owner.setId(99);
        stored.setUser(owner);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.revokeToken(7, 42L))
                .hasMessageContaining("not yours");
        verify(tokenRepo, never()).delete(any());
    }

    @Test
    void recordAccess_writesLogRow() {
        McpApiToken token = new McpApiToken();
        token.setId(42L);

        service.recordAccess(token, "search_documents", true);

        ArgumentCaptor<com.myjourney.model.McpAccessLog> captor =
                ArgumentCaptor.forClass(com.myjourney.model.McpAccessLog.class);
        verify(logRepo).save(captor.capture());
        assertThat(captor.getValue().getToken()).isSameAs(token);
        assertThat(captor.getValue().getToolName()).isEqualTo("search_documents");
        assertThat(captor.getValue().isSuccess()).isTrue();
    }
}
