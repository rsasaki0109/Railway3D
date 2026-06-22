import type {
  ColorMode,
  StructureType,
  VisualizationState,
} from '../../renderer/railway/render-types';
import type { Rgb } from '../../renderer/railway/style-resolver';
import {
  CONFIDENCE_COLORS,
  STRUCTURE_COLORS,
  resolveClearanceColor,
  resolveGradientColor,
} from '../../renderer/railway/style-resolver';

export interface LegendEntry {
  label: string;
  color: Rgb;
  visualCue: string;
}

export interface LegendDefinition {
  title: string;
  unit?: string;
  entries: readonly LegendEntry[];
  notes: readonly string[];
}

export const STRUCTURE_LABELS = {
  underground_tunnel: 'Underground tunnel',
  cut_and_cover_tunnel: 'Cut-and-cover tunnel',
  mountain_tunnel: 'Mountain tunnel',
  undersea_tunnel: 'Undersea tunnel',
  station_box: 'Station box',
  surface: 'Surface',
  cutting: 'Cutting',
  embankment: 'Embankment',
  viaduct: 'Viaduct',
  bridge: 'Bridge',
  at_grade_crossing: 'At-grade crossing',
  depot: 'Depot',
  unknown: 'Unknown structure',
} as const satisfies Record<StructureType, string>;

function entry(label: string, color: Rgb, visualCue: string): LegendEntry {
  return { label, color, visualCue };
}

const lineLegend: LegendDefinition = {
  title: 'Line color',
  entries: [
    entry('Golden Fixture Line', [47, 111, 115], 'solid route stroke'),
    entry('Low or unknown confidence', [16, 40, 32], 'wider uncertainty cue when enabled'),
  ],
  notes: ['Line colors fall back to a darker stroke when contrast is too low.'],
};

const structureLegend: LegendDefinition = {
  title: 'Structure',
  entries: Object.entries(STRUCTURE_LABELS).map(([structure, label]) =>
    entry(label, STRUCTURE_COLORS[structure as StructureType], 'category label and stroke color'),
  ),
  notes: ['Structure categories come from the synthetic fixture only.'],
};

const clearanceLegend: LegendDefinition = {
  title: 'Ground clearance',
  unit: 'm',
  entries: [
    entry('<= -30 deep underground', resolveClearanceColor(-30), 'negative value label'),
    entry('-30 to < 0 underground', resolveClearanceColor(-10), 'negative value label'),
    entry('0 to 10 near surface', resolveClearanceColor(0), 'zero/near-surface label'),
    entry('> 10 to 30 elevated', resolveClearanceColor(20), 'positive value label'),
    entry('> 30 high elevated', resolveClearanceColor(40), 'positive value label'),
    entry('Unknown clearance', resolveClearanceColor(null), 'gray unknown label'),
  ],
  notes: ['Null clearance is not converted to zero.'],
};

const gradientLegend: LegendDefinition = {
  title: 'Gradient',
  unit: 'permille',
  entries: [
    entry('< 10 gentle', resolveGradientColor(0), 'threshold label'),
    entry('10 to < 25 moderate', resolveGradientColor(10), 'threshold label'),
    entry('>= 25 steep', resolveGradientColor(25), 'threshold label'),
    entry('Unknown gradient', resolveGradientColor(null), 'gray unknown label'),
  ],
  notes: ['Synthetic fixture stores maximum absolute gradient for display.'],
};

const confidenceLegend: LegendDefinition = {
  title: 'Confidence',
  entries: [
    entry('Verified', CONFIDENCE_COLORS.verified, 'confidence text'),
    entry('High', CONFIDENCE_COLORS.high, 'confidence text'),
    entry('Medium', CONFIDENCE_COLORS.medium, 'confidence text'),
    entry('Low', CONFIDENCE_COLORS.low, 'confidence text and uncertainty cue'),
    entry('Unknown', CONFIDENCE_COLORS.unknown, 'gray unknown label'),
  ],
  notes: ['Confidence changes appearance and remains available as text.'],
};

const LEGENDS = {
  line: lineLegend,
  structure: structureLegend,
  clearance: clearanceLegend,
  gradient: gradientLegend,
  confidence: confidenceLegend,
} as const satisfies Record<ColorMode, LegendDefinition>;

export function getLegendDefinition(colorMode: ColorMode): LegendDefinition {
  return LEGENDS[colorMode];
}

export function getVisualizationBadges(visualization: VisualizationState): readonly string[] {
  return [
    `X-ray ${visualization.xrayMode}`,
    `Vertical x${visualization.verticalExaggeration}`,
    visualization.uncertaintyVisible ? 'Uncertainty on' : 'Uncertainty off',
  ];
}
