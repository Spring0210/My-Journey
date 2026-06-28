package com.myjourney.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves a self-destroying ("kill-switch") service worker at /sw.js.
 *
 * A previous build registered a vite-plugin-pwa service worker that cache-first
 * served a precached app shell. The PWA was later removed from source, but the
 * worker persists in returning visitors' browsers and keeps serving the stale
 * shell (old hashed bundle) on every normal navigation. It can never recover on
 * its own because /sw.js now 500s, so the browser's update check fails and keeps
 * the old worker.
 *
 * This replacement worker is what the browser fetches on its next update check.
 * On activation it deletes all caches, unregisters itself, and reloads every
 * open tab onto the live network version — after which no service worker is
 * registered anymore (the current index.html registers none).
 */
@RestController
public class ServiceWorkerController {

    private static final String KILL_SWITCH_SW = """
        // Auto-generated kill-switch service worker. See ServiceWorkerController.
        self.addEventListener('install', () => self.skipWaiting());

        self.addEventListener('activate', (event) => {
          event.waitUntil((async () => {
            // 1. Drop every cache this origin holds (the stale precache).
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
            // 2. Unregister self so future loads bypass the worker entirely.
            await self.registration.unregister();
            // 3. Reload every open tab to pick up the live network version.
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((client) => client.navigate(client.url));
          })());
        });
        """;

    @GetMapping(value = "/sw.js", produces = "application/javascript")
    public ResponseEntity<String> serviceWorker() {
        return ResponseEntity.ok()
                // Never cache the worker script itself, so stuck browsers always
                // see this kill-switch on their next update check.
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Service-Worker-Allowed", "/")
                .contentType(MediaType.parseMediaType("application/javascript"))
                .body(KILL_SWITCH_SW);
    }
}
