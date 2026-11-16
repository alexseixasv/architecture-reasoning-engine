/**
 * Split a pasted blob that mixes architecture prose with a trailing question.
 * Extraction must receive architecture text only; the question belongs in Analyze.
 */
export function peelTrailingQuestion(text: string): {
  architecture: string;
  question: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { architecture: text, question: null };
  }

  const blocks = trimmed.split(/\n\s*\n/);
  if (blocks.length >= 2) {
    const last = (blocks[blocks.length - 1] ?? '').trim();
    if (isQuestionLike(last)) {
      return {
        architecture: blocks.slice(0, -1).join('\n\n').trim(),
        question: last,
      };
    }
  }

  const inline = trimmed.match(
    /\n((?:let'?s suppose|what (?:could|would) happen)[\s\S]+)$/i,
  );
  if (inline?.[1]) {
    return {
      architecture: trimmed.slice(0, inline.index).trim(),
      question: inline[1].trim(),
    };
  }

  return { architecture: trimmed, question: null };
}

function isQuestionLike(block: string): boolean {
  return (
    /\?\s*$/.test(block) ||
    /^let'?s suppose/i.test(block) ||
    /^what (?:could|would) happen/i.test(block)
  );
}
