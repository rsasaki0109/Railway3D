import type { ProfileSample, SyntheticElevationProfile } from './profile-controller';
import { clampProfileChainage, findNearestProfileSample } from './profile-controller';
import type { ProfileScales } from './profile-scales';

export interface ProfileHitResult {
  chainageM: number;
  sample: ProfileSample;
  errorM: number;
}

export function chainageFromChartX(chartX: number, scales: ProfileScales): number {
  return scales.x.clamp(scales.x.invert(chartX));
}

export function nearestSampleFromChartX(
  profile: SyntheticElevationProfile,
  chartX: number,
  scales: ProfileScales,
): ProfileHitResult {
  const chainageM = clampProfileChainage(profile, chainageFromChartX(chartX, scales));
  const sample = findNearestProfileSample(profile, chainageM);

  return {
    chainageM,
    sample,
    errorM: Math.abs(sample.chainageM - chainageM),
  };
}

export function isHitWithinSampleInterval(
  profile: SyntheticElevationProfile,
  chainageM: number,
): boolean {
  const nearest = findNearestProfileSample(profile, chainageM);
  return Math.abs(nearest.chainageM - chainageM) <= profile.sampleIntervalTargetM;
}
