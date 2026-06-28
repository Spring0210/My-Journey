package com.myjourney.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies /sw.js serves the kill-switch worker with the headers required for a
 * stuck browser to pick it up and self-clean. Standalone setup keeps the test
 * fast and free of the DB/security context — the controller has no dependencies.
 */
class ServiceWorkerControllerTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ServiceWorkerController()).build();
    }

    @Test
    void servesKillSwitchWorkerAsJavascript() throws Exception {
        mvc.perform(get("/sw.js"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/javascript"))
                // The worker must unregister itself and clear caches, otherwise it
                // cannot evict the stale shell from returning visitors' browsers.
                .andExpect(content().string(containsString("self.registration.unregister()")))
                .andExpect(content().string(containsString("caches.delete")))
                .andExpect(content().string(containsString("client.navigate")));
    }

    @Test
    void workerScriptIsNeverCached() throws Exception {
        // If the script itself were cacheable, a stuck browser might keep getting
        // a stale copy and never run the kill-switch on its update check.
        mvc.perform(get("/sw.js"))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(header().string("Service-Worker-Allowed", "/"));
    }
}
