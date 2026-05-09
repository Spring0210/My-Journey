package com.myjourney.controller;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * SPA fallback controller.
 * Forwards all non-API, non-static-asset requests to index.html so React
 * Router can handle client-side routing. Also sets no-cache headers on
 * index.html so mobile browsers don't serve a stale shell that references
 * hashed assets from a previous deploy (which causes a white screen).
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
        "/",
        "/login",
        "/register",
        "/forgot-password",
        "/dashboard",
        "/journal",
        "/journal/**",
        "/calendar",
        "/spaces",
        "/spaces/**",
        "/notifications",
        "/profile",
        "/privacy",
        "/terms",
        "/oauth2/callback",
    })
    public String spa(HttpServletResponse response) {
        // index.html must never be cached — its <script>/<link> tags reference
        // hashed asset filenames that change on every build.
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");
        return "forward:/index.html";
    }
}
