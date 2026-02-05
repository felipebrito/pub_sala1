import React from 'react';
interface WizardLayoutProps {
    currentStep: number;
    totalSteps: number;
    children: React.ReactNode;
    title: string;
}

export function WizardLayout({ currentStep, totalSteps, children, title }: WizardLayoutProps) {
    return (
        <div className="flex flex-col h-screen bg-neutral-950 text-white">
            {/* Header */}
            <header className="h-16 border-b border-surface/50 bg-background/50 backdrop-blur-md flex items-center px-8 justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="font-bold text-black text-lg">L</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-200 tracking-tight">
                        Lumina <span className="text-primary font-normal">Recorder</span>
                    </h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-sm text-slate-400">
                        Step <span className="text-primary font-mono font-bold">{currentStep + 1}</span> of {totalSteps}: <span className="text-white font-medium ml-2">{title}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-48 h-1.5 bg-surface rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-primary shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-500 ease-out"
                            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                {children}
            </main>
        </div>
    );
}
