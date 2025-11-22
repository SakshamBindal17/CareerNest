# 9. Performance Evaluation

No formal load testing was run in the repository but here are recommendations and placeholders to fill with results:

- Run k6 or ApacheBench against `/api/auth/login`, `/api/people`, `/api/jobs`.
- Use `EXPLAIN ANALYZE` to profile slow SQL queries (common candidates: joins on posts + post_media, queries scanning large `users` tables without indices).
- Add caching for static lists (college list) and consider Redis for frequently-read items.

Include measured response times, throughput, and resource usage screenshots in `docs/images/tests/`.
