import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { pick } from '@react-native-documents/picker';
import { TaskStatus, TaskPriority, Attachment, VoiceNote } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { useNetworkStore } from '../stores/networkStore';
import { generateId } from '../utils/id';
import { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4ECDC4',
  medium: '#FFB347',
  high: '#FF6B6B',
  urgent: '#D32F2F',
};

const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
  { label: '○ Pending', value: 'pending' },
  { label: '◐ In Progress', value: 'in-progress' },
  { label: '● Completed', value: 'completed' },
];

const PRIORITY_OPTIONS: { label: string; value: TaskPriority }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

export function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const {
    getTask,
    updateTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    removeSubtask,
    addAttachment,
    removeAttachment,
    addVoiceNote,
    removeVoiceNote,
  } = useTaskStore();
  const isConnected = useNetworkStore(s => s.isConnected);
  const task = getTask(taskId);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLabels, setEditLabels] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Task not found</Text>
      </View>
    );
  }

  const startEditing = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditNotes(task.notes);
    setEditCategory(task.category);
    setEditLabels(task.labels.join(', '));
    setIsEditing(true);
  };

  const saveEdits = () => {
    if (!editTitle.trim()) {
      Alert.alert('Validation', 'Title cannot be empty.');
      return;
    }
    const labels = editLabels.split(',').map(l => l.trim()).filter(l => l.length > 0);
    updateTask(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      notes: editNotes.trim(),
      category: editCategory.trim(),
      labels,
    });
    setIsEditing(false);
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTask(task.id, { status });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTask(task.id, { priority });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) {
      return;
    }
    addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handleAddAttachment = async () => {
    try {
      const [result] = await pick();
      if (result) {
        const attachment: Attachment = {
          id: generateId(),
          fileName: result.name || `file_${Date.now()}`,
          filePath: result.uri,
          fileSize: result.size || 0,
          mimeType: result.type || 'application/octet-stream',
          createdAt: new Date().toISOString(),
        };
        addAttachment(task.id, attachment);
      }
    } catch (err) {
      // User cancelled or error
      if (err instanceof Error && !err.message.includes('cancel')) {
        Alert.alert('Error', 'Failed to pick file.');
      }
    }
  };

  const handleAddVoiceNote = () => {
    // Simulated — in production, use react-native-audio-recorder-player
    const voiceNote: VoiceNote = {
      id: generateId(),
      filePath: `/local/path/voice_${Date.now()}.m4a`,
      duration: 15,
      createdAt: new Date().toISOString(),
    };
    addVoiceNote(task.id, voiceNote);
    Alert.alert('Voice Note', 'Voice note recorded (demo).');
  };

  const handleDelete = () => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const completedSubtasks = task.subtasks.filter(s => s.isCompleted).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>⚡ Offline — Changes will sync later</Text>
        </View>
      )}

      {/* Header */}
      {isEditing ? (
        <View style={styles.field}>
          <TextInput
            style={[styles.input, styles.titleInput]}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Task title"
            accessibilityLabel="Edit title"
          />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.title}>{task.title}</Text>
          <TouchableOpacity onPress={startEditing} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Priority & Category */}
      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[task.priority] || '#999' }]}>
          <Text style={styles.badgeText}>{task.priority}</Text>
        </View>
        {task.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>📁 {task.category}</Text>
          </View>
        ) : null}
        {task.recurrence.type !== 'none' && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>🔄 {task.recurrence.type}</Text>
          </View>
        )}
      </View>

      {/* Labels */}
      {task.labels.length > 0 && (
        <View style={styles.labelsRow}>
          {task.labels.map(label => (
            <View key={label} style={styles.labelChip}>
              <Text style={styles.labelText}>#{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Sync Info */}
      <View style={styles.syncInfo}>
        <Text style={styles.syncLabel}>
          {task.lastSyncedAt ? `✓ Synced` : task.needsSync ? '⏳ Pending sync' : '○ Local'}
        </Text>
        {task.dueDate && <Text style={styles.syncLabel}>📅 Due: {task.dueDate}</Text>}
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Description</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editDescription}
            onChangeText={setEditDescription}
            multiline
            placeholder="Description (markdown supported)"
            accessibilityLabel="Edit description"
          />
        ) : (
          <Text style={styles.descriptionText}>{task.description || 'No description'}</Text>
        )}
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notes</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editNotes}
            onChangeText={setEditNotes}
            multiline
            placeholder="Additional notes..."
            accessibilityLabel="Edit notes"
          />
        ) : (
          <Text style={styles.descriptionText}>{task.notes || 'No notes'}</Text>
        )}
      </View>

      {/* Category & Labels (edit mode) */}
      {isEditing && (
        <>
          <View style={styles.field}>
            <Text style={styles.sectionLabel}>Category</Text>
            <TextInput style={styles.input} value={editCategory} onChangeText={setEditCategory} placeholder="Category" />
          </View>
          <View style={styles.field}>
            <Text style={styles.sectionLabel}>Labels (comma-separated)</Text>
            <TextInput style={styles.input} value={editLabels} onChangeText={setEditLabels} placeholder="label1, label2" />
          </View>
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdits}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.optionsCol}>
          {STATUS_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionBtn, task.status === option.value && styles.optionBtnActive]}
              onPress={() => handleStatusChange(option.value)}>
              <Text style={[styles.optionText, task.status === option.value && styles.optionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.chipRow}>
          {PRIORITY_OPTIONS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, task.priority === p.value && { backgroundColor: PRIORITY_COLORS[p.value], borderColor: PRIORITY_COLORS[p.value] }]}
              onPress={() => handlePriorityChange(p.value)}>
              <Text style={[styles.chipText, task.priority === p.value && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Subtasks */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Subtasks ({completedSubtasks}/{task.subtasks.length})
        </Text>
        {task.subtasks.map(subtask => (
          <View key={subtask.id} style={styles.subtaskRow}>
            <TouchableOpacity onPress={() => toggleSubtask(task.id, subtask.id)} style={styles.subtaskCheck}>
              <Text style={styles.subtaskIcon}>{subtask.isCompleted ? '☑' : '☐'}</Text>
            </TouchableOpacity>
            <Text style={[styles.subtaskTitle, subtask.isCompleted && styles.subtaskDone]}>
              {subtask.title}
            </Text>
            <TouchableOpacity onPress={() => removeSubtask(task.id, subtask.id)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Add subtask..."
            placeholderTextColor="#999"
            value={newSubtaskTitle}
            onChangeText={setNewSubtaskTitle}
            onSubmitEditing={handleAddSubtask}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddSubtask}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Attachments */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Attachments ({task.attachments.length})</Text>
        {task.attachments.map(att => (
          <View key={att.id} style={styles.attachmentRow}>
            <Text style={styles.attachmentName}>📎 {att.fileName}</Text>
            <TouchableOpacity onPress={() => removeAttachment(task.id, att.id)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.actionBtn} onPress={handleAddAttachment}>
          <Text style={styles.actionBtnText}>+ Add Attachment</Text>
        </TouchableOpacity>
      </View>

      {/* Voice Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Voice Notes ({task.voiceNotes.length})</Text>
        {task.voiceNotes.map(vn => (
          <View key={vn.id} style={styles.attachmentRow}>
            <Text style={styles.attachmentName}>🎙️ {vn.duration}s — {new Date(vn.createdAt).toLocaleTimeString()}</Text>
            <TouchableOpacity onPress={() => removeVoiceNote(task.id, vn.id)}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.actionBtn} onPress={handleAddVoiceNote}>
          <Text style={styles.actionBtnText}>+ Record Voice Note</Text>
        </TouchableOpacity>
      </View>

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>{new Date(task.createdAt).toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Updated</Text>
          <Text style={styles.detailValue}>{new Date(task.updatedAt).toLocaleString()}</Text>
        </View>
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Delete Task</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5FA' },
  content: { padding: 20, paddingBottom: 40 },
  notFound: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 40 },
  offlineNotice: { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 16 },
  offlineText: { fontSize: 13, color: '#E65100', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', flex: 1, marginRight: 12 },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8E8F0', justifyContent: 'center', alignItems: 'center' },
  editBtnText: { fontSize: 16 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFF', textTransform: 'capitalize' },
  categoryBadge: { backgroundColor: '#E8E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryText: { fontSize: 12, color: '#555' },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  labelChip: { backgroundColor: '#EDE7F6', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  labelText: { fontSize: 12, color: '#5E35B1', fontWeight: '600' },
  syncInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, padding: 8, backgroundColor: '#F0F0F8', borderRadius: 8 },
  syncLabel: { fontSize: 12, color: '#666' },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  descriptionText: { fontSize: 15, color: '#333', lineHeight: 22 },
  field: { marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1A2E', borderWidth: 1, borderColor: '#E8E8F0' },
  titleInput: { fontSize: 18, fontWeight: '600' },
  textArea: { minHeight: 80, paddingTop: 12 },
  editActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  saveBtn: { flex: 1, backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  cancelBtn: { flex: 1, backgroundColor: '#E8E8F0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600', fontSize: 15 },
  optionsCol: { gap: 8 },
  optionBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E8F0' },
  optionBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  optionText: { fontSize: 14, fontWeight: '600', color: '#666' },
  optionTextActive: { color: '#FFF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2, borderColor: '#E8E8F0' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  chipTextActive: { color: '#FFF' },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFF', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  subtaskCheck: { marginRight: 10 },
  subtaskIcon: { fontSize: 18 },
  subtaskTitle: { flex: 1, fontSize: 14, color: '#333' },
  subtaskDone: { textDecorationLine: 'line-through', color: '#999' },
  removeBtn: { fontSize: 14, color: '#FF4444', fontWeight: '700', paddingLeft: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
  addBtnText: { fontSize: 20, color: '#FFF', fontWeight: '600' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFF', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#F0F0F0' },
  attachmentName: { fontSize: 13, color: '#333', flex: 1 },
  actionBtn: { backgroundColor: '#F0F0F8', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#E8E8F0' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#6C63FF' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  detailLabel: { fontSize: 14, color: '#888' },
  detailValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  deleteButton: { backgroundColor: '#FFF0F0', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#FFD0D0' },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#FF4444' },
});
