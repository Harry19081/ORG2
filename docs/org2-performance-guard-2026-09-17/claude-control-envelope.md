# Claude resume control envelope

The provider-owned JSONL was authoritative. A recovered Claude Desktop session
wrote an `isMeta: true` user record and an assistant with `model: <synthetic>`
whose `parentUuid` pointed to that record, before the actual SDK user message.
The importer already excluded the injected user from human turns, but imported
its acknowledgement as the previous turn's reply. Consequently that turn's
failure preview was replaced by a provider control acknowledgement. There was
one accepted intent and one financial request for the real new message; this
was not evidence of a second dispatch. The initially observed extra GUI user
row converged without intervention before this patch.

The producing boundary now recognizes the control acknowledgement from its
parent identity and synthetic model in both full replay and the byte index.
No content-text or entrypoint filter is used. API error messages remain visible.
The canonical queue/intent identity logic is unchanged. Native files and live
databases are not rewritten; rereading regenerates the corrected projection.

| Area               | Verdict | Evidence                                                 | Change or reason kept                                                                                        | Verification                                                          |
| ------------------ | ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Background work    | keep    | Existing per-read native importer                        | No timer, retry, listener, or extra scan                                                                     | Source inspection                                                     |
| Memory             | keep    | One injected-user UUID per reader                        | Constant number of retained identities, discarded with read                                                  | Fresh-reader/repeated-read fixture                                    |
| Scope/isolation    | keep    | Exact selected native path; parser-local state           | No cross-session registry or global cache                                                                    | Repeated independent loads                                            |
| Rendering/hot path | fix     | Control acknowledgement overwrote previous reply preview | Shared provenance predicate in replay and index; only synthetic candidates require an additional index parse | Full, initial-window, turn-window, cloud-window, source-list fixtures |

| Provider              | Raw transition                                                   | App/UI state            | Boundary                                          | Expected invariant                                                           | Observed evidence                                                                     |
| --------------------- | ---------------------------------------------------------------- | ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Claude Desktop        | Resume injects meta user and synthetic child before real request | Original live GUI       | Native source to replay/preview                   | Four actual user turns; prior failure preserved                              | Raw provenance confirmed; old GUI eventually four turns but wrong prior reply preview |
| Claude JSONL importer | Faithful resume fixture, including real same-text user/assistant | Cold and repeated reads | Full/indexed/paginated local and cloud projection | Exactly two human turns and their real replies; injected source URL excluded | Targeted Rust regression                                                              |
| Claude Desktop        | Same saved native file after new private build                   | Reopen and restart      | Native importer to GUI                            | Correct prior error preview, four turns, successful new reply preserved      | Pending parent-agent acceptance; no provider call required                            |

Existing regressions cover compaction boundaries, local command results,
task-notification messages, attachments, and incremental metadata parsing.
One old body-count expectation changes from five to three because the two
already-invisible injected user records are no longer counted as renderable
body lines. Their genuine assistant replies remain intact.

Performance verdict: blocked pending the new-build GUI/restart acceptance.
The source change adds no persistent resource; no runtime CPU/RSS improvement
is claimed from the bounded parser design.
