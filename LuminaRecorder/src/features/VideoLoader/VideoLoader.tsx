import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { cn } from '../../utils';

interface VideoLoaderProps {
    onNext: () => void;
    setVideoSource: (url: string | null) => void;
    videoSource: string | null;
}

const Footer = ({ children }: { children: React.ReactNode }) => (
    <div className="border-t border-surface p-6 bg-background/95 backdrop-blur-sm mt-auto w-full flex justify-center gap-4 shadow-2xl">
        {children}
    </div>
);

export function VideoLoader({ onNext, setVideoSource, videoSource }: VideoLoaderProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoSource(url);

            // Open Output Window immediately
            setTimeout(() => {
                window.open('?window=output', 'LuminaOutput', 'width=800,height=600');
            }, 100);

            // Auto-advance to Distortion Step
            onNext();
        }
    }, [setVideoSource, onNext]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'video/*': [] },
        multiple: false
    });

    const clearVideo = () => {
        if (videoSource) {
            URL.revokeObjectURL(videoSource);
            setVideoSource(null);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-background text-slate-200 fade-in duration-500">
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">
                {!videoSource ? (
                    <div
                        {...getRootProps()}
                        className={cn(
                            "group w-full max-w-3xl aspect-video border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-out",
                            isDragActive
                                ? "border-primary bg-primary/10 scale-105 shadow-primary/20 shadow-xl"
                                : "border-slate-700 bg-surface/50 hover:border-slate-500 hover:bg-surface hover:shadow-2xl"
                        )}
                    >
                        <input {...getInputProps()} />
                        <div className="p-6 bg-surface rounded-full mb-6 group-hover:scale-110 transition-transform shadow-lg group-hover:shadow-xl border border-slate-800">
                            <Upload className={cn("w-10 h-10 transition-colors", isDragActive ? "text-primary" : "text-slate-400 group-hover:text-primary")} />
                        </div>
                        <p className="text-2xl font-semibold mb-2 text-slate-200 group-hover:text-white transition-colors">
                            {isDragActive ? "Drop video here" : "Upload Video Source"}
                        </p>
                        <p className="text-sm text-slate-500">
                            Drag & drop or click to browse (MP4, WebM, MOV)
                        </p>
                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                        <div className="relative max-h-full max-w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 ring-1 ring-white/10">
                            <video
                                src={videoSource}
                                controls
                                className="w-full h-full object-contain"
                            />
                            <button
                                onClick={clearVideo}
                                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500/80 rounded-full text-white backdrop-blur-md transition-all border border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            {videoSource && (
                <Footer>
                    <button
                        onClick={clearVideo}
                        className="px-6 py-3 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-surface border border-transparent hover:border-slate-700 transition-all"
                    >
                        Change Video
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-amber-400 text-black rounded-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                        Continue to Distortion &rarr;
                    </button>
                </Footer>
            )}
        </div>
    );
}
