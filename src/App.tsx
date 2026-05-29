import { useMemo, useState } from 'react';
import './App.css';
import { ResourceList } from './components/ResourceList';
import { ElementTree } from './components/ElementTree';
import { ExampleViewer } from './components/ExampleViewer';
import { RelationshipGraph } from './components/RelationshipGraph';
import { CodeSystemView, ValueSetView } from './components/TerminologyView';
import { CapabilityView } from './components/CapabilityView';
import {
  SPEC,
  capabilityByName,
  codeSystemByName,
  extensionByName,
  profileByName,
  valueSetByName,
} from './fhir/spec';
import type { Selection } from './fhir/spec';

type ProfileTab = 'explorer' | 'relationships' | 'template';

export default function App() {
  const [selected, setSelected] = useState<Selection>({
    kind: 'profile',
    name: SPEC.profiles[0].name,
  });
  const [tab, setTab] = useState<ProfileTab>('explorer');

  function navigate(sel: Selection) {
    setSelected(sel);
    if (sel.kind === 'profile') setTab('explorer');
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden>
            ⚕
          </span>
          <div>
            <h1>SERIS Explorer</h1>
            <p className="app__tagline">
              An intuitive guide to the Ontario SERIS FHIR R4 Implementation Guide
            </p>
          </div>
        </div>
        <a className="app__version" href={SPEC.meta.guideUrl} target="_blank" rel="noreferrer">
          guide v{SPEC.meta.guideVersion} · pkg {SPEC.meta.packageVersion} · FHIR{' '}
          {SPEC.meta.fhirVersion} ↗
        </a>
      </header>

      <div className="app__body">
        <aside className="app__sidebar">
          <ResourceList selected={selected} onSelect={navigate} />
        </aside>

        <main className="app__main">
          <Detail selected={selected} tab={tab} setTab={setTab} navigate={navigate} />
        </main>
      </div>
    </div>
  );
}

function Detail({
  selected,
  tab,
  setTab,
  navigate,
}: {
  selected: Selection;
  tab: ProfileTab;
  setTab: (t: ProfileTab) => void;
  navigate: (sel: Selection) => void;
}) {
  const profile = selected.kind === 'profile' ? profileByName.get(selected.name) : undefined;

  // Header bits depend on the selected artifact kind.
  const header = useMemo(() => headerFor(selected), [selected]);

  return (
    <>
      <div className="resource-header">
        <div>
          <span className="resource-header__kind">{header.kindLabel}</span>
          <h2>{selected.name}</h2>
          {header.subtitle && <p>{header.subtitle}</p>}
          {header.contexts && (
            <p className="resource-header__contexts">
              Used on: {header.contexts.map((c) => <code key={c}>{c}</code>)}
            </p>
          )}
          {header.url && <code className="resource-header__url">{header.url}</code>}
        </div>
      </div>

      {profile ? (
        <>
          <nav className="tabs" aria-label="View">
            {(
              [
                ['explorer', 'Explorer'],
                ['relationships', 'Relationships'],
                ['template', 'Template'],
              ] as [ProfileTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tab${tab === id ? ' tab--active' : ''}`}
                onClick={() => setTab(id)}
                aria-current={tab === id}
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="view">
            {tab === 'explorer' && (
              <ElementTree elements={profile.elements} onNavigate={navigate} />
            )}
            {tab === 'relationships' && (
              <RelationshipGraph focus={profile.name} onNavigate={navigate} />
            )}
            {tab === 'template' && <ExampleViewer example={profile.template} />}
          </section>
        </>
      ) : (
        <section className="view">
          <ArtifactBody selected={selected} navigate={navigate} />
        </section>
      )}
    </>
  );
}

function ArtifactBody({
  selected,
  navigate,
}: {
  selected: Selection;
  navigate: (sel: Selection) => void;
}) {
  switch (selected.kind) {
    case 'extension': {
      const ext = extensionByName.get(selected.name);
      return ext ? <ElementTree elements={ext.elements} onNavigate={navigate} /> : null;
    }
    case 'valueSet': {
      const vs = valueSetByName.get(selected.name);
      return vs ? <ValueSetView valueSet={vs} /> : null;
    }
    case 'codeSystem': {
      const cs = codeSystemByName.get(selected.name);
      return cs ? <CodeSystemView codeSystem={cs} /> : null;
    }
    case 'capability': {
      const cap = capabilityByName.get(selected.name);
      return cap ? <CapabilityView capability={cap} onNavigate={navigate} /> : null;
    }
    default:
      return null;
  }
}

function headerFor(selected: Selection): {
  kindLabel: string;
  subtitle?: string;
  url?: string;
  contexts?: string[];
} {
  switch (selected.kind) {
    case 'profile': {
      const p = profileByName.get(selected.name);
      return {
        kindLabel: `Profile · constrains ${p?.baseType ?? ''}`,
        subtitle: p?.description,
        url: p?.url,
      };
    }
    case 'extension': {
      const e = extensionByName.get(selected.name);
      return { kindLabel: 'Extension', subtitle: e?.description, url: e?.url, contexts: e?.contexts };
    }
    case 'valueSet': {
      const v = valueSetByName.get(selected.name);
      return { kindLabel: 'Value Set', subtitle: v?.description, url: v?.url };
    }
    case 'codeSystem': {
      const c = codeSystemByName.get(selected.name);
      return { kindLabel: 'Code System', subtitle: c?.description, url: c?.url };
    }
    case 'capability': {
      const c = capabilityByName.get(selected.name);
      return { kindLabel: 'Capability Statement', subtitle: c?.description };
    }
  }
}
