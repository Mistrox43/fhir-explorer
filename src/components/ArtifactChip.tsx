import type { ArtifactRef } from '../orientation/types';
import type { Selection } from '../fhir/spec';
import { artifactExists } from '../orientation';

interface Props {
  artifact: ArtifactRef;
  onOpen: (sel: Selection) => void;
}

/**
 * A chip linking to a SERIS artifact. Clickable when the artifact exists in
 * SPEC; rendered as plain text otherwise so links can never dead-end.
 */
export function ArtifactChip({ artifact, onOpen }: Props) {
  const exists = artifactExists(artifact);
  if (!exists) {
    return <span className="ref-chip ref-chip--disabled">{artifact.name}</span>;
  }
  return (
    <button
      type="button"
      className="ref-chip"
      onClick={() => onOpen({ kind: artifact.kind, name: artifact.name })}
    >
      {artifact.name} →
    </button>
  );
}
