/**
 * Presentation coordinates for FlashCart. Semantic truth stays on the graph;
 * this file is only where boxes sit on the studio canvas.
 */

export const NODE_W = 148;
export const NODE_H = 68;
export const CANVAS_W = 1120;
export const CANVAS_H = 460;

const LAYOUT: Record<string, { x: number; y: number }> = {
  browser: { x: 24, y: 48 },
  cdn: { x: 196, y: 48 },
  gateway: { x: 368, y: 48 },
  checkout: { x: 540, y: 48 },
  redis: { x: 732, y: 48 },
  product_db: { x: 924, y: 48 },
  order_db: { x: 732, y: 168 },
  order_queue: { x: 540, y: 308 },
  invoice_worker: { x: 732, y: 308 },
  email: { x: 924, y: 308 },
};

export function nodePosition(id: string, unknownIndex: number): { x: number; y: number } {
  return LAYOUT[id] ?? { x: 24 + (unknownIndex % 6) * 176, y: 400 };
}

export function nodeCenter(id: string, unknownIndex: number): { x: number; y: number } {
  const p = nodePosition(id, unknownIndex);
  return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
}
