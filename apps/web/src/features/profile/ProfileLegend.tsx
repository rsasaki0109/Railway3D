export function ProfileLegend() {
  return (
    <div className="profile-legend" data-testid="profile-legend" aria-label="Profile legend">
      <span>
        <i className="profile-key profile-key-rail" aria-hidden="true" /> Rail elevation
      </span>
      <span>
        <i className="profile-key profile-key-ground" aria-hidden="true" /> Ground elevation
      </span>
      <span>
        <i className="profile-key profile-key-band" aria-hidden="true" /> Uncertainty band
      </span>
      <span>
        <i className="profile-key profile-key-gap" aria-hidden="true" /> Null rail gap
      </span>
    </div>
  );
}
