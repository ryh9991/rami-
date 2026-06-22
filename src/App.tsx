import { useEffect, useState, startTransition, useRef } from 'react';
import { GameState, Difficulty, Theme, BirdSkin, GameStats } from './types';
import { FlappyCanvas } from './components/FlappyCanvas';
import { soundSystem, SoundscapeTheme } from './utils/audio';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { 
  Volume2, 
  VolumeX, 
  Pause, 
  Play, 
  RotateCcw, 
  Trophy, 
  Sparkles, 
  Sliders, 
  Gamepad2, 
  Info, 
  Layers, 
  Activity,
  Zap,
  Target,
  Compass,
  Award
} from 'lucide-react';

export default function App() {
  // Ref to prevent repetitive game-over state update triggers (infinite loop fix)
  const processedGameOverRef = useRef<boolean>(false);

  // Game Configuration State
  const [theme, setTheme] = useState<Theme>(Theme.NIGHT);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [skin, setSkin] = useState<BirdSkin>(BirdSkin.RETRO);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  
  // Game Scoring State
  const [score, setScore] = useState<number>(0);
  const [highScores, setHighScores] = useState<{ [key in Difficulty]: number }>({
    EASY: 0,
    MEDIUM: 0,
    HARD: 0,
  });

  // Player Statistics with durable LocalStorage fallback
  const [stats, setStats] = useState<GameStats>({
    totalGames: 0,
    highestScore: 0,
    totalFlaps: 0,
    totalPipesCleared: 0,
  });

  const [isMuted, setIsMuted] = useState<boolean>(soundSystem.getMuteState());
  const [soundscape, setSoundscape] = useState<SoundscapeTheme>(soundSystem.getSoundscape());

  // Recharts Score History list (last 10 flight attempts)
  const [scoreHistory, setScoreHistory] = useState<{ id: string; score: number; difficulty: string; index: number }[]>([]);

  // Daily Missions Definition & State Tracking
  interface DailyMission {
    id: string;
    name: string;
    target: number;
    type: 'flap' | 'pipe' | 'games';
  }

  const MISSIONS_POOL: DailyMission[] = [
    { id: 'daily-flaps-100', name: 'Flap wings 100 times', target: 100, type: 'flap' },
    { id: 'daily-pipes-10', name: 'Pass 10 pipeline gates safely', target: 10, type: 'pipe' },
    { id: 'daily-games-5', name: 'Perform 5 test flights', target: 5, type: 'games' },
    { id: 'daily-flaps-50', name: 'Flap wings 50 times in training', target: 50, type: 'flap' },
    { id: 'daily-pipes-5', name: 'Pass 5 pipeline gates', target: 5, type: 'pipe' },
  ];

  const getTodayMission = (): DailyMission => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sum = today.split('').reduce((acc, char) => acc + (parseInt(char) || 0), 0);
      return MISSIONS_POOL[sum % MISSIONS_POOL.length];
    } catch {
      return MISSIONS_POOL[0];
    }
  };

  const [todayMission, setTodayMission] = useState<DailyMission>(getTodayMission());
  const [missionProgress, setMissionProgress] = useState<number>(0);
  const [missionCompleted, setMissionCompleted] = useState<boolean>(false);

  // Helper routine to safely propagate daily mission advances
  const updateMissionProgress = (type: 'flap' | 'pipe' | 'games', amount: number) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const selected = getTodayMission();
      if (selected.type !== type) return;

      setMissionProgress((prev) => {
        if (prev >= selected.target) return prev;
        const next = Math.min(selected.target, prev + amount);
        const completedNow = next >= selected.target;

        const record = {
          date: today,
          progress: next,
          missionId: selected.id,
          completed: completedNow,
        };

        localStorage.setItem('sky_daily_mission_v1', JSON.stringify(record));
        if (completedNow && !missionCompleted) {
          setMissionCompleted(true);
          soundSystem.playScore(); // celebrate mission completion chime!
        }
        return next;
      });
    } catch (e) {
      // Ignored
    }
  };

  const handleToggleSoundscape = (nextTheme: SoundscapeTheme) => {
    soundSystem.setSoundscape(nextTheme);
    setSoundscape(nextTheme);
  };

  const [triggerReset, setTriggerReset] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // Tips array to rotate in the professional alert box
  const FLIGHT_TIPS = [
    "Maintain a steady rhythm rather than rapid bursts for better control near narrow gaps.",
    "Gravity pull changes with selected difficulty. Keep gentle clicks on Hard mode.",
    "The Robo-Cypher skin releases special glow combustion trail residues when flapping.",
    "Pressing P triggers standard hardware paused simulation constraints instantly.",
    "Daybreak Skies atmosphere features low velocity wind resistance elements."
  ];
  const [tipIndex, setTipIndex] = useState<number>(0);

  // Rotate tips once per session load
  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * FLIGHT_TIPS.length));
  }, [gameState]);

  const handleToggleMute = () => {
    const nextMuted = soundSystem.toggleMute();
    setIsMuted(nextMuted);
  };

  // Keyboard 'P' key to Pause/Resume
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setGameState((prev) => {
          if (prev === GameState.PLAYING) return GameState.PAUSED;
          if (prev === GameState.PAUSED) return GameState.PLAYING;
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Hydrate local state from storage
  useEffect(() => {
    try {
      const storedScores = localStorage.getItem('sky_high_scores_pro');
      if (storedScores) {
        setHighScores(JSON.parse(storedScores));
      }

      const storedStats = localStorage.getItem('sky_player_stats_pro');
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }

      // Hydrate historical Score History trend array
      const storedHistory = localStorage.getItem('sky_score_history_pro');
      if (storedHistory) {
        setScoreHistory(JSON.parse(storedHistory));
      }

      // Hydrate Daily Mission specifications
      const today = new Date().toISOString().split('T')[0];
      const selected = getTodayMission();
      setTodayMission(selected);

      const storedMission = localStorage.getItem('sky_daily_mission_v1');
      if (storedMission) {
        const parsed = JSON.parse(storedMission);
        if (parsed.date === today && parsed.missionId === selected.id) {
          setMissionProgress(parsed.progress);
          setMissionCompleted(parsed.completed);
        } else {
          // Reset statistics for a fresh new day's mission
          localStorage.setItem('sky_daily_mission_v1', JSON.stringify({
            date: today,
            progress: 0,
            missionId: selected.id,
            completed: false
          }));
        }
      }
    } catch (e) {
      console.warn('LocalStorage access is blocked', e);
    }
  }, []);

  const saveStatsAndScores = (updatedScores: typeof highScores, updatedStats: GameStats) => {
    try {
      localStorage.setItem('sky_high_scores_pro', JSON.stringify(updatedScores));
      localStorage.setItem('sky_player_stats_pro', JSON.stringify(updatedStats));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  };

  const onFlapTriggered = () => {
    setStats((prev) => {
      const next = { ...prev, totalFlaps: prev.totalFlaps + 1 };
      saveStatsAndScores(highScores, next);
      return next;
    });
    updateMissionProgress('flap', 1);
  };

  const onPipeCleared = () => {
    setStats((prev) => {
      const next = { ...prev, totalPipesCleared: prev.totalPipesCleared + 1 };
      saveStatsAndScores(highScores, next);
      return next;
    });
    updateMissionProgress('pipe', 1);
  };

  const onCollisionOccurred = () => {
    // Collision callback triggers sound effects in sound system
  };

  // Process game over status
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      processedGameOverRef.current = false;
    }

    if (gameState === GameState.GAMEOVER) {
      if (processedGameOverRef.current) return;
      processedGameOverRef.current = true;

      soundSystem.playGameOver();

      const currentRecord = highScores[difficulty] || 0;
      let scoreRecordBroken = false;
      let newHighScores = { ...highScores };

      if (score > currentRecord) {
        newHighScores[difficulty] = score;
        setHighScores(newHighScores);
        setIsNewRecord(true);
        scoreRecordBroken = true;
      } else {
        setIsNewRecord(false);
      }

      setStats((prev) => {
        const next = {
          ...prev,
          totalGames: prev.totalGames + 1,
          highestScore: Math.max(prev.highestScore, score),
        };
        saveStatsAndScores(newHighScores, next);
        return next;
      });

      // Update Daily Mission for completed games
      updateMissionProgress('games', 1);

      // Append score to history (limit to last 10 attempts)
      const nextIndex = stats.totalGames + 1;
      const newHistoryEntry = {
        id: `run-${Date.now()}-${Math.random()}`,
        score: score,
        difficulty: difficulty,
        index: nextIndex
      };

      setScoreHistory((prev) => {
        const updated = [...prev, newHistoryEntry].slice(-10);
        try {
          localStorage.setItem('sky_score_history_pro', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save score history to localStorage:', e);
        }
        return updated;
      });
    }
  }, [gameState, score, difficulty, stats.totalGames, highScores]);

  const handleStartRestart = () => {
    setTriggerReset((prev) => prev + 1);
    setIsNewRecord(false);
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col md:flex-row overflow-x-hidden selection:bg-indigo-100">
      
      {/* LEFT SIDEBAR: Pro Flight Console */}
      <aside className="w-full md:w-[324px] bg-white border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col p-6 z-20 shrink-0 shadow-sm">
        
        {/* Branding header line */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-200">
            <span className="font-extrabold tracking-tighter">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">SkyDash Pro</h1>
            <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-widest leading-none mt-0.5 block">FLIGHT SIMULATION</span>
          </div>
        </div>

        {/* Dynamic Statistics Block */}
        <section className="mb-6">
          <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-3">Player Stats</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/40">
              <p className="text-[9px] font-bold text-slate-400 uppercase">High Score</p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{highScores[difficulty]}</p>
            </div>
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/40">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Total Runs</p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{stats.totalGames}</p>
            </div>
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/40">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Wings Flaps</p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{stats.totalFlaps}</p>
            </div>
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/40">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Pipes Cleared</p>
              <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{stats.totalPipesCleared}</p>
            </div>
          </div>
        </section>

        {/* Daily Mission section */}
        <section className="mb-6 bg-amber-50/45 p-4 rounded-2xl border border-amber-200/50 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-600" />
              <h3 className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest">Daily Quest</h3>
            </div>
            {missionCompleted ? (
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider animate-pulse">
                COMPLETED
              </span>
            ) : (
              <span className="text-[9px] font-mono text-amber-700 font-bold bg-amber-100/50 px-1.5 py-0.5 rounded-full border border-amber-200/30">
                ACTIVE
              </span>
            )}
          </div>
          
          <p className="text-xs font-bold text-slate-800 mb-2">{todayMission.name}</p>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
              <span>Goal Progress</span>
              <span>{missionProgress} / {todayMission.target}</span>
            </div>
            
            <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden border border-slate-200/20">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  missionCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (missionProgress / todayMission.target) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Dynamic Customizers (Aviator, Atmosphere, Difficulty Toggles) */}
        <section className="space-y-5 flex-1">
          
          {/* Aviator skins */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2.5 block">Aviator Skins</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: BirdSkin.RETRO, name: 'Retro', color: 'bg-yellow-400' },
                { id: BirdSkin.PHOENIX, name: 'Phoenix', color: 'bg-orange-500' },
                { id: BirdSkin.ROBO, name: 'Robo', color: 'bg-sky-400' },
                { id: BirdSkin.BAT, name: 'Night Bat', color: 'bg-purple-500' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => startTransition(() => setSkin(s.id))}
                  className={`py-2 px-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                    skin === s.id
                      ? 'border-indigo-500 bg-indigo-50/20 text-indigo-700 font-semibold'
                      : 'border-slate-200/60 hover:bg-slate-50 text-slate-600 text-xs'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                  <span className="text-xs truncate">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Atmosphere selectors */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2.5 block">Atmosphere Portal</span>
            <div className="flex flex-col gap-1.5">
              {[
                { id: Theme.DAY, name: 'Daybreak Skies', icon: Compass },
                { id: Theme.NIGHT, name: 'Twilight Horizon', icon: Trophy },
                { id: Theme.CYBERPUNK, name: 'Synth Grid-Run', icon: Sparkles },
              ].map((th) => {
                const IconComp = th.icon;
                return (
                  <button
                    key={th.id}
                    onClick={() => startTransition(() => setTheme(th.id))}
                    className={`w-full py-2 px-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      theme === th.id
                        ? 'border-indigo-500 bg-indigo-50/35 text-indigo-700 font-semibold'
                        : 'border-slate-200/60 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <IconComp className={`w-3.5 h-3.5 ${theme === th.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>{th.name}</span>
                    </div>
                    {theme === th.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Soundscape background music selection */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2.5 block">Soundscapes Theme</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: SoundscapeTheme.OFF, name: 'None / Muted' },
                { id: SoundscapeTheme.RETRO, name: 'Retro Arcade' },
                { id: SoundscapeTheme.LOFI, name: 'Lo-Fi Chill' },
                { id: SoundscapeTheme.CYBERPUNK, name: 'Cyberpunk Synth' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleToggleSoundscape(st.id)}
                  className={`py-2 px-2 rounded-xl border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                    soundscape === st.id
                      ? 'border-indigo-500 bg-indigo-50/20 text-indigo-700 font-semibold font-bold'
                      : 'border-slate-200/60 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    st.id === SoundscapeTheme.RETRO ? 'bg-amber-400' :
                    st.id === SoundscapeTheme.LOFI ? 'bg-emerald-400' :
                    st.id === SoundscapeTheme.CYBERPUNK ? 'bg-cyan-400' : 'bg-slate-300'
                  }`} />
                  <span className="text-[11px] truncate leading-none">{st.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Speeds */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2 block">Speed Settings</span>
            <div className="grid grid-cols-3 gap-1">
              {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((diff) => (
                <button
                  key={diff}
                  onClick={() => startTransition(() => {
                    setDifficulty(diff);
                    if (gameState === GameState.PLAYING) {
                      setGameState(GameState.START);
                    }
                  })}
                  className={`py-1.5 rounded-lg border text-center text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
                    difficulty === diff
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'border-slate-200/60 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {diff.substring(0, 4)}
                </button>
              ))}
            </div>
          </div>

        </section>

        {/* Tip of the flight advice */}
        <div className="mt-8">
          <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100/60">
            <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest mb-1.5">Flight Tip</p>
            <p className="text-xs text-indigo-900 leading-relaxed font-medium italic">
              "{FLIGHT_TIPS[tipIndex]}"
            </p>
          </div>
        </div>

      </aside>

      {/* RIGHT WORKSPACE VIEWPORT LAYER */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 relative">
        
        {/* Parallax Clouds background over professional zone */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-[0.45]">
          <div className="absolute top-10 left-12 text-6xl">☁️</div>
          <div className="absolute top-36 right-16 text-4xl">☁️</div>
          <div className="absolute bottom-28 left-20 text-5xl">☁️</div>
        </div>

        {/* Centralised Professional Cabinet */}
        <div className="w-full max-w-[420px] flex flex-col gap-4 relative z-10">
          
          {/* Header toolbar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Simulation Stage</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Button */}
              <button
                onClick={handleToggleMute}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
                  isMuted 
                    ? 'bg-red-50 border-red-200 text-red-500' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Screen Box */}
          <div className="relative w-full aspect-[400/550] rounded-[32px] overflow-hidden bg-slate-900 shadow-[0_32px_64px_-16px_rgba(4,6,12,0.18)] border border-slate-200/10">
            
            <FlappyCanvas
              theme={theme}
              difficulty={difficulty}
              skin={skin}
              gameState={gameState}
              setGameState={setGameState}
              setScore={setScore}
              onFlapTriggered={onFlapTriggered}
              onPipeCleared={onPipeCleared}
              onCollisionOccurred={onCollisionOccurred}
              triggerReset={triggerReset}
            />

            {/* Score HUD display in session */}
            {gameState === GameState.PLAYING && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-100 px-5 py-2 rounded-2xl flex items-center gap-2.5 shadow-xl backdrop-blur-md pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
                <span className="text-2xl font-black text-slate-900 leading-none select-none tracking-tight">
                  {score}
                </span>
              </div>
            )}

            {/* HIGH-FIDELITY OVERLAYS */}

            {/* Interactive START Simulation Trigger OVERLAY */}
            {gameState === GameState.START && (
              <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[340px] rounded-[32px] p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col gap-6 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">Sky Simulation</span>
                    <h3 className="text-3xl font-black text-slate-900 mt-1.5 tracking-tight">Ready to Fly?</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Difficulty</p>
                      <p className="text-sm font-black text-slate-800 leading-tight mt-0.5">{difficulty}</p>
                    </div>
                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/40">
                      <p className="text-[9px] font-bold text-indigo-500 uppercase">Multiplier</p>
                      <p className="text-sm font-black text-indigo-700 leading-tight mt-0.5">
                        {difficulty === Difficulty.EASY ? '1.0x' : difficulty === Difficulty.MEDIUM ? '1.5x' : '2.0x'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleStartRestart}
                    style={{ cursor: 'pointer' }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl text-base font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Launch Pilot</span>
                    <span>➔</span>
                  </button>
                    
                  <p className="text-[10.5px] text-slate-400 font-medium">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-[9.5px]">SPACE</kbd> or click to glide.
                  </p>
                </div>
              </div>
            )}

            {/* Interactive PAUSED Simulation Trigger OVERLAY */}
            {gameState === GameState.PAUSED && (
              <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[340px] rounded-[32px] p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col gap-6 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">Simulation</span>
                    <h3 className="text-3xl font-black text-slate-900 mt-1.5 tracking-tight">Active Pause</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Current Score</p>
                      <p className="text-lg font-black text-slate-800 leading-tight mt-0.5">{score}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Best Record</p>
                      <p className="text-lg font-black text-slate-800 leading-tight mt-0.5">{highScores[difficulty]}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setGameState(GameState.PLAYING)}
                    style={{ cursor: 'pointer' }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl text-base font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    Resume Flight
                  </button>
                </div>
              </div>
            )}

            {/* HIGH-FIDELITY GAME OVER OVERLAY */}
            {gameState === GameState.GAMEOVER && (
              <div className="absolute inset-0 z-30 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-5">
                <div className="bg-white w-full max-w-[340px] rounded-[32px] p-7 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] border border-slate-100 flex flex-col gap-5 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.25em]">Flight Rupture</span>
                    <h3 className="text-3xl font-black text-slate-900 mt-1.5 tracking-tight">Landed safely</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex flex-col items-center justify-center border-r border-slate-200/60">
                      <span className="text-[8px] text-slate-400 font-extrabold tracking-widest leading-none uppercase mb-1">SCORE</span>
                      <span className="text-2xl font-black text-slate-900 leading-none">
                        {score}
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[8px] text-slate-400 font-extrabold tracking-widest leading-none uppercase mb-1">ATH RECORD</span>
                      <span className="text-2xl font-black text-indigo-600 leading-none">
                        {highScores[difficulty]}
                      </span>
                    </div>
                  </div>

                  {isNewRecord ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 leading-none">
                      <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>NEW ALL-TIME RECORD BROKEN!</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Fly steady, glide cleanly, and aim high.
                    </span>
                  )}

                  <button
                    onClick={handleStartRestart}
                    style={{ cursor: 'pointer' }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 rounded-2xl text-base font-bold shadow-lg shadow-indigo-150 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Relaunch Flight</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartRestart}
              style={{ cursor: 'pointer' }}
              className="flex-1 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset State</span>
            </button>
            {gameState === GameState.PLAYING && (
              <button
                onClick={() => setGameState(GameState.PAUSED)}
                className="py-3.5 px-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer"
                title="Pause"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {gameState === GameState.PAUSED && (
              <button
                onClick={() => setGameState(GameState.PLAYING)}
                className="py-3.5 px-4 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all cursor-pointer animate-pulse"
                title="Resume"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Global Leader table list mockup mock statistics */}
        <div className="w-full max-w-[420px] bg-white border border-slate-200/80 rounded-2xl p-4 mt-6">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-3">Global Leaders</span>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-extrabold text-[10px]">1</div>
              <div className="flex-1"><p className="text-xs font-bold text-slate-800">ZeroGravity</p></div>
              <div className="text-xs font-mono font-bold text-slate-500">2,910</div>
            </div>
            <div className="flex items-center gap-3 opacity-70">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">2</div>
              <div className="flex-1"><p className="text-xs font-bold text-slate-800">PixelPilot</p></div>
              <div className="text-xs font-mono font-bold text-slate-500">2,450</div>
            </div>
            <div className="flex items-center gap-3 opacity-55">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">3</div>
              <div className="flex-1"><p className="text-xs font-bold text-slate-800">AeroFlux</p></div>
              <div className="text-xs font-mono font-bold text-slate-500">2,120</div>
            </div>
          </div>
        </div>

        {/* Score History Performance Trend Section (Recharts) */}
        <div className="w-full max-w-[420px] bg-white border border-slate-200/80 rounded-2xl p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none">Flight History</span>
              <span className="text-[9px] font-medium text-slate-400 block mt-0.5">Last 10 game trend analysis</span>
            </div>
            <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          </div>

          {scoreHistory.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200/50 flex flex-col items-center justify-center gap-1.5">
              <span className="text-xl">✈️</span>
              <p className="text-xs font-semibold text-slate-500">No telemetry recorded yet</p>
              <p className="text-[10px] text-slate-400">Complete standard flights to build trend data</p>
            </div>
          ) : (
            <div className="h-44 w-full text-xs" id="history-chart-card">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={scoreHistory}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="index" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => `Run #${v}`}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const runInfo = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white rounded-xl p-2.5 shadow-xl border border-slate-800 text-[11px] leading-tight flex flex-col gap-1">
                            <span className="font-bold text-slate-300">Run #{runInfo.index}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              <span>Score: <strong className="font-bold text-indigo-200">{runInfo.score}</strong></span>
                            </div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-widest">{runInfo.difficulty} Mode</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#4f46e5" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#scoreColor)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </main>

    </div>
  );
}
