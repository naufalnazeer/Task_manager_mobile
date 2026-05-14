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
import { TaskPriority, RecurrenceType, Subtask, DEFAULT_RECURRENCE } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { useNetworkStore } from '../stores/networkStore';
import { generateId } from '../utils/id';
import { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateTask'>;
};

const PRIORITIES: { label: string; value: TaskPriority; color: string }[] = [
  { label: 'Low', value: 'low', color: '#4ECDC4' },
  { label: 'Medium', value: 'medium', color: '#FFB347' },
  { label: 'High', value: 'high', color: '#FF6B6B' },
  { label: 'Urgent', value: 'urgent', color: '#D32F2F' },
];

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function CreateTaskScreen({ navigation }: Props) {
  const createTask = useTaskStore(s => s.createTask);
  const categories = useTaskStore(s => s.categories);
  const isConnected = useNetworkStore(s => s.isConnected);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('');
  const [labelsText, setLabelsText] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      return;
    }
    setSubtasks(prev => [
      ...prev,
      {
        id: generateId(),
        title: newSubtaskTitle.trim(),
        isCompleted: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a task title.');
      return;
    }

    const labels = labelsText
      .split(',')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    createTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate.trim() || null,
      category: category.trim(),
      labels,
      notes: notes.trim(),
      subtasks,
      recurrence:
        recurrenceType === 'none'
          ? DEFAULT_RECURRENCE
          : { type: recurrenceType, interval: 1 },
    });
    navigation.goBack();
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

        {/* Title */}
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

        {/* Description (Rich Text / Markdown) */}
        <View style={styles.field}>
          <Text style={styles.label}>Description (supports markdown)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="**Bold**, *italic*, - bullet points..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Task description"
          />
        </View>

        {/* Priority */}
        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.chip,
                  priority === p.value && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => setPriority(p.value)}
                accessibilityLabel={`Priority: ${p.label}`}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.chipText,
                    priority === p.value && styles.chipTextActive,
                  ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-12-31"
            placeholderTextColor="#999"
            value={dueDate}
            onChangeText={setDueDate}
            accessibilityLabel="Due date"
          />
        </View>

        {/* Recurrence */}
        <View style={styles.field}>
          <Text style={styles.label}>Recurring</Text>
          <View style={styles.chipRow}>
            {RECURRENCE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[
                  styles.chip,
                  recurrenceType === r.value && styles.chipActive,
                ]}
                onPress={() => setRecurrenceType(r.value)}
                accessibilityLabel={`Recurrence: ${r.label}`}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.chipText,
                    recurrenceType === r.value && styles.chipTextActive,
                  ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Work, Personal, Health"
            placeholderTextColor="#999"
            value={category}
            onChangeText={setCategory}
            accessibilityLabel="Category"
          />
          {categories.length > 0 && (
            <View style={styles.suggestionsRow}>
              {categories.slice(0, 5).map(c => (
                <TouchableOpacity
                  key={c}
                  style={styles.suggestion}
                  onPress={() => setCategory(c)}>
                  <Text style={styles.suggestionText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Labels/Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Labels (comma-separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., bug, feature, design"
            placeholderTextColor="#999"
            value={labelsText}
            onChangeText={setLabelsText}
            accessibilityLabel="Labels"
          />
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Additional notes..."
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Notes"
          />
        </View>

        {/* Subtasks */}
        <View style={styles.field}>
          <Text style={styles.label}>Subtasks</Text>
          {subtasks.map(subtask => (
            <View key={subtask.id} style={styles.subtaskRow}>
              <Text style={styles.subtaskTitle}>• {subtask.title}</Text>
              <TouchableOpacity onPress={() => handleRemoveSubtask(subtask.id)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.addSubtaskRow}>
            <TextInput
              style={[styles.input, styles.subtaskInput]}
              placeholder="Add subtask..."
              placeholderTextColor="#999"
              value={newSubtaskTitle}
              onChangeText={setNewSubtaskTitle}
              onSubmitEditing={handleAddSubtask}
              returnKeyType="done"
              accessibilityLabel="New subtask"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddSubtask}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
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
  container: { flex: 1, backgroundColor: '#F5F5FA' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  offlineNotice: { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 16 },
  offlineText: { fontSize: 13, color: '#E65100', textAlign: 'center' },
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 15, color: '#1A1A2E', borderWidth: 1, borderColor: '#E8E8F0',
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 2, borderColor: '#E8E8F0', backgroundColor: '#FFF',
  },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#FFFFFF' },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  suggestion: { backgroundColor: '#E8E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  suggestionText: { fontSize: 12, color: '#555' },
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFF',
    borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0',
  },
  subtaskTitle: { fontSize: 14, color: '#333', flex: 1 },
  removeBtn: { fontSize: 14, color: '#FF4444', fontWeight: '700', paddingLeft: 12 },
  addSubtaskRow: { flexDirection: 'row', gap: 8 },
  subtaskInput: { flex: 1 },
  addBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { fontSize: 20, color: '#FFF', fontWeight: '600' },
  submitButton: { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
