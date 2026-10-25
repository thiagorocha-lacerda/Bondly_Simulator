import { useEffect, useState } from 'react';
import type { ModuleId } from '@bondly/pricing-engine';
import { MODULE_CATALOG, validateDependencies } from '@bondly/pricing-engine';
import { usePricing } from '../hooks/usePricing';
import { useTheme } from '../hooks/useTheme';
import { useB2c } from '../hooks/useB2c';
import { QuickMode } from '../components/QuickMode';
import { AdvancedMode } from '../components/AdvancedMode';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { PreviewModal } from '../components/PreviewModal';
import { ServicesPanel } from '../components/ServicesPanel';
import { CampaignPanel } from '../components/CampaignPanel';
import { B2cPanel } from '../components/B2cPanel';
import { ArkaPanel } from '../components/ArkaPanel';
import { ScenarioPanel } from '../components/ScenarioPanel';

type Mode = 'quick' | 'advanced';
type Audience = 'internal' | 'external';

const MODULES_KEY = 'bondly-ws-modules';
function loadModules(): ModuleId[] {
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    return raw ? (JSON.parse(raw) as ModuleId[]) : ['points', 'engagement'];
  } catch {
    return ['points', 'engagement'];
  }
}

export function App() {
  const { input, result, update, reset } = usePricing();
  const [theme, setTheme] = useTheme();
  const b2c = useB2c();
  const [mode, setMode] = useState<Mode>('quick');
  const [audience, setAudience] = useState<Audience>('internal');
  const [preview, setPreview] = useState(false);
  const [modules, setModulesState] = useState<ModuleId[]>(loadModules);

  const setModules = (ids: ModuleId[]) => {
    setModulesState(ids);
    try {
      localStorage.setItem(MODULES_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    // a contagem de módulos selecionados alimenta o score de complexidade (R-011 / D-M1)
    update({ complexity: { modules: Math.max(1, ids.length) } });
  };

  // Fonte única também no BOOT: se a contagem salva no input divergir da seleção de módulos
  // persistida, a seleção vence (é a UI canônica). Evita cálculo com contagem defasada antes
  // do primeiro clique. Só dispara quando realmente diverge.
  useEffect(() => {
    const expected = Math.max(1, modules.length);
    if (input.complexity.modules !== expected) {
      update({ complexity: { modules: expected } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = () => {
    reset();
    b2c.reset();
    setModulesState(['points', 'engagement']);
    try {
      localStorage.setItem(MODULES_KEY, JSON.stringify(['points', 'engagement']));
    } catch {
      /* ignore */
    }
  };

  const depIssues = validateDependencies(modules).filter((i) => i.kind === 'required');

  return (
    <div className="wrap">
      <header className="app">
        <div>
          <div className="brand">
            BONDLY <span>· COMMERCIAL WORKSPACE</span>
          </div>
          <div className="meta">Pricing Engine {result.engineVersion} · premissas {result.premisesVersion} · {result.premisesHash}</div>
        </div>
        <div className="toggle" role="group" aria-label="Tema">
          <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Claro</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Escuro</button>
        </div>
      </header>

      <div className="stepper" role="tablist" aria-label="Modo de configuração">
        <button type="button" role="tab" aria-current={mode === 'quick' ? 'step' : undefined} onClick={() => setMode('quick')}>
          Modo rápido
        </button>
        <button type="button" role="tab" aria-current={mode === 'advanced' ? 'step' : undefined} onClick={() => setMode('advanced')}>
          Modo avançado
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" aria-current={audience === 'internal' ? 'step' : undefined} onClick={() => setAudience('internal')}>
          Visão interna
        </button>
        <button type="button" aria-current={audience === 'external' ? 'step' : undefined} onClick={() => setAudience('external')}>
          Visão comercial
        </button>
      </div>

      {depIssues.length > 0 && (
        <div className="note bad" role="alert">
          Dependências de módulos pendentes:{' '}
          {depIssues
            .map((i) => `${MODULE_CATALOG.find((m) => m.id === i.module)?.name} requer ${MODULE_CATALOG.find((m) => m.id === i.missing)?.name}`)
            .join('; ')}
          .
        </div>
      )}

      <div className="grid">
        <div>
          {mode === 'quick' ? (
            <QuickMode input={input} update={update} selectedModules={modules} onModules={setModules} />
          ) : (
            <>
              <AdvancedMode input={input} update={update} selectedModules={modules} onModules={setModules} />
              <div style={{ height: 16 }} />
              <ServicesPanel input={input} update={update} />
              <div style={{ height: 16 }} />
              <CampaignPanel input={input} update={update} />
              <div style={{ height: 16 }} />
              <B2cPanel input={b2c.input} include={b2c.include} set={b2c.set} setInclude={b2c.setInclude} />
            </>
          )}
          <div className="actions">
            <button className="cta" type="button" onClick={() => setPreview(true)}>
              Pré-visualizar → gerar PDF
            </button>
            <button className="ghostbtn" type="button" onClick={resetAll}>
              Voltar aos padrões
            </button>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            Armazenamento local (Cenário A): os dados ficam só neste navegador, não sincronizados entre usuários ou dispositivos.
          </p>
        </div>

        <div>
          <ResultsDashboard result={result} users={input.volume.users} audience={audience} />
          <ArkaPanel input={input} />
          <ScenarioPanel input={input} />
        </div>
      </div>

      {preview && <PreviewModal input={input} b2cInput={b2c.include ? b2c.input : undefined} audience={audience} onClose={() => setPreview(false)} />}
    </div>
  );
}
