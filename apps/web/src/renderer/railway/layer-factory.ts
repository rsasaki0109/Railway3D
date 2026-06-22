import type { PickingInfo } from '@deck.gl/core';
import { type Layer } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';

import { filterXRayPaths } from './layer-filters';
import type { LayerBuildContext, RenderGuide, RenderPath, RenderStation } from './render-types';
import {
  isPathSelected,
  resolvePathColor,
  resolvePathWidth,
  resolveStationColor,
  resolveStationLineColor,
  resolveUncertaintyCueColor,
  resolveXRayCoreColor,
  resolveXRayHaloColor,
  shouldRenderUncertaintyCue,
} from './style-resolver';

function getPathAtCurrentExaggeration(ctx: LayerBuildContext) {
  return (path: RenderPath) => path.positionsByExaggeration[ctx.visualization.verticalExaggeration];
}

function getGuideAtCurrentExaggeration(ctx: LayerBuildContext) {
  return (guide: RenderGuide) => guide.pathByExaggeration[ctx.visualization.verticalExaggeration];
}

function getStationAtCurrentExaggeration(ctx: LayerBuildContext) {
  return (station: RenderStation) =>
    station.positionByExaggeration[ctx.visualization.verticalExaggeration];
}

function selectLineFromPickedPath(info: PickingInfo<RenderPath>, ctx: LayerBuildContext): void {
  const path = info.object;
  if (path === undefined || path === null) {
    return;
  }

  const lineId = path.lineIds[0];
  if (lineId === undefined) {
    return;
  }

  ctx.callbacks.onSelect({ kind: 'line', id: lineId });
}

function selectStation(info: PickingInfo<RenderStation>, ctx: LayerBuildContext): void {
  const station = info.object;
  if (station === undefined || station === null) {
    return;
  }

  ctx.callbacks.onSelect({ kind: 'station', id: station.id });
}

export function buildRailwayLayers(ctx: LayerBuildContext): Layer[] {
  const selectedPaths = ctx.dataset.paths.filter((path) => isPathSelected(path, ctx.selection));
  const xrayPaths = filterXRayPaths(ctx.dataset.paths, ctx.visualization.xrayMode, ctx.selection);
  const uncertaintyPaths = ctx.visualization.uncertaintyVisible
    ? ctx.dataset.paths.filter(shouldRenderUncertaintyCue)
    : [];
  const verticalGuides =
    ctx.selection === null || !ctx.visualization.guideVisible
      ? []
      : ctx.dataset.guides.filter((guide) =>
          selectedPaths.some((path) => path.segmentId === guide.segmentId),
        );
  const profileCursorData =
    ctx.profileCursor === null || !ctx.visualization.guideVisible ? [] : [ctx.profileCursor];
  const stationData = ctx.visualization.stationVisible ? ctx.dataset.stations : [];
  const stationLabelData =
    ctx.visualization.stationVisible && ctx.visualization.labelVisible ? ctx.dataset.stations : [];

  return [
    new PathLayer<RenderPath>({
      id: 'uncertainty-cue',
      data: uncertaintyPaths,
      getPath: getPathAtCurrentExaggeration(ctx),
      getColor: resolveUncertaintyCueColor,
      getWidth: 11,
      widthUnits: 'pixels',
      widthMinPixels: 7,
      widthMaxPixels: 16,
      jointRounded: true,
      capRounded: true,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
      },
    }),
    new PathLayer<RenderPath>({
      id: 'railway-physical',
      data: ctx.dataset.paths,
      getPath: getPathAtCurrentExaggeration(ctx),
      getColor: (path) => resolvePathColor(path, ctx.visualization),
      getWidth: (path) => resolvePathWidth(path, ctx.selection, ctx.visualization),
      widthUnits: 'pixels',
      widthMinPixels: 2,
      widthMaxPixels: 10,
      jointRounded: true,
      capRounded: true,
      pickable: true,
      autoHighlight: false,
      parameters: { depthCompare: 'less-equal', depthWriteEnabled: true },
      onHover: () => undefined,
      onClick: (info) => selectLineFromPickedPath(info, ctx),
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
        getColor: [ctx.visualization.colorMode, ctx.selection?.id],
        getWidth: [ctx.selection?.id, ctx.visualization.uncertaintyVisible],
      },
    }),
    new PathLayer<RenderPath>({
      id: 'railway-xray-halo',
      data: xrayPaths,
      getPath: getPathAtCurrentExaggeration(ctx),
      getColor: resolveXRayHaloColor,
      getWidth: 14,
      widthUnits: 'pixels',
      widthMinPixels: 8,
      widthMaxPixels: 20,
      jointRounded: true,
      capRounded: true,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
      },
    }),
    new PathLayer<RenderPath>({
      id: 'railway-xray-core',
      data: xrayPaths,
      getPath: getPathAtCurrentExaggeration(ctx),
      getColor: resolveXRayCoreColor,
      getWidth: 4,
      widthUnits: 'pixels',
      widthMinPixels: 2,
      widthMaxPixels: 8,
      jointRounded: true,
      capRounded: true,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
      },
    }),
    new ScatterplotLayer<RenderStation>({
      id: 'station-points',
      data: stationData,
      getPosition: getStationAtCurrentExaggeration(ctx),
      getRadius: 8,
      radiusUnits: 'pixels',
      getFillColor: (station) => resolveStationColor(station, ctx.selection),
      getLineColor: (station) => resolveStationLineColor(station, ctx.selection),
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      stroked: true,
      filled: true,
      pickable: true,
      parameters: { depthCompare: 'less-equal', depthWriteEnabled: true },
      onClick: (info) => selectStation(info, ctx),
      updateTriggers: {
        getPosition: [ctx.visualization.verticalExaggeration],
        getFillColor: [ctx.selection?.id],
        getLineColor: [ctx.selection?.id],
      },
    }),
    new TextLayer<RenderStation>({
      id: 'station-labels',
      data: stationLabelData,
      getPosition: getStationAtCurrentExaggeration(ctx),
      getText: (station) => station.name,
      getSize: 13,
      sizeUnits: 'pixels',
      getColor: [16, 40, 32, 230],
      getBackgroundColor: [246, 248, 249, 220],
      background: true,
      backgroundPadding: [4, 2],
      getPixelOffset: [0, -18],
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPosition: [ctx.visualization.verticalExaggeration],
      },
    }),
    new PathLayer<RenderPath>({
      id: 'selection-halo',
      data: selectedPaths,
      getPath: getPathAtCurrentExaggeration(ctx),
      getColor: [255, 246, 184, 190],
      getWidth: 9,
      widthUnits: 'pixels',
      widthMinPixels: 7,
      widthMaxPixels: 14,
      jointRounded: true,
      capRounded: true,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
      },
    }),
    new ScatterplotLayer({
      id: 'profile-cursor',
      data: profileCursorData,
      getPosition: (cursor) => cursor.position,
      getRadius: 7,
      radiusUnits: 'pixels',
      getFillColor: [16, 40, 32, 255],
      getLineColor: [255, 246, 184, 255],
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      stroked: true,
      filled: true,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
    }),
    new PathLayer<RenderGuide>({
      id: 'vertical-guide',
      data: verticalGuides,
      getPath: getGuideAtCurrentExaggeration(ctx),
      getColor: [16, 40, 32, 170],
      getWidth: 2,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      widthMaxPixels: 3,
      pickable: false,
      parameters: { depthCompare: 'always', depthWriteEnabled: false },
      updateTriggers: {
        getPath: [ctx.visualization.verticalExaggeration],
      },
    }),
  ];
}
