import { useState } from 'react';
import './App.css';
import { ResourceList } from './components/ResourceList';
import { ElementTree } from './components/ElementTree';
import { ExampleViewer } from './components/ExampleViewer';
import { RelationshipGraph } from './components/RelationshipGraph';
import { RESOURCE_BY_NAME, RESOURCES } from './fhir/data';

type View = 'explorer' | 'relationships' | 'examples';

const VIEWS: { id: View; label: string }[] = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'examples', label: 'Examples' },
];

export default function App() {
  const [selected, setSelected] = useState<string>(RESOURCES[0].name);
  const [view, setView] = useState<View>('explorer');
  const resource = RESOURCE_BY_NAME[selected];

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden>
            ⚕
          </span>
          <div>
            <h1>FHIR Explorer</h1>
            <p className="app__tagline">An intuitive guide to the FHIR R4 specification</p>
          </div>
        </div>
      </header>

      <div className="app__body">
        <aside className="app__sidebar">
          <ResourceList selected={selected} onSelect={setSelected} />
        </aside>

        <main className="app__main">
          <div className="resource-header">
            <div>
              <h2>{resource.name}</h2>
              <p>{resource.description}</p>
            </div>
            <a className="spec-link" href={resource.url} target="_blank" rel="noreferrer">
              HL7 spec ↗
            </a>
          </div>

          <nav className="tabs" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`tab${view === v.id ? ' tab--active' : ''}`}
                onClick={() => setView(v.id)}
                aria-current={view === v.id}
              >
                {v.label}
              </button>
            ))}
          </nav>

          <section className="view">
            {view === 'explorer' && <ElementTree resource={resource} onNavigate={setSelected} />}
            {view === 'relationships' && (
              <RelationshipGraph focus={resource.name} onNavigate={setSelected} />
            )}
            {view === 'examples' && <ExampleViewer resource={resource} />}
          </section>
        </main>
      </div>
    </div>
  );
}
