import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import BootSplash from 'react-native-bootsplash';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useNetworkStore } from './src/stores/networkStore';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const startListening = useNetworkStore(s => s.startListening);

  useEffect(() => {
    const unsubscribe = startListening();
    // Hide splash screen after app is ready
    BootSplash.hide({ fade: true });
    return unsubscribe;
  }, [startListening]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="#F5F5FA"
        />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
