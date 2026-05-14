import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TaskPriority } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { useNetworkStore } from '../stores/networkStore';
import { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateTask'>;
};

const PRIORITIES: { label: string; value: TaskPriority; color: string }[] = [
  { label: 'Low', value: 'low', color: '#4ECDC4' },
  { label: 'Medium', value: 'medium', color: '#FFB347' },
  { label: 'High', value: 'high', color: '#FF6B6B' },
];

export function CreateTaskScreen({ navigation }: Props) {
  const createTask = useTaskStore(s => s.createTask);
  const isConnected = useNetworkStore(s => s.isConnected);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a task title.');
      return;
    }

    try {
      createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: null,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to create task. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {!isConnected && (
          <View style={styles.offlineNotice}>
            <Text style={styles.offlineText}>
              ⚡ Offline — Task will be saved locally and synced later
            </Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="What needs to be done?"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            accessibilityLabel="Task title"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add more details..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Task description"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityOption,
                  priority === p.value && {
                    backgroundColor: p.color,
                    borderColor: p.color,
                  },
                ]}
                onPress={() => setPriority(p.value)}
                accessibilityLabel={`Priority: ${p.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: priority === p.value }}>
                <Text
                  style={[
                    styles.priorityOptionText,
                    priority === p.value && styles.priorityOptionTextActive,
                  ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          accessibilityLabel="Create task"
          accessibilityRole="button">
          <Text style={styles.submitText}>Create Task</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FA',
  },
  scrollContent: {
    padding: 20,
  },
  offlineNotice: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    fontSize: 13,
    color: '#E65100',
    textAlign: 'center',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E8F0',
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  priorityOptionTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
