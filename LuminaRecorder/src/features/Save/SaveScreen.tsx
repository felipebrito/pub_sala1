import { Download, RotateCcw, CheckCircle } from 'lucide-react';

interface SaveScreenProps {
    onReset: () => void;
    recordedBlobUrl: string | null;
    format: 'webm' | 'mp4';
}

export function SaveScreen({ onReset, recordedBlobUrl, format }: SaveScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 max-w-4xl mx-auto text-center fade-in duration-500">
            <div className="mb-8 p-6 bg-green-500/10 rounded-full border border-green-500/20 shadow-2xl shadow-green-900/20 animate-in zoom-in spin-in-3 duration-500">
                <CheckCircle className="w-20 h-20 text-green-500" />
            </div>

            <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">
                Video Ready!
            </h2>

            <p className="text-slate-400 text-lg mb-12 max-w-lg leading-relaxed">
                Your distorted video loop has been successfully recorded. <br />
                You can now download it and use it in your player.
            </p>

            {recordedBlobUrl && (
                <div className="relative w-full max-w-lg aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border border-slate-800 mb-10 ring-1 ring-white/10 group">
                    <video
                        src={recordedBlobUrl}
                        controls
                        autoPlay
                        loop
                        muted
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            <div className="flex gap-6">
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-8 py-4 bg-surface hover:bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 transition-all hover:scale-105"
                >
                    <RotateCcw className="w-5 h-5" />
                    Start Over
                </button>

                {recordedBlobUrl && (
                    <a
                        href={recordedBlobUrl}
                        download={`distorted-output.${format}`}
                        className="flex items-center gap-3 px-10 py-4 bg-primary hover:bg-amber-400 text-black rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-105 hover:shadow-primary/40 transition-all"
                    >
                        <Download className="w-5 h-5" />
                        Download Video ({format.toUpperCase()})
                    </a>
                )}
            </div>
        </div>
    );
}
