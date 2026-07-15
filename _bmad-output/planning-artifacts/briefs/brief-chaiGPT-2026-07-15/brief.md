---
title: chaiGPT — Product Brief
status: draft
created: 2026-07-15
updated: 2026-07-15
sections_completed: []
---

## Executive Summary

chaiGPT is a personal learning project that explores the architecture and interaction patterns behind modern conversational AI tools. It is not a production product — it exists to understand how chat interfaces, document-aware conversations, and decision-tree branching work in practice. The goal is hands-on familiarity with these systems, not shipping a competitor to ChatGPT.

## The Problem

Conversational AI tools like ChatGPT hide a lot of complexity: conversation state management, context windows, document ingestion, and the ability to explore alternate reasoning paths. If you want to understand how these pieces fit together, reading documentation only gets you so far. Building a stripped-down version surfaces the real tradeoffs — how to structure message history, how to attach context without blowing memory, how to let users explore multiple outcomes from the same starting point.

Today, you either use finished products (opaque) or build from scratch (overwhelming). A focused learning project fills the gap: enough structure to be real, not enough to be a maintenance burden.

## The Solution

A web-based chat interface with three core capabilities:

- **Chat interface**: Send messages, see responses, navigate history
- **Conversations with document upload**: Create conversations, attach PDF or text documents that become part of the context
- **Conversation branching**: From any message, fork the conversation into an alternate path — creating an inverted tree where the same parent can spawn multiple children, each continuing independently

The system uses Next.js, React, TypeScript, and Tailwind. The focus is on the conversation model and branching mechanics, not on building a new LLM.

## What Makes This Different

chaiGPT is not trying to compete with existing tools. Its purpose is educational — the "moat" is understanding. The inverted-tree branching model (decisions as forks, not linear threads) is the distinguishing feature worth exploring. The project is right-sized for a single learner: no auth, no scaling, no production concerns. The value is in the building, not the shipping.

## Who This Serves

Just you (Prajwal). A personal sandbox for exploring conversation UX and state management. Success looks like: you finish the project and can explain how the branching model works, what the tradeoffs are, and how you'd change it if you were building for real users.

## Success Criteria

- End-to-end working prototype: create conversations, upload documents, send messages, branch conversations
- You understand the state model behind branching (how to represent, render, and navigate a conversation tree)
- You can articulate the key tradeoffs (memory, context window, UX complexity)
- The code is clean enough to revisit later as a reference

## Scope

**In:**
- Chat interface with message history
- Conversation creation and selection
- Document upload (PDF and plain text) attached to a conversation
- Inverted-tree branching from any message in a conversation
- Local state (no backend persistence required for learning)

**Out:**
- Authentication or multi-user support
- Real LLM integration (placeholder responses acceptable for learning the structure)
- Production deployment or reliability concerns
- Mobile responsiveness (desktop-first is fine)

## Vision

If this works as a learning tool, it becomes a reference you can return to when building real conversation products. The branching model in particular is an interesting design pattern — if it proves useful, it could inform future projects. For now, the vision is simply: build it, understand it, move on.
