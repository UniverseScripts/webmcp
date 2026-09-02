/**
 * Presentation coordinates for FlashCart. Semantic truth stays on the graph;
 * this file is only where boxes sit on the studio canvas.
 *
 * Gap between nodes must stay larger than an edge-label pill (~80px). The first
 * layout used a 24px gap, which is why protocol text sat inside the next box.
 */

export const NODE_W = 184;
export const NODE_H = 82;
export const CANVAS_W = 1720;
export const CANVAS_H = 540;

const COL = 290; // 184 node + 106px gap so protocol pills sit neatly on wires
const SYNC_Y = 64;
const BRANCH_Y = 224;
const ASYNC_Y = 388;

const LAYOUT: Record<string, { x: number; y: number }> = {
  browser: { x: 28, y: SYNC_Y },
  cdn: { x: 28 + COL, y: SYNC_Y },
  gateway: { x: 28 + COL * 2, y: SYNC_Y },
  checkout: { x: 28 + COL * 3, y: SYNC_Y },
  redis: { x: 28 + COL * 4, y: SYNC_Y },
  product_db: { x: 28 + COL * 5, y: SYNC_Y },
  order_db: { x: 28 + COL * 4, y: BRANCH_Y },
  order_queue: { x: 28 + COL * 3, y: ASYNC_Y },
  invoice_worker: { x: 28 + COL * 4, y: ASYNC_Y },
  email: { x: 28 + COL * 5, y: ASYNC_Y },
};

export function nodePosition(id: string, unknownIndex: number): { x: number; y: number } {
  return LAYOUT[id] ?? { x: 28 + (unknownIndex % 6) * COL, y: 468 };
}

export function nodeCenter(id: string, unknownIndex: number): { x: number; y: number } {
  const p = nodePosition(id, unknownIndex);
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
}

/** Anchor on the box edge facing the neighbour, so the wire never starts inside the card. */
export function nodePort(
  id: string,
  unknownIndex: number,
  toward: { x: number; y: number },
): { x: number; y: number } {
  const p = nodePosition(id, unknownIndex);
  const c = nodeCenter(id, unknownIndex);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? p.x + NODE_W : p.x, y: c.y };
  }
  return { x: c.x, y: dy > 0 ? p.y + NODE_H : p.y };
}
