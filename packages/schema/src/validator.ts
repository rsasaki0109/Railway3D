import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';

export const DATASET_SCHEMA_ID = 'https://railway3d.dev/schemas/v1/dataset.schema.json';

export interface DatasetValidationIssue {
  code:
    | 'SCHEMA_INVALID'
    | 'DANGLING_REFERENCE'
    | 'DUPLICATE_ID'
    | 'CHAINAGE_NOT_MONOTONIC'
    | 'HARD_CONTROL_MISMATCH'
    | 'ROUTE_SEGMENT_DISCONNECTED';
  path: string;
  message: string;
}

export type JsonSchema = Record<string, unknown>;

type IdRef = string;

interface PositionNode {
  nodeId: IdRef;
  position: readonly [number, number];
}

interface SegmentRef {
  segmentId: IdRef;
  forward: boolean;
}

interface StationRef {
  stationId: IdRef;
}

interface Route {
  id: IdRef;
  lineId: IdRef;
  segmentRefs: readonly SegmentRef[];
  stationSequence: readonly StationRef[];
}

interface Line {
  id: IdRef;
  operatorIds: readonly IdRef[];
  routeIds: readonly IdRef[];
}

interface Alignment {
  id: IdRef;
  segmentIds: readonly IdRef[];
}

interface Segment {
  id: IdRef;
  alignmentId: IdRef;
  from: PositionNode;
  to: PositionNode;
  profileId: IdRef;
}

interface Station {
  id: IdRef;
  operatorIds: readonly IdRef[];
  lineIds: readonly IdRef[];
}

interface ProfileSample {
  chainageM: number;
  railElevationM: number | null;
}

interface Profile {
  id: IdRef;
  ownerType: 'segment' | 'route' | 'alignment';
  ownerId: IdRef;
  samples: readonly ProfileSample[];
}

interface ControlPoint {
  id: IdRef;
  ownerId: IdRef;
  chainageM: number;
  hardConstraint: boolean;
  railElevation?: {
    valueM: number;
  };
}

interface DatasetForSemantics {
  sources: readonly { id: string }[];
  operators: readonly { id: IdRef }[];
  lines: readonly Line[];
  routes: readonly Route[];
  alignments: readonly Alignment[];
  segments: readonly Segment[];
  stations: readonly Station[];
  profiles: readonly Profile[];
  controlPoints: readonly ControlPoint[];
}

export function createDatasetValidator(schemas: readonly JsonSchema[]) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });

  for (const schema of schemas) {
    ajv.addSchema(schema);
  }

  const validateShape = ajv.getSchema(DATASET_SCHEMA_ID);
  if (validateShape === undefined) {
    throw new Error(`Schema not registered: ${DATASET_SCHEMA_ID}`);
  }

  return (dataset: unknown): DatasetValidationIssue[] => {
    if (!validateShape(dataset)) {
      return (validateShape.errors ?? []).map(schemaErrorToIssue);
    }

    return validateDatasetSemantics(dataset as DatasetForSemantics);
  };
}

export function validateDatasetSemantics(dataset: DatasetForSemantics): DatasetValidationIssue[] {
  const issues: DatasetValidationIssue[] = [];

  const operatorIds = collectIds(dataset.operators, '/operators', issues);
  const lineIds = collectIds(dataset.lines, '/lines', issues);
  const routeIds = collectIds(dataset.routes, '/routes', issues);
  const alignmentIds = collectIds(dataset.alignments, '/alignments', issues);
  const segmentIds = collectIds(dataset.segments, '/segments', issues);
  const stationIds = collectIds(dataset.stations, '/stations', issues);
  const profileIds = collectIds(dataset.profiles, '/profiles', issues);
  collectIds(dataset.sources, '/sources', issues);
  collectIds(dataset.controlPoints, '/controlPoints', issues);

  const segmentById = new Map(dataset.segments.map((segment) => [segment.id, segment]));
  const profileByOwner = new Map(dataset.profiles.map((profile) => [profile.ownerId, profile]));

  dataset.lines.forEach((line, index) => {
    expectRefs(line.operatorIds, operatorIds, `/lines/${index}/operatorIds`, issues);
    expectRefs(line.routeIds, routeIds, `/lines/${index}/routeIds`, issues);
  });

  dataset.routes.forEach((route, routeIndex) => {
    expectRef(route.lineId, lineIds, `/routes/${routeIndex}/lineId`, issues);
    route.segmentRefs.forEach((segmentRef, refIndex) => {
      expectRef(
        segmentRef.segmentId,
        segmentIds,
        `/routes/${routeIndex}/segmentRefs/${refIndex}/segmentId`,
        issues,
      );
    });
    route.stationSequence.forEach((stationRef, stationIndex) => {
      expectRef(
        stationRef.stationId,
        stationIds,
        `/routes/${routeIndex}/stationSequence/${stationIndex}/stationId`,
        issues,
      );
    });
    validateRouteContinuity(route, routeIndex, segmentById, issues);
  });

  dataset.alignments.forEach((alignment, index) => {
    expectRefs(alignment.segmentIds, segmentIds, `/alignments/${index}/segmentIds`, issues);
  });

  dataset.segments.forEach((segment, index) => {
    expectRef(segment.alignmentId, alignmentIds, `/segments/${index}/alignmentId`, issues);
    expectRef(segment.profileId, profileIds, `/segments/${index}/profileId`, issues);
  });

  dataset.stations.forEach((station, index) => {
    expectRefs(station.operatorIds, operatorIds, `/stations/${index}/operatorIds`, issues);
    expectRefs(station.lineIds, lineIds, `/stations/${index}/lineIds`, issues);
  });

  dataset.profiles.forEach((profile, index) => {
    const ownerIds =
      profile.ownerType === 'route'
        ? routeIds
        : profile.ownerType === 'segment'
          ? segmentIds
          : alignmentIds;
    expectRef(profile.ownerId, ownerIds, `/profiles/${index}/ownerId`, issues);
    validateMonotonicSamples(profile, index, issues);
  });

  dataset.controlPoints.forEach((controlPoint, index) => {
    if (!controlPoint.hardConstraint || controlPoint.railElevation === undefined) {
      return;
    }

    const profile = profileByOwner.get(controlPoint.ownerId);
    if (profile === undefined) {
      expectRef(controlPoint.ownerId, routeIds, `/controlPoints/${index}/ownerId`, issues);
      return;
    }

    const sample = profile.samples.find(
      (profileSample) => Math.abs(profileSample.chainageM - controlPoint.chainageM) < 1e-6,
    );
    if (
      sample === undefined ||
      sample.railElevationM === null ||
      Math.abs(sample.railElevationM - controlPoint.railElevation.valueM) > 1e-6
    ) {
      issues.push({
        code: 'HARD_CONTROL_MISMATCH',
        path: `/controlPoints/${index}`,
        message: `Hard control point ${controlPoint.id} does not match its profile sample.`,
      });
    }
  });

  return issues;
}

function schemaErrorToIssue(error: ErrorObject): DatasetValidationIssue {
  return {
    code: 'SCHEMA_INVALID',
    path: error.instancePath || '/',
    message: error.message ?? 'Schema validation failed.',
  };
}

function collectIds(
  items: readonly { id: string }[],
  path: string,
  issues: DatasetValidationIssue[],
): Set<string> {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    if (ids.has(item.id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        path: `${path}/${index}/id`,
        message: `Duplicate id: ${item.id}`,
      });
    }
    ids.add(item.id);
  });
  return ids;
}

function expectRefs(
  refs: readonly string[],
  allowedIds: ReadonlySet<string>,
  path: string,
  issues: DatasetValidationIssue[],
): void {
  refs.forEach((ref, index) => expectRef(ref, allowedIds, `${path}/${index}`, issues));
}

function expectRef(
  ref: string,
  allowedIds: ReadonlySet<string>,
  path: string,
  issues: DatasetValidationIssue[],
): void {
  if (!allowedIds.has(ref)) {
    issues.push({
      code: 'DANGLING_REFERENCE',
      path,
      message: `Dangling reference: ${ref}`,
    });
  }
}

function validateMonotonicSamples(
  profile: Profile,
  profileIndex: number,
  issues: DatasetValidationIssue[],
): void {
  for (let index = 1; index < profile.samples.length; index += 1) {
    const previous = profile.samples[index - 1];
    const current = profile.samples[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      current.chainageM <= previous.chainageM
    ) {
      issues.push({
        code: 'CHAINAGE_NOT_MONOTONIC',
        path: `/profiles/${profileIndex}/samples/${index}/chainageM`,
        message: `Profile ${profile.id} chainage must be strictly increasing.`,
      });
    }
  }
}

function validateRouteContinuity(
  route: Route,
  routeIndex: number,
  segmentById: ReadonlyMap<string, Segment>,
  issues: DatasetValidationIssue[],
): void {
  for (let index = 1; index < route.segmentRefs.length; index += 1) {
    const previousRef = route.segmentRefs[index - 1];
    const currentRef = route.segmentRefs[index];
    if (previousRef === undefined || currentRef === undefined) {
      continue;
    }
    const previousSegment = segmentById.get(previousRef.segmentId);
    const currentSegment = segmentById.get(currentRef.segmentId);
    if (previousSegment === undefined || currentSegment === undefined) {
      continue;
    }
    const previousEnd = previousRef.forward
      ? previousSegment.to.position
      : previousSegment.from.position;
    const currentStart = currentRef.forward
      ? currentSegment.from.position
      : currentSegment.to.position;
    if (!sameLngLat(previousEnd, currentStart)) {
      issues.push({
        code: 'ROUTE_SEGMENT_DISCONNECTED',
        path: `/routes/${routeIndex}/segmentRefs/${index}`,
        message: `Route ${route.id} has disconnected consecutive segments.`,
      });
    }
  }
}

function sameLngLat(left: readonly [number, number], right: readonly [number, number]): boolean {
  return Math.abs(left[0] - right[0]) < 1e-9 && Math.abs(left[1] - right[1]) < 1e-9;
}
