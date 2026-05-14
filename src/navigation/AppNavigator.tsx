import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { TaskListScreen } from '../screens/TaskListScreen';
import { CreateTaskScreen } from '../screens/CreateTaskScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { AuthStackParamList, RootStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#F5F5FA' },
        headerTintColor: '#1A1A2E',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}>
      <MainStack.Screen
        name="TaskList"
        component={TaskListScreen}
        options={{ title: 'My Tasks' }}
      />
      <MainStack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ title: 'New Task' }}
      />
      <MainStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
    </MainStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
}
