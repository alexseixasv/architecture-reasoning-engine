# Learnings

Discoveries, mistakes, fixes, and reusable patterns. Update after each phase.

## L-001 — Greenfield repo; PDF outside workspace (2026-11-14)

- Hiring PDF was in Downloads, not in the git repo.
- Extracting `TECHNICAL_REQUIREMENTS.md` into version control prevents silent drift from the case and gives stable REQ-IDs for phase gates.
- Pattern: treat external PDFs as inputs; commit a structured extraction, not a binary (unless explicitly requested).

## L-002 — Separate PDF mandates from engineering decisions (2026-11-14)

- Stack choice, analytical engine, no UI, and eight phases are ENG decisions, not PDF mandates.
- Recording them separately avoids claiming the case required choices it only preferred.
