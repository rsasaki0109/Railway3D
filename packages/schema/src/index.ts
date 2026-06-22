export { createDatasetValidator, validateDatasetSemantics } from './validator';
export type {
  ElevationControlPoint,
  ElevationProfile,
  Railway3DDataSource,
  Railway3DDataset,
  Railway3DDatasetManifest,
  RailwayLine,
  RailwayOperator,
  RailwayRoute,
  RailwaySegment,
  RailwayStation,
  TrackAlignment,
} from './generated/v1';

export const SUPPORTED_SCHEMA_MAJOR = 1;
export const SCHEMA_PACKAGE_STATUS = 'bootstrap';
