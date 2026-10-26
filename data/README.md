# Vocabulary source file

`npm run seed [path]` loads `data/vocabulary.json` (or the given path) into MongoDB. It is safe to run repeatedly.

Format: a JSON array of topics, in the order they should appear (`order` = position + 1).

```json
[
  {
    "topic_name_en": "Time & Calendar",
    "topic_name_vn": "Thời gian và lịch",
    "words": [
      { "en": "go/went/gone", "vn": "đi" },
      { "en": "theatre/theater", "vn": "rạp hát" }
    ]
  }
]
```

- All four fields are required, non-empty strings (they are trimmed).
- Topics are matched by slug (from `topic_name_en`), words by `"<slug>:<lowercased en>"`. A repeated `en` inside one topic gets `#2`, `#3`, ... on later rows.
- Words missing from the file are never deleted; the seed prints a warning for each.
- Changing a word's `en` (or a topic's English name) creates a new card (or topic) and leaves the old one in the DB: the seed never deletes, and learner progress stays on the old one. Prefer editing `vn` only; the old entry is reported as missing.
- `#N` duplicate keys are positional: reordering rows that share the same `en` inside a topic swaps which row each key (and its progress) refers to.
- A changed `en`/`vn` resets enrichment to `pending`, unless the word is `edited`.

## Migrating camelCase data to snake_case

Databases created before the snake_case refactor need a one-off migration (safe to re-run). Take an Atlas snapshot or export first, and stop the API.

```bash
npm run migrate:snake-case                # dry run: prints counts, writes nothing
npm run migrate:snake-case -- --confirm   # renames fields in place and drops old camelCase indexes
```

`_id` values are kept, so `word_id`/`topic_id` links stay valid. Mongoose recreates the new indexes when the app starts. It reads `MONGODB_URI` from `.env`.
