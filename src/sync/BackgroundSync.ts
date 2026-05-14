import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';
import { useNetworkStore } from '../stores/networkStore';

const SYNC_INTERVAL_MS = 30000; // 30 seconds
const MIN_SYNC_GAP_MS = 5000; // Minimum 5s between syncs

/**
 * Background sync manager.
 * Auto-syncs on: network restore, app foreground, periodic interval.
 */
class BackgroundSyncManager {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastSyncTime = 0;
  private unsubscribeNetInfo: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  start(): void {
    // Network listener
    this.unsubscribeNetInfo = NetInfo.addEventListener(
      (state: NetInfoState) => {
        const wasOffline = !useNetworkStore.getState().isConnected;
        useNetworkStore.setState({ isConnected: state.isConnected ?? false });

        if (wasOffline && state.isConnected) {
          this.sync();
        }
      },
    );

    // App state listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && useNetworkStore.getState().isConnected) {
          this.sync();
        }
      },
    );

    // Periodic sync
    this.interval = setInterval(() => {
      if (useNetworkStore.getState().isConnected) {
        this.sync();
      }
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  async sync(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncTime < MIN_SYNC_GAP_MS) {
      return;
    }
    this.lastSyncTime = now;
    await useSyncStore.getState().triggerSync();
  }
}

export const backgroundSync = new BackgroundSyncManager();
