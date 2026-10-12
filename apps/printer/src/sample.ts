// Example items for `--sample` previews (never printed: --sample implies --dry-run).
import type { Item } from "./api.ts";

const TEXTS: [string, boolean][] = [
  ["Call Grandma on Sundays", true],
  ["Protect sleep during finals week", true],
  ["Ask Ms. Levin about the summer research program", false],
  ['Read "Thinking in Systems" over winter break', false],
  ["Noa's birthday is in November; start thinking about a gift", false],
  ["Be the one who follows up", false],
  ["A bike rack by the library entrance", false],
  ["Robotics: ask Dev if the team still needs someone for the build log", false],
  ["Drink water before coffee", false],
  ["Write down three things that went well each Friday", false],
  ["Mom's shift changes in December; plan the drives to practice around it", false],
  ["Look into the city's free museum days", false],
  ["When something feels urgent, ask whether it will matter in a month", false],
  ["Thank Mr. Okafor for the recommendation letter", false],
];

export const SAMPLE_ITEMS: Item[] = TEXTS.map(([text, pinned], i) => ({
  id: `sample-${i + 1}`,
  text,
  category: null,
  pinned,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  archivedAt: null,
}));
