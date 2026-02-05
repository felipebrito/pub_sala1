import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal, Cpu, Play, AlertCircle, CheckCircle, RefreshCw, Usb, ArrowRight, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Typewriter } from './ui/typewriter';

const FIRMWARE_PATH = 'firmware/.pio/build/esp32dev/firmware.bin';

export default function FirmwareUpload() {
    // Connection State
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Wizard State
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0:Intro, 1:Port, 2:Flashing, 3:Result
    const [subStep, setSubStep] = useState<'flashing' | 'verifying'>('flashing');

    // Data State
    const [ports, setPorts] = useState<{ path: string, manufacturer?: string }[]>([]);
    const [selectedPort, setSelectedPort] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorTip, setErrorTip] = useState<string | null>(null);

    const logEndRef = useRef<HTMLDivElement>(null);
    const selectedPortRef = useRef('');

    // Update ref for accessing in callbacks
    useEffect(() => {
        selectedPortRef.current = selectedPort;
    }, [selectedPort]);

    // Initialize Socket
    useEffect(() => {
        const s = io('http://localhost:3001');
        setSocket(s);

        s.on('connect', () => {
            setIsConnected(true);
            console.log("Connected to Flasher Bridge");
        });

        s.on('ports-list', (list) => {
            setPorts(list);
            // Auto-select first if none selected
            if (list.length > 0 && !selectedPortRef.current) {
                // Try to find USB serial
                const usb = list.find((p: any) => p.path.includes('usb') || p.path.includes('USB'));
                if (usb) setSelectedPort(usb.path);
                else setSelectedPort(list[0].path);
            }
        });

        s.on('flash-log', (msg: string) => {
            setLogs(prev => [...prev, msg]);
        });

        s.on('flash-complete', ({ success }: { success: boolean }) => {
            if (success) {
                // Start Verification
                setStatus('idle');
                setSubStep('verifying');
                setLogs(prev => [...prev, '[Sistema] Verificando Instalação...', '[Sistema] Aguardando reinício do dispositivo...']);
                // Delay slightly to allow reboot
                setTimeout(() => {
                    s.emit('verify-firmware', { port: selectedPortRef.current });
                }, 2000);
            } else {
                setStatus('error');
                setStep(3);
            }
        });

        s.on('verify-log', (msg: string) => {
            setLogs(prev => [...prev, msg]);
        });

        s.on('verify-error-tip', (tip: string) => {
            setErrorTip(tip);
        });

        s.on('verify-complete', ({ success }: { success: boolean }) => {
            setStatus(success ? 'success' : 'error');
            setStep(3);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const scanPorts = () => {
        setPorts([]);
        socket?.emit('get-ports');
    };

    // Auto-scan when entering Step 1
    useEffect(() => {
        if (step === 1) scanPorts();
    }, [step]);

    const startFlash = () => {
        if (!selectedPort) return;
        setStep(2);
        setStatus('idle');
        setSubStep('flashing');
        setLogs(['[Sistema] Iniciando Processo de Gravação...', `[Alvo] ${selectedPort}`, `[Firmware] Adalight Padrão v1.0`]);
        socket?.emit('flash-firmware', { port: selectedPort, firmwarePath: FIRMWARE_PATH });
    };

    const reset = () => {
        setStep(0);
        setLogs([]);
        setStatus('idle');
        setSubStep('flashing');
        setErrorTip(null);
    };

    return (
        <div className="min-h-screen bg-black text-neutral-200 font-sans flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 via-black to-purple-900/20 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Cpu className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">Instalação de Firmware</h1>
                            <p className="text-xs text-neutral-500">Configuração do Módulo Serial de controle de LEDs</p>
                        </div>
                    </div>
                    {/* Step Indicator */}
                    <div className="flex items-center space-x-2">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${step >= i ? 'bg-blue-500' : 'bg-neutral-800'}`} />
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 min-h-[400px] flex flex-col relative">
                    <AnimatePresence mode='wait'>

                        {/* STEP 0: INTRO */}
                        {step === 0 && (
                            <motion.div
                                key="step0"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col justify-center items-center text-center space-y-6"
                            >
                                <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-violet-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-[pulse_3s_infinite]">
                                    <Zap className="w-10 h-10 text-white fill-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Configure seu Dispositivo</h2>
                                    <p className="text-neutral-400 max-w-sm mx-auto">
                                        Este assistente irá guiá-lo na gravação do firmware Adalight na sua ESP32.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setStep(1)}
                                    className="group flex items-center space-x-2 bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-neutral-200 transition-all active:scale-95"
                                >
                                    <span>Começar</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        )}

                        {/* STEP 1: PORT SELECTION */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col"
                            >
                                <h2 className="text-xl font-bold text-white mb-6">Conectar Dispositivo</h2>

                                <div className="space-y-4 flex-1">
                                    <div className="bg-black/50 border border-white/10 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-neutral-500 uppercase">Selecione a Porta Serial</label>
                                            <div className="flex space-x-2">
                                                <button onClick={() => { setPorts([]); socket?.emit('get-ports'); }} className="p-1 hover:bg-white/10 rounded transition-colors text-xs text-neutral-400">
                                                    Buscar Novamente
                                                </button>
                                            </div>
                                        </div>

                                        {ports.length === 0 ? (
                                            <div className="text-center py-8 text-neutral-500 text-sm italic flex flex-col items-center">
                                                <div className="mb-2">Procurando portas...</div>
                                                <div className="text-xs opacity-50">Verifique se sua ESP32 está conectada.</div>

                                                {/* Manual Fallback */}
                                                <div className="mt-4 pt-4 border-t border-white/5 w-full">
                                                    <p className="text-[10px] mb-2">Não encontrou?</p>
                                                    <input
                                                        type="text"
                                                        placeholder="ex: /dev/tty.usbserial-0001"
                                                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs w-2/3 text-center font-mono"
                                                        value={selectedPort}
                                                        onChange={(e) => setSelectedPort(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {ports.map(p => (
                                                    <div
                                                        key={p.path}
                                                        onClick={() => setSelectedPort(p.path)}
                                                        className={`
                                                            flex items-center p-3 rounded-lg border cursor-pointer transition-all
                                                            ${selectedPort === p.path
                                                                ? 'bg-blue-500/20 border-blue-500 text-white'
                                                                : 'bg-neutral-900 border-transparent hover:border-white/20 text-neutral-400'}
                                                        `}
                                                    >
                                                        <Usb className="w-4 h-4 mr-3" />
                                                        <div className="flex-1">
                                                            <div className="font-mono text-sm">{p.path}</div>
                                                            {p.manufacturer && <div className="text-[10px] opacity-60">{p.manufacturer}</div>}
                                                        </div>
                                                        {selectedPort === p.path && <CheckCircle className="w-4 h-4 text-blue-400" />}
                                                    </div>
                                                ))}

                                                {/* Manual Option in List */}
                                                <div className="pt-2 mt-2 border-t border-white/5">
                                                    <div className="text-[10px] text-neutral-600 mb-1 px-1">Ou digite manualmente:</div>
                                                    <input
                                                        type="text"
                                                        placeholder="/dev/tty..."
                                                        className="bg-transparent border border-neutral-800 rounded px-2 py-1 text-xs w-full font-mono text-neutral-400 focus:border-blue-500 focus:outline-none"
                                                        value={selectedPort}
                                                        onChange={(e) => setSelectedPort(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5 flex items-center space-x-4">
                                        <div className="w-10 h-10 bg-neutral-800 rounded flex items-center justify-center">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute" />
                                            <div className="w-2 h-2 bg-green-500 rounded-full relative" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Aparato pixels v1.0</div>
                                            <div className="text-xs text-neutral-500">Firmware Padrão • 120-300 LEDs • 115200 Baud</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-between">
                                    <button onClick={() => setStep(0)} className="text-neutral-500 hover:text-white px-4 py-2">Voltar</button>
                                    <button
                                        onClick={startFlash}
                                        disabled={!selectedPort}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center"
                                    >
                                        <span>Iniciar Gravação</span>
                                        <Play className="w-4 h-4 ml-2 fill-current" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: FLASHING & VERIFYING */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex-1 flex flex-col h-full"
                            >
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                        <Typewriter
                                            words={subStep === 'flashing'
                                                ? [
                                                    "Instalando Firmware...",
                                                    "Reticulando Splines...",
                                                    "Convencendo a ESP32 a colaborar...",
                                                    "Baixando mais memória RAM...",
                                                    "Alinhando o Fluxo Quântico...",
                                                    "Não olhe diretamente para os LEDs...",
                                                    "Gerando pixels brilhantes...",
                                                    "Invadindo o sistema central...",
                                                    "Passando um cafézinho..."
                                                ]
                                                : [
                                                    "Verificando Instalação...",
                                                    "Pingando o dispositivo...",
                                                    "Tem alguém em casa?",
                                                    "Apertando as mãos...",
                                                    "Procurando sinais de vida..."
                                                ]
                                            }
                                            speed={40}
                                            delayBetweenWords={1500}
                                            cursor={true}
                                        />
                                    </h2>
                                    <div className="text-xs font-mono text-blue-400 shrink-0">NÃO DESCONECTE</div>
                                </div>

                                {/* Fixed height container to prevent growing */}
                                <div className="h-64 bg-black rounded-xl border border-white/10 p-4 font-mono text-xs overflow-hidden flex flex-col shadow-inner shrink-0">
                                    <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/20">
                                        {logs.map((log, i) => (
                                            <div key={i} className={`${log.includes('ERROR') ? 'text-red-400' : 'text-neutral-400'}`}>
                                                <span className="opacity-30 mr-2">{new Date().toLocaleTimeString()}</span>
                                                {log}
                                            </div>
                                        ))}
                                        <div ref={logEndRef} />
                                    </div>
                                </div>

                                <div className="h-1 bg-neutral-800 mt-4 rounded-full overflow-hidden shrink-0">
                                    <div className="h-full bg-blue-500 w-full animate-[progress_15s_ease-in-out_infinite]" />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: RESULT */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-1 flex flex-col justify-center items-center text-center space-y-6"
                            >
                                {status === 'success' ? (
                                    <>
                                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 mb-2">
                                            <CheckCircle className="w-10 h-10 text-green-500" />
                                        </div>
                                        <h2 className="text-3xl font-bold text-white">Sucesso!</h2>
                                        <p className="text-neutral-400">Sua ESP32 está pronta para receber pixels.</p>
                                        <div className="bg-neutral-900 p-4 rounded-lg text-sm text-neutral-300 border border-white/10 mt-4 max-w-sm">
                                            <p className="mb-2 font-bold text-white">Próximos Passos:</p>
                                            <ol className="list-decimal list-inside text-left space-y-1 text-neutral-400">
                                                <li>Feche este assistente</li>
                                                <li>Selecione <b>{selectedPort.split('/').pop()}</b> nas configurações da LED Bridge</li>
                                                <li>Aproveite suas luzes!</li>
                                            </ol>
                                        </div>

                                        <button
                                            onClick={() => socket?.emit('blink-device', { port: selectedPort })}
                                            className="text-xs flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-3 py-1 rounded-full text-neutral-300 mt-2 transition-colors border border-white/5 active:scale-95"
                                        >
                                            <Zap className="w-3 h-3 text-yellow-500" />
                                            Testar: Piscar LEDs
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500 mb-2">
                                            <AlertCircle className="w-10 h-10 text-red-500" />
                                        </div>
                                        <h2 className="text-3xl font-bold text-white">Falha na Gravação</h2>
                                        <p className="text-neutral-400">Algo deu errado durante o envio.</p>
                                        <div className="text-xs text-red-400 bg-red-900/10 p-2 rounded mt-2 border border-red-900/30">
                                            Verifique: Porta correta? Botão Boot pressionado?
                                        </div>
                                        {errorTip && (
                                            <div className="text-sm font-bold text-yellow-500 animate-pulse mt-2 bg-yellow-900/20 p-2 rounded border border-yellow-500/50">
                                                {errorTip}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex space-x-4 mt-6">
                                    <button
                                        onClick={reset}
                                        className="text-neutral-500 hover:text-white px-6 py-2"
                                    >
                                        Reiniciar Assistente
                                    </button>
                                    <button
                                        onClick={() => window.location.href = '/'}
                                        className="bg-white text-black px-8 py-2 rounded-lg font-bold hover:bg-neutral-200 transition-colors"
                                    >
                                        Voltar ao App
                                    </button>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

            </motion.div>
        </div>
    );
}
