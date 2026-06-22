import type { ProfileSample } from './profile-controller';
import { getFiniteElevationValues } from './profile-controller';

export interface ProfilePadding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LinearScale {
  domain: readonly [number, number];
  range: readonly [number, number];
  scale(value: number): number;
  invert(value: number): number;
  clamp(value: number): number;
}

export interface ProfileScales {
  x: LinearScale;
  y: LinearScale;
  width: number;
  height: number;
  padding: ProfilePadding;
}

function normalizeDomain(domain: readonly [number, number]): readonly [number, number] {
  if (domain[0] === domain[1]) {
    return [domain[0] - 1, domain[1] + 1];
  }

  return domain;
}

export function createLinearScale(
  domainInput: readonly [number, number],
  rangeInput: readonly [number, number],
): LinearScale {
  const domain = normalizeDomain(domainInput);
  const range = normalizeDomain(rangeInput);
  const domainSpan = domain[1] - domain[0];
  const rangeSpan = range[1] - range[0];

  return {
    domain,
    range,
    scale(value: number) {
      return range[0] + ((value - domain[0]) / domainSpan) * rangeSpan;
    },
    invert(value: number) {
      return domain[0] + ((value - range[0]) / rangeSpan) * domainSpan;
    },
    clamp(value: number) {
      return Math.min(Math.max(value, domain[0]), domain[1]);
    },
  };
}

export function createProfileScales(
  samples: readonly ProfileSample[],
  width: number,
  height: number,
  padding: ProfilePadding,
): ProfileScales {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const xDomain: readonly [number, number] =
    first === undefined || last === undefined ? [0, 1] : [first.chainageM, last.chainageM];
  const elevationValues = getFiniteElevationValues(samples);
  const minElevation = elevationValues.length > 0 ? Math.min(...elevationValues) : 0;
  const maxElevation = elevationValues.length > 0 ? Math.max(...elevationValues) : 1;
  const paddingM = Math.max((maxElevation - minElevation) * 0.12, 2);

  return {
    x: createLinearScale(xDomain, [padding.left, width - padding.right]),
    y: createLinearScale(
      [minElevation - paddingM, maxElevation + paddingM],
      [height - padding.bottom, padding.top],
    ),
    width,
    height,
    padding,
  };
}
