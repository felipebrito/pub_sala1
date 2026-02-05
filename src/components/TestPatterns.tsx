import React from 'react';
import { Grid3X3, Palette, Scan, EyeOff, LayoutTemplate } from 'lucide-react';

interface TestPatternsProps {
    activePattern: number;
    onChange: (pattern: number) => void;
}

export const TestPatterns: React.FC<TestPatternsProps> = ({ activePattern, onChange }) => {

    // 0=Video, 1=FineGrid, 2=Focus, 3=Overlap, 4=Black, 5=Custom, 6=Metric
    const patterns = [
        { id: 0, label: 'Video', icon: <LayoutTemplate size={20} /> },
        { id: 1, label: 'Pro Grid', icon: <Grid3X3 size={20} /> },
        { id: 2, label: 'Focus', icon: <Scan size={20} /> },
        { id: 3, label: 'Overlap', icon: <Palette size={20} /> },
        { id: 4, label: 'Black', icon: <EyeOff size={20} /> },
        { id: 5, label: 'PUC Ref', icon: <LayoutTemplate size={20} /> },
        { id: 6, label: 'Metric', icon: <Grid3X3 size={20} /> },
    ];

    return (
        <div className="flex flex-col gap-2 p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 backdrop-blur-sm w-full">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Test Patterns</h3>
            <div className="grid grid-cols-3 gap-2">
                {patterns.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => onChange(p.id)}
                        className={`
                            flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all duration-200
                            ${activePattern === p.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}
                        `}
                        title={p.label}
                    >
                        {p.icon}
                        <span className="text-[10px] font-medium">{p.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
