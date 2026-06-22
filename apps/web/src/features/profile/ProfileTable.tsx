import type { SyntheticElevationProfile } from './profile-controller';
import { formatChainageKm, formatElevation, formatPermille } from './profile-controller';

export function ProfileTable({ profile }: { profile: SyntheticElevationProfile }) {
  return (
    <div className="profile-table-wrap" data-testid="profile-table">
      <ul className="profile-marker-list" aria-label="Profile markers">
        {profile.markers.map((marker) => (
          <li key={`${marker.kind}-${marker.chainageM}`}>
            {marker.label} · {formatChainageKm(marker.chainageM)} · {marker.kind}
          </li>
        ))}
      </ul>
      <table className="profile-table">
        <caption>Profile sample values</caption>
        <thead>
          <tr>
            <th scope="col">Chainage</th>
            <th scope="col">Rail</th>
            <th scope="col">Ground</th>
            <th scope="col">Clearance</th>
            <th scope="col">Gradient</th>
            <th scope="col">Quality</th>
          </tr>
        </thead>
        <tbody>
          {profile.samples.map((sample) => (
            <tr key={sample.chainageM}>
              <th scope="row">{formatChainageKm(sample.chainageM)}</th>
              <td>{formatElevation(sample.railElevationM)}</td>
              <td>{formatElevation(sample.groundElevationM)}</td>
              <td>{formatElevation(sample.clearanceM)}</td>
              <td>{formatPermille(sample.gradientPermille)}</td>
              <td>
                {sample.confidence} · {sample.structure.replaceAll('_', ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
