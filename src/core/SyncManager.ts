export type SyncMessage =
    | { type: 'PLAY' }
    | { type: 'PAUSE' }
    | { type: 'SEEK', time: number }
    | { type: 'WARP_UPDATE', index: number, points: any[] }
    | { type: 'VIDEO_READY', url: string };

export class SyncManager {
    private channel: BroadcastChannel;
    private onMessageCallback: (msg: SyncMessage) => void;

    constructor(role: 'control' | 'output', onMessage: (msg: SyncMessage) => void) {
        this.channel = new BroadcastChannel('lumina_sync');
        this.onMessageCallback = onMessage;
        this.channel.onmessage = (event) => {
            this.onMessageCallback(event.data);
        };
    }

    public send(msg: SyncMessage) {
        this.channel.postMessage(msg);
    }

    public close() {
        this.channel.close();
    }
}
