# ORGII Design Philosophy

---

## Overview

ORGII is an Agentic Development Environment (ADE) — not an IDE, not a chat wrapper, not a plugin.
This document explains the foundational decisions that define what we are building and why.

---

## 1. Build an ADE, not another IDE

An IDE assumes the human is the primary actor. The editor is a workspace for a human who writes
code, runs tools, and reads output. Every design choice — the cursor, the file tree, the terminal
— is optimized for human interaction speed.

In an ADE, agents are first-class actors alongside the human. This is not a semantic distinction
— it changes the fundamental design surface.

We are building an agent-centered UI in two senses. First, the UI itself is controllable by
agents. The `**ADE Manager**` is a built-in meta-agent that can spawn, monitor, and coordinate
other sessions, and drive the UI through a structured action system — not computer use, but
purpose-built UI actions. Users can also always ask it for help, which reduces the learning curve
significantly. Second, every feature is oriented around what users do _with_ agents — session
management, execution modes, key vault, replay — not around the old IDE model of a human
manually operating tools.

ORGII is therefore not another VS Code fork. It does not support VS Code extensions today — but
we are integrating the few we rely on, alongside new emerging plugin ecologies. The orchestration
layer around the tools matters more than being another editor.

---

## 2. Who We Are Building For

IDEs help experienced developers build apps. That has always been the assumed audience — people
who already know how to clone a repo, configure a dev environment, and read a stack trace.

ORGII's goal is broader. We want to help people ship their apps, not just build them — and to
explore new ways to get their work in front of users, collect valuable feedback, and find
inspiration for what to build next.

To do so, we need to lower the bar — not just for building, but for using. The apps being built
today by indie developers and small teams are largely unreleased or hard to get running. We want
to make it easier for anyone to set up a repo safely, get an MVP out the door, build in public,
go open source — and for the people around them to actually run and try those apps. The pool of
computer users who could be early adopters, testers, and collaborators is vastly larger than the
pool of experienced coders. That gap is largely untapped.

Teaching a non-technical friend to set up a repo has always been a nightmare. In the pre-agentic
age there was no good answer. It is still painful today. But seeing that friend run your app on
their computer for the first time — that moment is genuinely fun and satisfying. We want to bring
that experience to more people.

---

## 3. Session Livestream, Replay, and Agent Reliability

Most agentic tools give you a tiny chat pane or a terminal CLI window. The output is a wall of
tool calls, diffs, and model text — hard to trace, easy to lose context in, prone to freezing
your machine under load. Some tools seem almost designed to obscure the trajectory — collapsing
tool calls, hiding reasoning, surfacing only the final answer — as if the process no longer
matters in the age of agentic coding. You end up with a result you can't audit and a process you
can't learn from. It makes reading sessions feel like a chore, and most people stop trying.

We think this is the wrong default — and an unsafe one. An agent you cannot audit is an agent
you cannot trust. That is why we introduced session livestream and replay.

At its best, watching an agent work feels like real peer-coding — a friend over Zoom, or one of
those tech livestreams where you watch someone experienced work through a problem in real time.
That experience has value: you learn, you catch mistakes, you stay in the loop at key decision
points. We want to offer RAM-friendly live session streaming with replay, captioned with what the
agent said and did at each step. Debugging, auditing before a merge, onboarding someone to a
session they didn't run — all of it should be readable.

Agent readability goes alongside this. A session that produces correct output but is opaque is
a liability — you cannot trust it, improve it, or hand it off. Structured session persistence,
execution modes, and human-readable turn summaries are all building blocks toward an ADE where
the agent's work is as legible as a pull request.

There is also a broader benefit: getting a good understanding of how agents work not only
improves the maintainability of a project, it helps you understand how agents think — and
therefore work with them more effectively, more productively, and in safer ways.

Today this covers our native Rust agents as well as external agents — Cursor IDE events, Codex,
Claude Code — and we are continuing to expand both coverage and fidelity, in content and visually.

---

## 4. Bring Your Own Key — and Your Own Setup

Most agentic tools lock you into their infrastructure. When you switch, you start over — your
MCP configurations, your agent-generated memories, your accumulated project context, gone.

We believe in freedom of choice. ORGII is built around BYOK: connect your existing subscriptions
— Claude, OpenAI, Gemini, Cursor, Copilot, Deepseek, Minimax, Kimi, and others — and use them
directly. No margin, no lock-in. But more importantly, your _harness_ travels with you. Your MCP
servers, your skills, and the memories agents have built about your codebase and preferences stay
stable across sessions, model swaps, and agent upgrades. You should be able to try something new
without starting from scratch.

---

## 5. The Agentic Organization

When I was studying at Harvard GSAS, in the early days of GPT-3.5, conversations with my
professors and peers helped me arrive at a realization that has shaped everything since: the AI
race is not primarily a technological competition. It is, at its core, a question of
organizational sociology — how groups of people (and now agents) form, share knowledge, create
(and break) consensus, divide labor, build trust, and make decisions together.

What struck me then, and still does, is how many of these questions are transhistorical. Agents
raise genuinely new sociotechnical challenges — around autonomy, accountability, memory, and
trust in non-human actors. But underneath those, the older questions remain: how do you
coordinate effort across a group of people with different cognitive specializations and
perspectives? How do you maintain shared context as a team grows? How do you decide what to
delegate and what to keep close? These are questions that organizational theorists, historians,
and sociologists have been working on for a long time. The technology changes the parameters; it
does not dissolve the questions.

Models set the ceiling, but organization determines how close anyone gets to it. The teams that
ship the best AI products are not necessarily the ones with the best models. They are the ones
that figured out how to work with AI effectively as a team — how to delegate to agents, how to
review their output, how to maintain shared context, how to avoid duplication of effort, and how
to keep humans in the loop on the decisions that matter.

This is what we mean by "agentic organization" — and it is why the app is named ORGII. The name
is a deliberate nod to our belief that the most important frontier here is not just the model,
but the organizational methods: new ways of structuring how humans and agents work together,
share context, and build things that neither could build alone. It is a team — of humans and
agents — that functions as a coherent unit. Roles get distributed. Some tasks are fully
delegated. Others require human judgment at the last step. Memory and context are shared across
the team, not siloed per person. New members (human or agent) can be onboarded quickly because
the accumulated knowledge is legible and accessible.

Part of this is time management — knowing when to work _with_ agents under supervision, and when
to let them run solo tasks while you are away. Not every task needs your eyes on it in real time.
Some are best done collaboratively, at a decision-heavy moment when your input changes the
outcome. Others can be fully delegated and reviewed later.

ORGII factors in your presence. Like a status in a chat or office app — available, in a meeting,
away — the platform can behave differently depending on whether you are actively watching. When
you are present, agents surface key decision points and wait for your input. When you step away,
they continue on delegated work and queue what needs your review. Your status is not just a
social signal; it shapes how the system routes work between you and your agents.

---

## 6. Tauri + React 19

Electron bundles a full Chromium (~300–500 MB on disk) — at least 200 MB of RAM before any
product code runs, multiplied per window. Tauri uses the OS-native WebView and a Rust backend;
the binary is therefore much smaller. Tauri is underexplored and not without friction — we hit
real pain shipping reliable embedded webviews — but those issues worked out, and the RAM savings
across a multi-window app users run all day justified the bet.

On the UI side, we initially considered GPU-first rendering — and dropped the idea. It made
sense for Zed when it started, over five years ago, as a pixel-dense code editor. For ORGII's
compositional dashboard — session panels, palettes, wizards — the bottleneck is state management,
not glyph throughput. GPU-first also keeps the battery draining continuously; after using Zed
daily for over a year, that was a consistent personal observation of mine. React 19, Jotai, and
the web platform's mature ecosystem solve the actual problem — accessibility, 13 supported
languages, a full component ecosystem — for free.
