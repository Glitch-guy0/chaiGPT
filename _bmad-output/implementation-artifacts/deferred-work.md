# Deferred Work

## Deferred from: code review of story 6-1 (2026-07-21)

- Home and Sidebar each call useConversations independently — pre-existing pattern, not introduced by this story
- SignInButton modal has no fallback — Clerk limitation, not story-specific
- fetchConversationMessages has no timeout — general improvement for all API calls
- setState after unmount on conversation fetch — Home is root component, unmounts only on full-page nav
