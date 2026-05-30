import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { ResourceList } from './components/ResourceList';
import { ElementTree } from './components/ElementTree';
import { ProfileExtensions } from './components/ProfileExtensions';
import { ProfileChecklist } from './components/ProfileChecklist';
import { ExampleViewer } from './components/ExampleViewer';
import { RelationshipGraph } from './components/RelationshipGraph';
import { CodeSystemView, ValueSetView } from './components/TerminologyView';
import { CapabilityView } from './components/CapabilityView';
import { Orientation } from './components/Orientation';
import { ConformanceChecker } from './components/ConformanceChecker';
import { MessageAssembler } from './components/MessageAssembler';
import { CommandPalette } from './components/CommandPalette';
import { CodeDecoder } from './components/CodeDecoder';
import {
  SPEC,
  capabilityByName,
  codeSystemByName,
  extensionByName,
  profileByName,
  valueSetByName,
} from './fhir/spec';
import type { Selection } from './fhir/spec';
import { artifactExists } from './orientation';
import { encodeRoute, parseRoute } from './fhir/route';
import type { AppMode } from './fhir/route';

type ProfileTab = 'explorer' | 'checklist' | 'relationships' | 'template';

interface ValidateSeed {
  json: unknown;
  title?: string;
  nonce: number;
}

const initialRoute = parseRoute(typeof window !== 'undefined' ? window.location.hash : '');
const validSelection = (sel?: Selection): Selection | undefined =>
  sel && artifactExists(sel) ? sel : undefined;

export default function App() {
  const [mode, setMode] = useState<AppMode>(initialRoute.mode ?? 'orientation');
  const [selected, setSelected] = useState<Selection>(
    validSelection(initialRoute.selection) ?? { kind: 'profile', name: SPEC.profiles[0].name },
  );
  const [tab, setTab] = useState<ProfileTab>((initialRoute.tab as ProfileTab) ?? 'explorer');
  const [anchor, setAnchor] = useState<string | undefined>(initialRoute.anchor);
  const [seed, setSeed] = useState<ValidateSeed | undefined>();
  const nonce = useRef(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [decode, setDecode] = useState<string | null>(null);

  // Cmd/Ctrl-K opens the global search palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the URL hash in sync so refresh restores the view and links are shareable.
  useEffect(() => {
    const want = encodeRoute({ mode, selection: selected, tab, anchor });
    if (window.location.hash.replace(/^#/, '') !== want) {
      window.history.replaceState(null, '', `#${want}`);
    }
  }, [mode, selected, tab, anchor]);

  function navigate(sel: Selection, at?: string) {
    setSelected(sel);
    setAnchor(at);
    if (sel.kind === 'profile') setTab('explorer');
  }

  // Jump from a business event / search result to its artifact in Reference mode.
  function openArtifact(sel: Selection, at?: string) {
    setMode('reference');
    navigate(sel, at);
  }

  function openValidator(json: unknown, title?: string) {
    nonce.current += 1;
    setSeed({ json, title, nonce: nonce.current });
    setMode('validate');
  }

  const MODES: [AppMode, string][] = [
    ['orientation', 'Orientation'],
    ['reference', 'Reference'],
    ['validate', 'Validate'],
    ['build', 'Build'],
  ];

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
        <div className="app__headtools">
          <button type="button" className="app__search" onClick={() => setPaletteOpen(true)}>
            <span aria-hidden>🔍</span> Search <kbd>⌘K</kbd>
          </button>
          <div className="mode-toggle" role="tablist" aria-label="Mode">
            {MODES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`mode-toggle__btn${mode === id ? ' mode-toggle__btn--active' : ''}`}
                onClick={() => setMode(id)}
                aria-selected={mode === id}
              >
                {label}
              </button>
            ))}
          </div>
          <a className="app__version" href={SPEC.meta.guideUrl} target="_blank" rel="noreferrer">
            guide v{SPEC.meta.guideVersion} · pkg {SPEC.meta.packageVersion} · FHIR{' '}
            {SPEC.meta.fhirVersion} ↗
          </a>
        </div>
      </header>

      {mode === 'orientation' && (
        <main className="app__main app__main--full">
          <Orientation onOpenArtifact={openArtifact} onValidate={openValidator} />
        </main>
      )}

      {mode === 'validate' && (
        <main className="app__main app__main--full">
          <h2 className="view-title">Conformance checker</h2>
          <ConformanceChecker key={seed?.nonce ?? 'blank'} seed={seed} onOpen={openArtifact} />
        </main>
      )}

      {mode === 'build' && (
        <main className="app__main app__main--full">
          <h2 className="view-title">Message builder</h2>
          <MessageAssembler onValidate={openValidator} />
        </main>
      )}

      {mode === 'reference' && (
        <div className="app__body">
          <aside className="app__sidebar">
            <ResourceList selected={selected} onSelect={navigate} />
          </aside>
          <main className="app__main">
            <Detail
              selected={selected}
              tab={tab}
              setTab={setTab}
              navigate={navigate}
              anchor={anchor}
              onValidate={openValidator}
            />
          </main>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpen={openArtifact}
          onDecode={(c) => setDecode(c)}
        />
      )}
      {decode && <CodeDecoder code={decode} onClose={() => setDecode(null)} onOpen={openArtifact} />}
    </div>
  );
}

function Detail({
  selected,
  tab,
  setTab,
  navigate,
  anchor,
  onValidate,
}: {
  selected: Selection;
  tab: ProfileTab;
  setTab: (t: ProfileTab) => void;
  navigate: (sel: Selection, at?: string) => void;
  anchor?: string;
  onValidate: (json: unknown, title?: string) => void;
}) {
  const profile = selected.kind === 'profile' ? profileByName.get(selected.name) : undefined;
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
                ['checklist', 'Checklist'],
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
              <>
                <ProfileExtensions uses={profile.extensionsOnProfile} onNavigate={navigate} />
                <ElementTree elements={profile.elements} onNavigate={navigate} anchor={anchor} />
              </>
            )}
            {tab === 'checklist' && <ProfileChecklist profile={profile} onNavigate={navigate} />}
            {tab === 'relationships' && (
              <RelationshipGraph focus={profile.name} onNavigate={navigate} />
            )}
            {tab === 'template' && (
              <ExampleViewer example={profile.template} onValidate={onValidate} />
            )}
          </section>
        </>
      ) : (
        <section className="view">
          <ArtifactBody selected={selected} navigate={navigate} anchor={anchor} />
        </section>
      )}
    </>
  );
}

function ArtifactBody({
  selected,
  navigate,
  anchor,
}: {
  selected: Selection;
  navigate: (sel: Selection, at?: string) => void;
  anchor?: string;
}) {
  switch (selected.kind) {
    case 'extension': {
      const ext = extensionByName.get(selected.name);
      return ext ? <ElementTree elements={ext.elements} onNavigate={navigate} anchor={anchor} /> : null;
    }
    case 'valueSet': {
      const vs = valueSetByName.get(selected.name);
      return vs ? <ValueSetView valueSet={vs} anchor={anchor} /> : null;
    }
    case 'codeSystem': {
      const cs = codeSystemByName.get(selected.name);
      return cs ? <CodeSystemView codeSystem={cs} anchor={anchor} /> : null;
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
