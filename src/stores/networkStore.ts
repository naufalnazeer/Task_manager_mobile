import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  startListening: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,

  startListening: () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({ isConnected: state.isConnected ?? false });
    });
    return unsubscribe;
  },
}));
