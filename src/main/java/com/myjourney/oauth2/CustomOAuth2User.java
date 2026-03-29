package com.myjourney.oauth2;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Map;

/**
 * Wraps the standard OAuth2User returned by Google and adds
 * the resolved app user fields (id, username, avatar) so the
 * success handler can generate a JWT without another DB lookup.
 */
public class CustomOAuth2User implements OAuth2User {

    private final OAuth2User delegate;
    private final Integer appUserId;
    private final String appUsername;
    private final String appAvatar;

    public CustomOAuth2User(OAuth2User delegate, Integer appUserId,
                            String appUsername, String appAvatar) {
        this.delegate    = delegate;
        this.appUserId   = appUserId;
        this.appUsername = appUsername;
        this.appAvatar   = appAvatar;
    }

    public Integer getAppUserId()   { return appUserId; }
    public String  getAppUsername() { return appUsername; }
    public String  getAppAvatar()   { return appAvatar; }

    // ── OAuth2User delegation ──────────────────────────────────
    @Override public Map<String, Object> getAttributes()             { return delegate.getAttributes(); }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return delegate.getAuthorities(); }
    @Override public String getName()                                { return delegate.getName(); }
}
