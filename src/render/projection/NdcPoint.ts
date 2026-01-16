/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 *
 * Mapping to pixel coordinates is done separately via `ndcToScreen`.
 */

export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}
