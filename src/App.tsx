/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Play, RotateCcw, Info, Settings, X, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Constants ---
const ROWS = 10;
const COLS = 6;
const INITIAL_ROWS = 4;
const TICK_RATE = 1000;
const TIME_MODE_LIMIT = 10; // seconds per round

type GameMode = 'classic' | 'time';
type GameStatus = 'start' | 'playing' | 'gameover';

interface Block {
  id: string;
  value: number;
}

type Grid = (Block | null)[][];

export default function App() {
  const [grid, setGrid] = useState<Grid>([]);
  const [selected, setSelected] = useState<{ r: number; c: number }[]>([]);
  const [target, setTarget] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [mode, setMode] = useState<GameMode>('classic');
  const [status, setStatus] = useState<GameStatus>('start');
  const [timeLeft, setTimeLeft] = useState(TIME_MODE_LIMIT);
  const [highScore, setHighScore] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Initialization ---
  const generateBlock = useCallback((): Block => ({
    id: Math.random().toString(36).substr(2, 9),
    value: Math.floor(Math.random() * 9) + 1,
  }), []);

  const initGrid = useCallback(() => {
    const newGrid: Grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    // Fill bottom INITIAL_ROWS
    for (let r = ROWS - INITIAL_ROWS; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        newGrid[r][c] = generateBlock();
      }
    }
    setGrid(newGrid);
    setScore(0);
    setSelected([]);
    setStatus('playing');
    setTimeLeft(TIME_MODE_LIMIT);
  }, [generateBlock]);

  // --- Game Logic ---
  const addNewRow = useCallback(() => {
    setSelected([]); // Clear selection when grid shifts
    setGrid(prev => {
      // Check if top row has any blocks
      if (prev[0].some(cell => cell !== null)) {
        setStatus('gameover');
        return prev;
      }

      const newGrid = prev.map((row, r) => {
        if (r === ROWS - 1) return Array(COLS).fill(null).map(() => generateBlock());
        return [...prev[r + 1]];
      });

      return newGrid;
    });
  }, [generateBlock]);

  const generateTarget = useCallback((currentGrid: Grid) => {
    const allBlocks = currentGrid.flat().filter((b): b is Block => b !== null);
    if (allBlocks.length === 0) return 0;

    // Pick a random number of blocks to sum (2-4)
    const numToSum = Math.min(allBlocks.length, Math.floor(Math.random() * 3) + 2);
    const shuffled = [...allBlocks].sort(() => 0.5 - Math.random());
    const sum = shuffled.slice(0, numToSum).reduce((acc, b) => acc + b.value, 0);
    setTarget(sum);
  }, []);

  const handleStart = (selectedMode: GameMode) => {
    setMode(selectedMode);
    initGrid();
  };

  const handleBlockClick = (r: number, c: number) => {
    if (status !== 'playing') return;
    const block = grid[r][c];
    if (!block) return;

    const isSelected = selected.some(s => s.r === r && s.c === c);
    if (isSelected) {
      setSelected(prev => prev.filter(s => !(s.r === r && s.c === c)));
    } else {
      setSelected(prev => [...prev, { r, c }]);
    }
  };

  // --- Effects ---
  // Initial target generation
  useEffect(() => {
    if (status === 'playing' && target === 0) {
      generateTarget(grid);
    }
  }, [status, target, grid, generateTarget]);

  // Check sum when selection changes
  useEffect(() => {
    const currentSum = selected.reduce((acc, s) => acc + (grid[s.r][s.c]?.value || 0), 0);
    if (currentSum === target && target > 0) {
      // Success!
      const bonus = mode === 'time' ? Math.ceil(timeLeft / 2) : 0;
      setScore(prev => prev + (target * selected.length) + bonus);
      
      // Clear blocks
      const newGrid = [...grid.map(row => [...row])];
      selected.forEach(s => {
        newGrid[s.r][s.c] = null;
      });
      
      setGrid(newGrid);
      setSelected([]);
      generateTarget(newGrid);
      
      if (mode === 'classic') {
        addNewRow();
      } else {
        setTimeLeft(TIME_MODE_LIMIT);
      }

      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });
    } else if (currentSum > target) {
      // Too much! Clear selection with a slight delay for feedback
      const timer = setTimeout(() => setSelected([]), 300);
      return () => clearTimeout(timer);
    }
  }, [selected, target, mode, grid, timeLeft, addNewRow, generateTarget]);

  // Timer for Time Mode
  useEffect(() => {
    if (status === 'playing' && mode === 'time') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            addNewRow();
            return TIME_MODE_LIMIT;
          }
          return prev - 1;
        });
      }, TICK_RATE);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, mode, addNewRow]);

  // High score
  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  // --- Render Helpers ---
  const currentSum = selected.reduce((acc, s) => acc + (grid[s.r][s.c]?.value || 0), 0);

  const [showHelp, setShowHelp] = useState(false);

  if (status === 'start') {
    return (
      <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] flex flex-col items-center justify-center p-6 font-serif relative overflow-hidden">
        {/* Background Landscape */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img 
            src="https://picsum.photos/seed/ink/1920/1080?blur=5" 
            alt="Landscape" 
            className="w-full h-full object-cover grayscale sepia"
            referrerPolicy="no-referrer"
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 relative z-10"
        >
          <div className="space-y-2">
            <h1 className="text-7xl font-black tracking-tighter italic text-red-800 uppercase">数字爆破</h1>
            <p className="text-stone-600 font-medium text-lg tracking-[0.2em]">掌握数学 · 消除方块</p>
          </div>

          <div className="grid gap-4">
            <button 
              onClick={() => handleStart('classic')}
              className="group relative bg-white/80 border border-stone-200 p-6 rounded-2xl hover:border-red-800/50 transition-all text-left overflow-hidden shadow-sm"
            >
              <div className="relative z-10">
                <h3 className="text-xl font-bold flex items-center gap-2 text-stone-800">
                  经典模式 <ChevronRight className="w-4 h-4 text-red-800" />
                </h3>
                <p className="text-sm text-stone-500 mt-1">每次匹配后新增一行。尽可能生存下去。</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trophy className="w-16 h-16" />
              </div>
            </button>

            <button 
              onClick={() => handleStart('time')}
              className="group relative bg-white/80 border border-stone-200 p-6 rounded-2xl hover:border-stone-800/50 transition-all text-left overflow-hidden shadow-sm"
            >
              <div className="relative z-10">
                <h3 className="text-xl font-bold flex items-center gap-2 text-stone-800">
                  计时模式 <ChevronRight className="w-4 h-4 text-stone-800" />
                </h3>
                <p className="text-sm text-stone-500 mt-1">在时间耗尽前完成匹配。快节奏挑战。</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Timer className="w-16 h-16" />
              </div>
            </button>
          </div>

          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors text-sm font-bold uppercase tracking-widest"
            >
              <Info className="w-4 h-4" /> 玩法说明
            </button>
          </div>

          <div className="pt-8 text-xs text-stone-400 uppercase tracking-widest flex justify-center gap-8">
            <div className="flex flex-col items-center gap-1">
              <span className="font-bold text-stone-600">{highScore}</span>
              <span>最高分</span>
            </div>
          </div>
        </motion.div>

        {/* Help Modal */}
        <AnimatePresence>
          {showHelp && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="max-w-sm w-full bg-white border border-stone-200 rounded-3xl p-8 space-y-6 shadow-2xl"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-red-800 uppercase italic tracking-tighter">玩法说明</h2>
                  <button onClick={() => setShowHelp(false)} className="text-stone-400 hover:text-stone-900">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <ul className="space-y-4 text-stone-600 text-sm">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-800/10 text-red-800 flex items-center justify-center font-bold shrink-0">1</span>
                    <p>选择方块，使它们的总和等于顶部的<strong className="text-red-800">“目标数字”</strong>。</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-800/10 text-red-800 flex items-center justify-center font-bold shrink-0">2</span>
                    <p>方块不需要相邻。你可以从网格的<strong className="text-red-800">“任何位置”</strong>选择！</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-800/10 text-red-800 flex items-center justify-center font-bold shrink-0">3</span>
                    <p>不要让方块触及<strong className="text-red-600">“顶端”</strong>，否则游戏结束！</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-800/10 text-red-800 flex items-center justify-center font-bold shrink-0">4</span>
                    <p><strong className="text-red-800 uppercase">经典模式：</strong>每次匹配成功后新增一行。</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-800/10 text-red-800 flex items-center justify-center font-bold shrink-0">5</span>
                    <p><strong className="text-stone-800 uppercase">计时模式：</strong>当计时器归零时新增一行。</p>
                  </li>
                </ul>

                <button 
                  onClick={() => setShowHelp(false)}
                  className="w-full py-4 bg-red-800 text-white font-black rounded-2xl hover:bg-red-700 transition-colors shadow-md"
                >
                  明白了！
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] flex flex-col font-serif selection:bg-red-500/30 relative overflow-hidden">
      {/* Background Landscape Image */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <img 
          src="https://picsum.photos/seed/landscape/1920/1080?blur=2" 
          alt="Landscape" 
          className="w-full h-full object-cover grayscale sepia"
          referrerPolicy="no-referrer"
        />
      </div>
      {/* Header */}
      <header className="p-4 md:p-6 flex items-center justify-between border-b border-black/10 bg-white/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">目标数字</span>
            <motion.span 
              key={target}
              initial={{ scale: 1.5, color: '#B22222' }}
              animate={{ scale: 1, color: '#1A1A1A' }}
              className="text-4xl font-black leading-none"
            >
              {target}
            </motion.span>
          </div>
          <div className="h-8 w-px bg-black/10 mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">当前总和</span>
            <span className={`text-2xl font-bold leading-none ${currentSum > target ? 'text-red-600' : 'text-emerald-700'}`}>
              {currentSum}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {mode === 'time' && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">剩余时间</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <motion.div 
                    className={`h-full ${timeLeft < 4 ? 'bg-red-600' : 'bg-stone-600'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / TIME_MODE_LIMIT) * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-mono font-bold ${timeLeft < 4 ? 'text-red-600 animate-pulse' : 'text-stone-700'}`}>
                  {timeLeft}秒
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">得分</span>
            <span className="text-2xl font-black text-red-700">{score}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden relative z-10">
        <div 
          className="grid gap-1.5 md:gap-2 bg-white/60 backdrop-blur-sm p-2 md:p-3 rounded-2xl border border-black/5 shadow-xl relative"
          style={{ 
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            width: '100%',
            maxWidth: '400px',
            aspectRatio: `${COLS}/${ROWS}`
          }}
        >
          {grid.map((row, r) => 
            row.map((block, c) => (
              <div 
                key={`${r}-${c}`}
                className="relative aspect-square"
              >
                <AnimatePresence mode="popLayout">
                  {block && (
                    <motion.button
                      layoutId={block.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        y: 0 
                      }}
                      exit={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleBlockClick(r, c)}
                      className={`
                        w-full h-full rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl font-black transition-all
                        ${selected.some(s => s.r === r && s.c === c) 
                          ? 'bg-red-800 text-white shadow-[0_0_20px_rgba(153,27,27,0.4)] z-10' 
                          : 'bg-stone-100 text-stone-800 hover:bg-stone-200 border-b-4 border-stone-300'}
                      `}
                    >
                      {block.value}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}

          {/* Danger Zone Indicator */}
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20 rounded-t-2xl pointer-events-none" />
        </div>
      </main>

      <footer className="p-6 flex justify-center gap-4 relative z-10">
        <button 
          onClick={() => setStatus('start')}
          className="p-3 rounded-full bg-white/80 text-stone-500 hover:text-stone-900 hover:bg-white shadow-sm transition-colors border border-black/5"
          title="退出游戏"
        >
          <X className="w-6 h-6" />
        </button>
        <button 
          onClick={initGrid}
          className="p-3 rounded-full bg-white/80 text-stone-500 hover:text-stone-900 hover:bg-white shadow-sm transition-colors border border-black/5"
          title="重新开始"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </footer>

      {/* Game Over Modal */}
      <AnimatePresence>
        {status === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="max-w-sm w-full bg-white border border-stone-200 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-red-800 uppercase italic tracking-tighter">游戏结束</h2>
                <p className="text-stone-500">方块触顶了！</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block mb-1">得分</span>
                  <span className="text-2xl font-black text-red-800">{score}</span>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block mb-1">最高分</span>
                  <span className="text-2xl font-black text-stone-800">{highScore}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={initGrid}
                  className="w-full py-4 bg-red-800 text-white font-black rounded-2xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <RotateCcw className="w-5 h-5" /> 再试一次
                </button>
                <button 
                  onClick={() => setStatus('start')}
                  className="w-full py-4 bg-stone-100 text-stone-800 font-bold rounded-2xl hover:bg-stone-200 transition-colors"
                >
                  返回主菜单
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-red {
          0%, 100% { border-color: rgba(239, 68, 68, 0.2); }
          50% { border-color: rgba(239, 68, 68, 0.6); }
        }
        .danger-border {
          animation: pulse-red 2s infinite;
        }
      `}} />
    </div>
  );
}
