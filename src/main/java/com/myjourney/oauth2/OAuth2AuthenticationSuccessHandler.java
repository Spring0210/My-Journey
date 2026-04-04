package com.myjourney.oauth2;

import com.myjourney.model.RefreshToken;
import com.myjourney.service.RefreshTokenService;
import com.myjourney.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomOAuth2User oauthUser = (CustomOAuth2User) authentication.getPrincipal();

        String token        = jwtUtil.generateToken(oauthUser.getAppUserId(), oauthUser.getAppUsername());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(oauthUser.getAppUserId());
        String username     = URLEncoder.encode(oauthUser.getAppUsername(), StandardCharsets.UTF_8);
        String avatar       = oauthUser.getAppAvatar() != null
                ? URLEncoder.encode(oauthUser.getAppAvatar(), StandardCharsets.UTF_8)
                : "";

        // Pass JWT and user info to the React SPA callback page via query params.
        // OAuth2CallbackPage reads them, populates auth context, and navigates into the app.
        String redirectUrl = "/oauth2/callback?token=" + token
                + "&refreshToken=" + refreshToken.getToken()
                + "&userId=" + oauthUser.getAppUserId()
                + "&username=" + username
                + "&avatar=" + avatar;

        response.sendRedirect(redirectUrl);
    }
}
