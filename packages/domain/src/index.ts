export const RAILWAY3D_DOMAIN_PACKAGE = '@railway3d/domain';

export function isRailway3dEntityId(value: string): boolean {
  return /^r3d:[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+:[A-Za-z0-9._:-]+$/.test(value);
}

export function deriveClearance(rail: number | null, ground: number | null): number | null {
  return rail === null || ground === null ? null : rail - ground;
}

export function deriveDepth(clearance: number | null): number | null {
  return clearance === null ? null : Math.max(0, -clearance);
}

export function deriveHeightAboveGround(clearance: number | null): number | null {
  return clearance === null ? null : Math.max(0, clearance);
}

export function gradientPermille(deltaZ: number, horizontalM: number): number | null {
  return horizontalM <= 0 ? null : (deltaZ / horizontalM) * 1000;
}
