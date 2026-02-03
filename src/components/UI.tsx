import { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ToolIconProps {
    icon: React.ReactElement;
    active?: boolean;
    onClick?: () => void;
    tooltip?: string;
}

export function ToolIcon({ icon, active, onClick, tooltip }: ToolIconProps) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={cn(
                "p-3 rounded-xl transition-all group relative",
                active ? "bg-amber-500/10 text-amber-500" : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/40"
            )}
        >
            {icon}
            {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full shadow-[0_0_15px_#f59e0b]" />}
        </button>
    );
}

interface LayerItemProps {
    name: string;
    active?: boolean;
    selected?: boolean;
    onClick?: () => void;
    icon?: React.ReactNode;
}

export function LayerItem({ name, active, selected, onClick }: LayerItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-left group",
                selected ? "bg-amber-500/10 text-white" : "text-slate-400 hover:bg-slate-800/30"
            )}
        >
            <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                active ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : selected ? "bg-amber-500" : "bg-slate-700"
            )} />
            <span className="text-[13px] font-medium tracking-wide">{name}</span>
        </button>
    );
}
