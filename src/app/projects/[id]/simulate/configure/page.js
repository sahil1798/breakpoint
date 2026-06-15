'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { 
  Zap, 
  Target, 
  ShieldAlert, 
  Fingerprint, 
  Plus, 
  Sparkles,
  Search,
  Activity,
  Flame,
  Settings2,
  Users,
  Bot,
  Skull,
  Eye,
  Brain,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const presets = [
  { id: 'light', name: 'Surface Scan', icon: Search, agents: 20, gens: 2, description: 'Rapid probing of core boundaries.', color: '#3b82f6' },
  { id: 'standard', name: 'Standard Probe', icon: Zap, agents: 50, gens: 5, description: 'Balanced evolutionary simulation.', color: '#8b5cf6' },
  { id: 'deep', name: 'Deep Discovery', icon: ShieldAlert, agents: 100, gens: 7, description: 'Complex systemic exploitation.', color: '#f59e0b' },
  { id: 'adversarial', name: 'Adversarial Siege', icon: Flame, agents: 150, gens: 10, description: 'Maximum intensity red-teaming.', color: '#ef4444' },
];

const ARCHETYPES = [
  { id: 'novice', label: 'Novice', icon: Users, color: '#3b82f6', description: 'Unsophisticated users who stumble into edge cases' },
  { id: 'script_kiddie', label: 'Script Kiddie', icon: Bot, color: '#06b6d4', description: 'Tool-driven attackers using known exploits' },
  { id: 'social_engineer', label: 'Social Engineer', icon: Brain, color: '#f59e0b', description: 'Persuasion and trust-manipulation specialists' },
  { id: 'apt', label: 'APT / Nation State', icon: Skull, color: '#ef4444', description: 'Advanced persistent threat — methodical, patient' },
  { id: 'insider', label: 'Malicious Insider', icon: Eye, color: '#8b5cf6', description: 'Trusted user abusing privileged access' },
];

const DEFAULT_COMPOSITION = { novice: 20, script_kiddie: 25, social_engineer: 20, apt: 20, insider: 15 };

function CompositionSlider({ archetype, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${archetype.color}20`, color: archetype.color }}
          >
            <archetype.icon size={14} />
          </div>
          <span className="text-xs font-bold tracking-tight">{archetype.label}</span>
        </div>
        <span 
          className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md"
          style={{ color: archetype.color, backgroundColor: `${archetype.color}15` }}
        >
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ 
          background: `linear-gradient(to right, ${archetype.color} ${value}%, rgba(255,255,255,0.08) ${value}%)`,
          accentColor: archetype.color
        }}
      />
      <p className="text-[9px] text-[#334155] font-bold uppercase tracking-widest">{archetype.description}</p>
    </div>
  );
}

export default function SimulationConfigure() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [intensity, setIntensity] = useState('standard');
  const [focusAreas, setFocusAreas] = useState([]);
  const [newFocus, setNewFocus] = useState('');
  const [composition, setComposition] = useState({ ...DEFAULT_COMPOSITION });
  const [customAgents, setCustomAgents] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentPreset = presets.find(p => p.id === intensity);

  // Normalize composition so sum = 100
  const totalPct = Object.values(composition).reduce((a, b) => a + b, 0);
  
  const updateArchetype = (id, val) => {
    setComposition(prev => ({ ...prev, [id]: val }));
  };

  const normalizeComposition = () => {
    const total = Object.values(composition).reduce((a, b) => a + b, 0);
    if (total === 0) return DEFAULT_COMPOSITION;
    return Object.fromEntries(
      Object.entries(composition).map(([k, v]) => [k, Math.round((v / total) * 100)])
    );
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const normalizedComposition = normalizeComposition();
      
      // Parse custom agents from textarea (one per line)
      const parsedCustomAgents = customAgents
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(desc => ({ description: desc }));

      // 1. Configure
      const configRes = await fetch('/api/simulation/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: id, 
          intensity, 
          focusAreas,
          totalAgents: currentPreset.agents,
          totalGenerations: currentPreset.gens,
          agentComposition: normalizedComposition,
          customAgents: parsedCustomAgents,
        }),
      });
      const configData = await configRes.json();
      const simId = configData.data._id;

      // 2. Start (fires in background)
      await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationId: simId }),
      });

      // 3. Redirect to live status
      router.push(`/projects/${id}/simulate/${simId}`);
    } catch (error) {
      console.error('Failed to start simulation:', error);
      setLoading(false);
    }
  };

  const toggleFocusArea = (area) => {
    if (focusAreas.includes(area)) {
      setFocusAreas(focusAreas.filter(a => a !== area));
    } else {
      setFocusAreas([...focusAreas, area]);
    }
  };

  const handleAddFocus = (e) => {
    e.preventDefault();
    if (newFocus.trim() && !focusAreas.includes(newFocus.trim())) {
      setFocusAreas([...focusAreas, newFocus.trim()]);
      setNewFocus('');
    }
  };

  const totalPctDisplay = totalPct;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto w-full py-10">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-4xl font-bold tracking-tight">Configure Discovery</h2>
            <p className="text-[#64748b] font-medium leading-relaxed">Allocate agent resources and define evolutionary focus zones.</p>
          </div>

          {/* Intensity Selection */}
          <div className="flex flex-col gap-6">
             <h3 className="text-sm font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} className="text-[#8b5cf6]" /> Discovery Intensity
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {presets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setIntensity(p.id)}
                    className={clsx(
                      'p-5 rounded-3xl border transition-all flex flex-col gap-4 text-left group',
                      intensity === p.id 
                        ? 'bg-white/[0.03] border-[#8b5cf6] border-2 shadow-[0_0_30px_rgba(139,92,246,0.15)] scale-[1.02]' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    )}
                  >
                     <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500"
                      style={{ 
                        backgroundColor: intensity === p.id ? `${p.color}20` : 'rgba(255,255,255,0.03)',
                        color: intensity === p.id ? p.color : '#475569'
                      }}
                     >
                        <p.icon size={24} />
                     </div>
                     <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight">{p.name}</span>
                        <p className="text-[10px] text-[#475569] font-bold uppercase tracking-widest mt-1">
                          {p.agents} Agents • {p.gens} Gens
                        </p>
                     </div>
                  </button>
                ))}
             </div>
          </div>

          {/* Agent Composition Section */}
          <div className="flex flex-col gap-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full group"
            >
              <h3 className="text-sm font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={14} className="text-[#f59e0b]" /> Agent Composition
                <span className="text-[10px] text-[#334155] font-bold uppercase tracking-widest ml-2 italic">Optional — Advanced</span>
              </h3>
              <div className="flex items-center gap-2">
                <span 
                  className={clsx(
                    'text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg',
                    totalPctDisplay !== 100 ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-[#10b981] bg-[#10b981]/10'
                  )}
                >
                  {totalPctDisplay}% allocated
                </span>
                {showAdvanced ? <ChevronUp size={16} className="text-[#475569]" /> : <ChevronDown size={16} className="text-[#475569]" />}
              </div>
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass-card flex flex-col gap-8">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#475569] font-medium leading-relaxed">
                          Define the archetype distribution of your agent population. Values are normalized to 100% automatically.
                        </p>
                        <button
                          onClick={() => setComposition({ ...DEFAULT_COMPOSITION })}
                          className="text-[10px] text-[#475569] font-bold uppercase tracking-widest hover:text-white transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-6">
                        {ARCHETYPES.map(arch => (
                          <CompositionSlider
                            key={arch.id}
                            archetype={arch}
                            value={composition[arch.id] || 0}
                            onChange={(val) => updateArchetype(arch.id, val)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Custom Agent Scenarios */}
                    <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <Bot size={14} className="text-[#8b5cf6]" />
                        <h4 className="text-xs font-bold text-[#475569] uppercase tracking-widest">Custom Agent Personas</h4>
                        <span className="text-[9px] text-[#334155] font-bold uppercase tracking-widest italic">Optional</span>
                      </div>
                      <textarea
                        value={customAgents}
                        onChange={(e) => setCustomAgents(e.target.value)}
                        placeholder={"One persona per line. E.g.:\nA paranoid privacy advocate who refuses cookies\nA power user who uses browser extensions to bypass rate limits"}
                        rows={4}
                        className="w-full bg-[rgba(255,255,255,0.03)] border border-white/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-[#8b5cf6] focus:border-[#8b5cf6] placeholder:text-[#334155] resize-none font-mono text-xs leading-relaxed"
                      />
                      <p className="text-[10px] text-[#334155] font-bold uppercase tracking-widest">
                        Custom personas are injected as additional agents alongside the archetype population.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
             {/* Focus Areas */}
             <div className="lg:col-span-12 flex flex-col gap-6">
                <div className="glass-card flex flex-col gap-8">
                   <div className="flex items-center justify-between">
                     <h3 className="text-sm font-bold text-[#475569] uppercase tracking-widest flex items-center gap-2">
                        <Target size={14} className="text-[#3b82f6]" /> Prioritized Features
                     </h3>
                     <span className="text-[10px] text-[#475569] font-bold uppercase tracking-widest italic">Optional strategic focus</span>
                   </div>

                   <form onSubmit={handleAddFocus} className="flex gap-2">
                      <div className="flex-grow">
                        <input 
                          type="text" 
                          placeholder="Add custom feature focus..."
                          value={newFocus}
                          onChange={(e) => setNewFocus(e.target.value)}
                          className="w-full bg-[rgba(255,255,255,0.03)] border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-1 focus:ring-[#8b5cf6] focus:border-[#8b5cf6] placeholder:text-[#475569]"
                        />
                      </div>
                      <Button type="submit" variant="secondary" className="!px-4">Add Focus</Button>
                   </form>

                   <div className="flex flex-wrap gap-3">
                      {['User Auth', 'Payments', 'Data Privacy', 'API Integrity', 'Social Interaction'].map(f => (
                        <button
                          key={f}
                          onClick={() => toggleFocusArea(f)}
                          className={clsx(
                            'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all',
                            focusAreas.includes(f) ? 'bg-[#8b5cf6]/10 border-[#8b5cf6] text-[#8b5cf6]' : 'bg-white/5 border-white/5 text-[#475569] hover:border-white/20'
                          )}
                        >
                          {f}
                        </button>
                      ))}
                      {focusAreas.filter(a => !['User Auth', 'Payments', 'Data Privacy', 'API Integrity', 'Social Interaction'].includes(a)).map(f => (
                         <button
                          key={f}
                          onClick={() => toggleFocusArea(f)}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border bg-[#8b5cf6]/10 border-[#8b5cf6] text-[#8b5cf6]"
                        >
                          {f}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>

          <div className="glass-card flex flex-col gap-6 border-2 border-[#8b5cf6]/20 bg-[rgba(139,92,246,0.02)]">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                   <Fingerprint size={24} />
                </div>
                <div className="flex flex-col">
                   <h3 className="text-xl font-bold">Infiltration Strategy Loaded</h3>
                   <p className="text-xs text-[#475569] font-bold uppercase tracking-widest">Natural selection engine initialized</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] text-[#475569] font-bold uppercase tracking-widest">Total Agents</span>
                   <span className="text-lg font-bold">{currentPreset.agents} Deployed</span>
                </div>
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] text-[#475569] font-bold uppercase tracking-widest">Evolution Rounds</span>
                   <span className="text-lg font-bold">{currentPreset.gens} Iterations</span>
                </div>
                <div className="flex flex-col gap-1">
                   <span className="text-[10px] text-[#475569] font-bold uppercase tracking-widest">Expected LLM Activity</span>
                   <span className="text-lg font-bold">{currentPreset.agents * currentPreset.gens}+ Calls</span>
                </div>
             </div>

             {showAdvanced && (
               <div className="pt-4 border-t border-white/5 grid grid-cols-5 gap-3">
                 {ARCHETYPES.map(arch => {
                   const normalized = normalizeComposition();
                   return (
                     <div key={arch.id} className="flex flex-col items-center gap-1.5">
                       <div 
                         className="w-full h-1.5 rounded-full"
                         style={{ backgroundColor: `${arch.color}30` }}
                       >
                         <div 
                           className="h-full rounded-full transition-all duration-500"
                           style={{ width: `${normalized[arch.id] || 0}%`, backgroundColor: arch.color }}
                         />
                       </div>
                       <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: arch.color }}>
                         {arch.label.split(' ')[0]}
                       </span>
                       <span className="text-[9px] text-[#475569] font-bold">{normalized[arch.id] || 0}%</span>
                     </div>
                   );
                 })}
               </div>
             )}

             <p className="text-xs text-[#64748b] leading-relaxed font-medium italic">
                Strategic Note: Agents will be spawned using Latin Hypercube Sampling to maximize personality diversity across all 8 dimensions.
             </p>
          </div>

          <div className="flex justify-end gap-4">
             <Button variant="secondary" onClick={() => router.back()}>Abort</Button>
             <Button loading={loading} onClick={handleStart} icon={Sparkles} className="animate-glow">
                Deploy Agent Population
             </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
