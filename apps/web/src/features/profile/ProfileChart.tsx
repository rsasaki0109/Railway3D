import { useMemo, useState, type PointerEvent, type KeyboardEvent } from 'react';

import { chainageFromChartX } from './profile-hit-test';
import { createProfileScales, type ProfileScales } from './profile-scales';
import {
  DEFAULT_PROFILE_CURSOR_CHAINAGE_M,
  findNearestProfileSample,
  formatChainageKm,
  formatElevation,
  splitRailSegments,
  stepProfileCursor,
  type ProfileSample,
  type SyntheticElevationProfile,
} from './profile-controller';
import type { StructureType } from '../../renderer/railway/render-types';

const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const CHART_PADDING = { left: 54, right: 18, top: 18, bottom: 46 };

const STRUCTURE_BAND_COLORS = {
  underground_tunnel: '#4868a8',
  cut_and_cover_tunnel: '#516fa8',
  mountain_tunnel: '#44597f',
  undersea_tunnel: '#315f82',
  station_box: '#6d5fa8',
  surface: '#5f7b5e',
  cutting: '#8a7453',
  embankment: '#8d7f4b',
  viaduct: '#b46b21',
  bridge: '#8c4f91',
  at_grade_crossing: '#6c735a',
  depot: '#63747c',
  unknown: '#7a8286',
} as const satisfies Record<StructureType, string>;

function pointsToPath(points: readonly [number, number][]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
}

function buildGroundPath(samples: readonly ProfileSample[], scales: ProfileScales): string {
  const points: [number, number][] = [];
  for (const sample of samples) {
    if (sample.groundElevationM === null) {
      continue;
    }
    points.push([scales.x.scale(sample.chainageM), scales.y.scale(sample.groundElevationM)]);
  }

  return pointsToPath(points);
}

function buildRailPath(samples: readonly ProfileSample[], scales: ProfileScales): string {
  const points: [number, number][] = [];
  for (const sample of samples) {
    if (sample.railElevationM === null) {
      continue;
    }
    points.push([scales.x.scale(sample.chainageM), scales.y.scale(sample.railElevationM)]);
  }

  return pointsToPath(points);
}

function buildBandPath(samples: readonly ProfileSample[], scales: ProfileScales): string {
  const knownSamples = samples.filter(
    (sample): sample is ProfileSample & { railElevationM: number } =>
      sample.railElevationM !== null,
  );
  const top = knownSamples.map<[number, number]>((sample) => [
    scales.x.scale(sample.chainageM),
    scales.y.scale(sample.railElevationM + sample.uncertaintyM),
  ]);
  const bottom = [...knownSamples]
    .reverse()
    .map<
      [number, number]
    >((sample) => [scales.x.scale(sample.chainageM), scales.y.scale(sample.railElevationM - sample.uncertaintyM)]);

  return `${pointsToPath([...top, ...bottom])} Z`;
}

function getChartX(event: PointerEvent<SVGSVGElement>): number {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (bounds.width <= 0) {
    return CHART_PADDING.left;
  }

  return ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
}

function getCursorChainage(
  profile: SyntheticElevationProfile,
  cursorChainageM: number | null,
): number {
  return cursorChainageM ?? DEFAULT_PROFILE_CURSOR_CHAINAGE_M;
}

export function ProfileChart({
  profile,
  cursorChainageM,
  onCursorChange,
  onBrushRange,
}: {
  profile: SyntheticElevationProfile;
  cursorChainageM: number | null;
  onCursorChange(chainageM: number): void;
  onBrushRange(range: readonly [number, number]): void;
}) {
  const scales = useMemo(
    () => createProfileScales(profile.samples, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING),
    [profile.samples],
  );
  const railSegments = useMemo(() => splitRailSegments(profile.samples), [profile.samples]);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const cursorChainage = getCursorChainage(profile, cursorChainageM);
  const cursorSample = findNearestProfileSample(profile, cursorChainage);
  const cursorX = scales.x.scale(cursorChainage);
  const cursorY =
    cursorSample.railElevationM !== null
      ? scales.y.scale(cursorSample.railElevationM)
      : scales.y.range[0];
  const brushRange =
    brushStart === null || brushEnd === null
      ? null
      : ([Math.min(brushStart, brushEnd), Math.max(brushStart, brushEnd)] as const);

  const updateCursorFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const chainageM = chainageFromChartX(getChartX(event), scales);
    onCursorChange(chainageM);
    return chainageM;
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const chainageM = updateCursorFromPointer(event);
    setBrushStart(chainageM);
    setBrushEnd(chainageM);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const chainageM = updateCursorFromPointer(event);
    if (brushStart !== null) {
      setBrushEnd(chainageM);
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const chainageM = updateCursorFromPointer(event);
    if (brushStart !== null && Math.abs(chainageM - brushStart) >= profile.sampleIntervalTargetM) {
      onBrushRange([brushStart, chainageM]);
    }
    setBrushStart(null);
    setBrushEnd(null);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onCursorChange(stepProfileCursor(profile, cursorChainageM, -1));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onCursorChange(stepProfileCursor(profile, cursorChainageM, 1));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onCursorChange(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onCursorChange(profile.totalLengthM);
    }
  };

  return (
    <svg
      className="profile-chart"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={`${profile.title}; cursor ${formatChainageKm(cursorChainage)}`}
      data-testid="profile-chart"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <rect width={CHART_WIDTH} height={CHART_HEIGHT} className="profile-chart-bg" />
      {profile.samples.slice(0, -1).map((sample, index) => {
        const next = profile.samples[index + 1];
        if (next === undefined) {
          return null;
        }
        const x = scales.x.scale(sample.chainageM);
        const width = scales.x.scale(next.chainageM) - x;
        return (
          <rect
            key={`structure-${sample.chainageM}`}
            x={x}
            y={CHART_HEIGHT - CHART_PADDING.bottom + 12}
            width={width}
            height="10"
            fill={STRUCTURE_BAND_COLORS[sample.structure]}
            opacity="0.72"
          />
        );
      })}
      <line
        x1={CHART_PADDING.left}
        x2={CHART_WIDTH - CHART_PADDING.right}
        y1={CHART_HEIGHT - CHART_PADDING.bottom}
        y2={CHART_HEIGHT - CHART_PADDING.bottom}
        className="profile-axis"
      />
      <line
        x1={CHART_PADDING.left}
        x2={CHART_PADDING.left}
        y1={CHART_PADDING.top}
        y2={CHART_HEIGHT - CHART_PADDING.bottom}
        className="profile-axis"
      />
      <path d={buildGroundPath(profile.samples, scales)} className="profile-ground-line" />
      {railSegments.map((segment) => (
        <path
          key={`band-${segment.id}`}
          d={buildBandPath(segment.samples, scales)}
          className="profile-uncertainty-band"
        />
      ))}
      {railSegments.map((segment) => (
        <path
          key={segment.id}
          d={buildRailPath(segment.samples, scales)}
          className="profile-rail-line"
          data-testid="profile-rail-segment"
        />
      ))}
      {profile.markers.map((marker) => {
        const x = scales.x.scale(marker.chainageM);
        return (
          <g key={`${marker.kind}-${marker.chainageM}`}>
            <line
              x1={x}
              x2={x}
              y1={CHART_PADDING.top}
              y2={CHART_HEIGHT - CHART_PADDING.bottom}
              className="profile-marker-line"
            />
            <text x={x + 4} y={CHART_PADDING.top + 12} className="profile-marker-label">
              {marker.label}
            </text>
          </g>
        );
      })}
      {brushRange !== null ? (
        <rect
          x={scales.x.scale(brushRange[0])}
          y={CHART_PADDING.top}
          width={scales.x.scale(brushRange[1]) - scales.x.scale(brushRange[0])}
          height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
          className="profile-brush"
        />
      ) : null}
      <line
        x1={cursorX}
        x2={cursorX}
        y1={CHART_PADDING.top}
        y2={CHART_HEIGHT - CHART_PADDING.bottom}
        className="profile-cursor-line"
      />
      <circle
        cx={cursorX}
        cy={cursorY}
        r="5"
        className={
          cursorSample.railElevationM === null ? 'profile-cursor-unknown' : 'profile-cursor'
        }
      />
      <text
        x={Math.min(cursorX + 8, CHART_WIDTH - 128)}
        y={Math.max(cursorY - 8, CHART_PADDING.top + 12)}
        className="profile-cursor-label"
      >
        {formatElevation(cursorSample.railElevationM)}
      </text>
    </svg>
  );
}
