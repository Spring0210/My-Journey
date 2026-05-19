package com.myjourney.config;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.SpacePost;
import com.myjourney.repository.JournalRepository;
import com.myjourney.repository.MediaRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.service.MediaSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * One-time backfill for the denormalized `media` table.
 *
 * Runs on every startup but is idempotent: if the media table already has
 * rows, it exits immediately. This means the very first restart after the
 * Media feature ships will populate the table from existing JournalEntry
 * and SpacePost rows; subsequent restarts are a no-op.
 *
 * Processes records in small batches to keep memory and transaction sizes
 * bounded. At our scale this still completes in well under a second.
 */
@Component
@Order(100)  // run after data sources are up but before HTTP starts serving
public class MediaBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MediaBackfillRunner.class);

    private static final int BATCH_SIZE = 200;

    @Autowired private MediaRepository mediaRepository;
    @Autowired private JournalRepository journalRepository;
    @Autowired private SpacePostRepository spacePostRepository;
    @Autowired private MediaSyncService mediaSyncService;

    @Override
    public void run(String... args) {
        // Idempotency gate — only run when the table is empty
        long existing = mediaRepository.count();
        if (existing > 0) {
            log.debug("Media backfill skipped — table already has {} rows", existing);
            return;
        }

        log.info("Media backfill: media table is empty, populating from journal_entry + space_post");

        int journalBackfilled = backfillJournalEntries();
        int postBackfilled    = backfillSpacePosts();

        log.info("Media backfill complete: {} journal entries, {} space posts processed",
                journalBackfilled, postBackfilled);
    }

    @Transactional
    public int backfillJournalEntries() {
        int processed = 0;
        List<JournalEntry> all = journalRepository.findAll();
        for (int i = 0; i < all.size(); i += BATCH_SIZE) {
            List<JournalEntry> batch = all.subList(i, Math.min(i + BATCH_SIZE, all.size()));
            for (JournalEntry entry : batch) {
                if (entry.getImagePathList() == null || entry.getImagePathList().isEmpty()) continue;
                mediaSyncService.syncJournalEntry(entry);
                processed++;
            }
        }
        return processed;
    }

    @Transactional
    public int backfillSpacePosts() {
        int processed = 0;
        List<SpacePost> all = spacePostRepository.findAll();
        for (int i = 0; i < all.size(); i += BATCH_SIZE) {
            List<SpacePost> batch = all.subList(i, Math.min(i + BATCH_SIZE, all.size()));
            for (SpacePost post : batch) {
                boolean hasMedia =
                        (post.getImagePathList() != null && !post.getImagePathList().isEmpty()) ||
                        (post.getVideoPathList() != null && !post.getVideoPathList().isEmpty());
                if (!hasMedia) continue;
                mediaSyncService.syncSpacePost(post);
                processed++;
            }
        }
        return processed;
    }
}
