import { parseConstruct, shortestPathLength, type Construct } from './construct';

/**
 * A visitor-authored Construct: the raw ASCII rows (same alphabet as
 * parseConstruct — `S`/`G`/`#`/`.` and checkpoint digits) plus a name the
 * Observer gives the world they are condemning the Sim to endure next. This is
 * the wire/persistence form; {@link validateConstructDesign} turns it into a
 * real {@link Construct} only if it is well-formed and actually solvable.
 */
export interface ConstructDesign {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly string[];
}

export const DESIGN_LIMITS = {
  minSize: 4,
  maxSize: 16,
  maxNameLength: 40,
} as const;

export type ValidationResult =
  | { readonly ok: true; readonly construct: Construct }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate a submitted design. Untrusted Observer input, so every failure mode
 * is a rejection with a human-readable reason — never a thrown error the caller
 * has to catch. A design is accepted only if it parses, fits the size bounds,
 * has a sensible name, and is genuinely solvable (there is a path from the
 * start to its first target); we never drop the Sim into a world it cannot
 * escape.
 */
export function validateConstructDesign(design: ConstructDesign): ValidationResult {
  const name = design.name.trim();
  if (name.length === 0) return { ok: false, reason: 'The world needs a name.' };
  if (name.length > DESIGN_LIMITS.maxNameLength) {
    return {
      ok: false,
      reason: `The name must be at most ${DESIGN_LIMITS.maxNameLength} characters.`,
    };
  }

  const height = design.rows.length;
  const width = design.rows[0]?.length ?? 0;
  const { minSize, maxSize } = DESIGN_LIMITS;
  if (width < minSize || height < minSize) {
    return { ok: false, reason: `The world must be at least ${minSize}×${minSize}.` };
  }
  if (width > maxSize || height > maxSize) {
    return { ok: false, reason: `The world must be at most ${maxSize}×${maxSize}.` };
  }

  let construct: Construct;
  try {
    construct = parseConstruct(design.id, design.rows);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Malformed layout.' };
  }

  // Must be escapable: a path from the start to the first target must exist.
  if (shortestPathLength(construct, construct.start, construct.goal) === null) {
    return { ok: false, reason: 'The Sim could never reach the goal from where it starts.' };
  }

  // For circuits, every checkpoint must be reachable from the previous one so
  // the loop can actually be run.
  const cps = construct.checkpoints;
  for (let i = 1; i < cps.length; i++) {
    if (shortestPathLength(construct, cps[i - 1]!, cps[i]!) === null) {
      return { ok: false, reason: 'The checkpoints do not connect into a runnable loop.' };
    }
  }

  return { ok: true, construct };
}
