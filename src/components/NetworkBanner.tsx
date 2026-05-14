import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNetworkStore } from '../stores/networkStore';
import { useSyncStore } from '../stores/syncStore';

export function NetworkBanner() {
  const isConnected = useNetworkStore(s => s.isConnected);
  const { isSyncing, pendingCount, lastError, triggerSync } = useSyncStore();

  if (isConnected && pendingCount === 0 && !lastError) {
    return null;
  }

  const getBannerStyle = () => {
    if (!isConnected) {
      return styles.offline;
    }
    if (lastError) {
      return styles.error;
    }
    return styles.syncing;
  };

  return (
    <View style={[styles.container, getBannerStyle()]}>
      {!isConnected ? (
        <Text style={styles.text}>⚡ Offline — Changes saved locally</Text>
      ) : lastError ? (
        <View style={styles.row}>
          <Text style={styles.text} numberOfLines={1}>
            ⚠️ {lastError}
          </Text>
          <TouchableOpacity
            onPress={triggerSync}
            style={styles.retryButton}
            accessibilityLabel="Retry sync"
            accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : pendingCount > 0 ? (
        <View style={styles.row}>
          <Text style={styles.text}>
            {isSyncing
              ? '🔄 Syncing...'
              : `📤 ${pendingCount} pending change${pendingCount > 1 ? 's' : ''}`}
          </Text>
          {!isSyncing && (
            <TouchableOpacity
              onPress={triggerSync}
              style={styles.syncButton}
              accessibilityLabel="Sync now"
              accessibilityRole="button">
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offline: {
    backgroundColor: '#FF6B6B',
  },
  syncing: {
    backgroundColor: '#FFB347',
  },
  error: {
    backgroundColor: '#E53935',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  syncButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
