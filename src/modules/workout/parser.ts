import { uid } from "uid";
import type { Interval, IntervalTargets, TextBlock, Workout } from "@/machines/types";

// ---------------------------------------------------------------------------
// Time parsing
// ---------------------------------------------------------------------------

function parseTime(token: string): number | null {
  // :SS format
  const colonSeconds = token.match(/^:(\d+)$/);
  if (colonSeconds) {
    return parseInt(colonSeconds[1], 10) * 1000;
  }

  // HH:MM:SS format
  const hms = token.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) {
    const hours = parseInt(hms[1], 10);
    const minutes = parseInt(hms[2], 10);
    const seconds = parseInt(hms[3], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  // MM:SS or M:SS format
  const ms = token.match(/^(\d+):(\d{2})$/);
  if (ms) {
    const minutes = parseInt(ms[1], 10);
    const seconds = parseInt(ms[2], 10);
    return (minutes * 60 + seconds) * 1000;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Line content parsing
// ---------------------------------------------------------------------------

type ParsedInterval = {
  duration: number;
  displayDuration: number | null;
  targets: IntervalTargets;
  text: string;
};

type ParsedRepeat = { repeat: number };

function parseLine(content: string): ParsedInterval | ParsedRepeat {
  const repeatMatch = content.match(/^(\d+)x$/);
  if (repeatMatch) {
    return { repeat: parseInt(repeatMatch[1], 10) };
  }

  const tokens = content.split(/\s+/);
  let duration = 0;
  let displayDuration: number | null = null;
  const targets: IntervalTargets = {};
  const textParts: string[] = [];

  // Check for trailing time token (explicit display duration)
  if (tokens.length > 1) {
    const lastToken = tokens[tokens.length - 1];
    const trailingTime = parseTime(lastToken);
    if (trailingTime !== null) {
      displayDuration = trailingTime;
      tokens.pop();
    }
  }

  for (const token of tokens) {
    const time = parseTime(token);
    if (time !== null && duration === 0) {
      duration = time;
      continue;
    }

    const powerRange = token.match(/^(\d+)%\.\.(\d+)%$/);
    if (powerRange) {
      targets.power = [
        parseInt(powerRange[1], 10),
        parseInt(powerRange[2], 10),
      ];
      continue;
    }

    const singlePower = token.match(/^(\d+)%$/);
    if (singlePower) {
      const p = parseInt(singlePower[1], 10);
      targets.power = [p, p];
      continue;
    }

    const cadence = token.match(/^(\d+)rpm$/);
    if (cadence) {
      const c = parseInt(cadence[1], 10);
      targets.cadence = [c, c];
      continue;
    }

    const heartRate = token.match(/^(\d+)bpm$/);
    if (heartRate) {
      const hr = parseInt(heartRate[1], 10);
      targets.heartRate = [hr, hr];
      continue;
    }

    textParts.push(token);
  }

  return { duration, displayDuration, targets, text: textParts.join(" ") };
}

// ---------------------------------------------------------------------------
// Raw tree building
// ---------------------------------------------------------------------------

type RawItem = {
  indent: number;
  content: string;
  children: RawItem[];
};

function buildRawTree(
  lines: { indent: number; content: string }[]
): RawItem[] {
  const root: RawItem[] = [];
  const stack: RawItem[] = [];

  for (const { indent, content } of lines) {
    const item: RawItem = { indent, content, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Text block extraction
// ---------------------------------------------------------------------------

function estimateReadingDuration(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3000, words * 500); // ~2 words/sec, minimum 3s
}

function processTextBlocks(
  textItems: RawItem[],
  intervalStart: number,
  intervalDuration: number
): TextBlock[] {
  if (textItems.length === 0) return [];

  const blocks: TextBlock[] = [];

  for (const item of textItems) {
    const parsed = parseLine(item.content);
    if ("repeat" in parsed) continue;

    const prev = blocks[blocks.length - 1];
    const startAt =
      parsed.duration > 0
        ? (prev?.startAt ?? intervalStart) + parsed.duration
        : prev
          ? prev.startAt + prev.duration
          : intervalStart;

    blocks.push({
      id: uid(),
      text: parsed.text,
      startAt,
      duration: parsed.displayDuration ?? estimateReadingDuration(parsed.text),
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function woToWorkout(content: string): Workout {
  // Step 1: Strip HTML comments
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "");

  // Step 2: Extract name
  const nameMatch = stripped.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "Untitled Workout";

  // Step 3: Find first unordered list (contiguous `- ` lines)
  const lines = stripped.split("\n");
  const listLines: { indent: number; content: string }[] = [];
  let inList = false;

  for (const line of lines) {
    const match = line.match(/^(\s*)- (.+)$/);
    if (match) {
      inList = true;
      const spaces = match[1].length;
      listLines.push({ indent: Math.floor(spaces / 2), content: match[2] });
    } else if (inList && line.trim() === "") {
      continue;
    } else if (inList) {
      break;
    }
  }

  // Step 4: Build intermediate tree
  const tree = buildRawTree(listLines);

  // Step 5: Flatten tree into Workout
  const intervalsById: Record<string, Interval> = {};
  const intervalIds: string[] = [];
  const instructions: TextBlock[] = [];
  let absoluteOffset = 0;

  for (const item of tree) {
    const parsed = parseLine(item.content);

    if ("repeat" in parsed) {
      for (let i = 0; i < parsed.repeat; i++) {
        for (const child of item.children) {
          const childParsed = parseLine(child.content);
          if ("repeat" in childParsed) {
            throw new Error("Nested repeats are not supported");
          }

          const id = uid();
          const interval: Interval = {
            id,
            duration: childParsed.duration,
            targets: childParsed.targets,
          };
          intervalsById[id] = interval;
          intervalIds.push(id);

          instructions.push(
            ...processTextBlocks(
              child.children,
              absoluteOffset,
              childParsed.duration
            )
          );
          absoluteOffset += childParsed.duration;
        }
      }
    } else {
      const id = uid();
      const interval: Interval = {
        id,
        duration: parsed.duration,
        targets: parsed.targets,
      };
      intervalsById[id] = interval;
      intervalIds.push(id);

      instructions.push(
        ...processTextBlocks(
          item.children,
          absoluteOffset,
          parsed.duration
        )
      );
      absoluteOffset += parsed.duration;
    }
  }

  return { name, intervalsById, intervalIds, instructions };
}
