package com.myjourney.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * SPA fallback controller.
 * Forwards all non-API, non-static-asset requests to index.html so that
 * React Router can handle client-side routing.
 *
 * Exclusions handled by Spring Boot's static resource serving:
 *  - /api/** → handled by @RestController endpoints
 *  - /oauth2/** → handled by Spring Security
 *  - Static files (*.js, *.css, *.png, etc.) → served directly from static/
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
        "/",
        "/login",
        "/register",
        "/forgot-password",
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
    public String spa() {
        return "forward:/index.html";
    }
}
