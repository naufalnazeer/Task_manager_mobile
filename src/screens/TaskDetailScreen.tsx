import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { TaskStatus } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { useNetworkStore } from '../stores/networkStore';
import { RootStackParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

const PRIORITY_COLORS = {
  low: '#4ECDC4',
  medium: '#FFB347',
  high: '#FF6B6B',
};

const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
  { label: '○ Pending', value: 'pending' },
  { label: '◐ In Progress', value: 'in-progress' },
  { label: '● Completed', value: 'completed' },
];

export function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { getTask, updateTask, deleteTask } = useTaskStore();
  const isConnected = useNetworkStore(s => s.isConnected);
  const task = getTask(taskId);

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Task not found</Text>
      </View>
    );
  }

  const handleStatusChange = (status: TaskStatus) => {
    updateTask(task.id, { status });
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>
            ⚡ Offline — Changes will sync when back online
          </Text>
        </View>
      )}

      {/* Title & Priority */}
      <View style={styles.header}>
        <Text style={styles.title}>{task.title}</Text>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: PRIORITY_COLORS[task.priority] },
          ]}>
          <Text style={styles.priorityText}>{task.priority}</Text>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.syncInfo}>
        <Text style={styles.syncLabel}>
          {task.lastSyncedAt
            ? `✓ Synced ${new Date(task.lastSyncedAt).toLocaleString()}`
            : task.needsSync
              ? '⏳ Pending sync'
              : '○ Local only'}
        </Text>
      </View>

      {/* Description */}
      {task.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>
      ) : null}

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusOption,
                task.status === option.value && styles.statusOptionActive,
              ]}
              onPress={() => handleStatusChange(option.value)}
              accessibilityLabel={`Set status to ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: task.status === option.value }}>
              <Text
                style={[
                  styles.statusOptionText,
                  task.status === option.value && styles.statusOptionTextActive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>
            {new Date(task.createdAt).toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Updated</Text>
          <Text style={styles.detailValue}>
            {new Date(task.updatedAt).toLocaleString()}
          </Text>
        </View>
        {task.dueDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due</Text>
            <Text style={styles.detailValue}>
              {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {/* Delete */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        accessibilityLabel="Delete task"
        accessibilityRole="button">
        <Text style={styles.deleteText}>Delete Task</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FA',
  },
  content: {
    padding: 20,
  },
  notFound: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  syncInfo: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0F0F8',
    borderRadius: 8,
  },
  syncLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  statusRow: {
    gap: 8,
  },
  statusOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8F0',
    marginBottom: 8,
  },
  statusOptionActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4444',
  },
});
