import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Task } from '../types/task';

interface TaskCardProps {
  task: Task;
  onPress: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  searchQuery?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4ECDC4',
  medium: '#FFB347',
  high: '#FF6B6B',
  urgent: '#D32F2F',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '○',
  'in-progress': '◐',
  completed: '●',
};

function HighlightedText({
  text,
  highlight,
  style,
  numberOfLines,
}: {
  text: string;
  highlight?: string;
  style: object;
  numberOfLines?: number;
}) {
  if (!highlight || !highlight.trim()) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const query = highlight.toLowerCase();
  const parts: { text: string; isMatch: boolean }[] = [];
  let remaining = text;
  let lowerRemaining = text.toLowerCase();

  while (lowerRemaining.length > 0) {
    const matchIndex = lowerRemaining.indexOf(query);
    if (matchIndex === -1) {
      parts.push({ text: remaining, isMatch: false });
      break;
    }
    if (matchIndex > 0) {
      parts.push({ text: remaining.slice(0, matchIndex), isMatch: false });
    }
    parts.push({ text: remaining.slice(matchIndex, matchIndex + query.length), isMatch: true });
    remaining = remaining.slice(matchIndex + query.length);
    lowerRemaining = lowerRemaining.slice(matchIndex + query.length);
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.isMatch ? (
          <Text key={i} style={styles.highlight}>{part.text}</Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

export function TaskCard({ task, onPress, onToggleStatus, searchQuery }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const completedSubtasks = task.subtasks.filter(s => s.isCompleted).length;

  return (
    <TouchableOpacity
      style={[styles.card, isCompleted && styles.completedCard]}
      onPress={() => onPress(task)}
      accessibilityLabel={`Task: ${task.title}`}
      accessibilityRole="button">
      <TouchableOpacity
        style={styles.statusButton}
        onPress={() => onToggleStatus(task)}
        accessibilityLabel={`Mark as ${isCompleted ? 'pending' : 'completed'}`}
        accessibilityRole="button">
        <Text style={styles.statusIcon}>{STATUS_LABELS[task.status] || '○'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <HighlightedText
          text={task.title}
          highlight={searchQuery}
          style={[styles.title, isCompleted && styles.completedTitle]}
          numberOfLines={1}
        />

        {task.description ? (
          <HighlightedText
            text={task.description}
            highlight={searchQuery}
            style={styles.description}
            numberOfLines={2}
          />
        ) : null}

        <View style={styles.meta}>
          <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[task.priority] || '#999' }]}>
            <Text style={styles.priorityText}>{task.priority}</Text>
          </View>

          {task.category ? (
            <Text style={styles.metaText}>📁 {task.category}</Text>
          ) : null}

          {task.dueDate && (
            <Text style={styles.metaText}>📅 {task.dueDate}</Text>
          )}

          {task.subtasks.length > 0 && (
            <Text style={styles.metaText}>
              ☑ {completedSubtasks}/{task.subtasks.length}
            </Text>
          )}

          {task.attachments.length > 0 && (
            <Text style={styles.metaText}>📎 {task.attachments.length}</Text>
          )}

          {task.voiceNotes.length > 0 && (
            <Text style={styles.metaText}>🎙️ {task.voiceNotes.length}</Text>
          )}

          {task.recurrence.type !== 'none' && (
            <Text style={styles.metaText}>🔄</Text>
          )}

          {task.needsSync && <Text style={styles.metaText}>⏳</Text>}
        </View>

        {/* Labels */}
        {task.labels.length > 0 && (
          <View style={styles.labelsRow}>
            {task.labels.slice(0, 3).map(label => (
              <View key={label} style={styles.labelChip}>
                <Text style={styles.labelText}>#{label}</Text>
              </View>
            ))}
            {task.labels.length > 3 && (
              <Text style={styles.moreLabels}>+{task.labels.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 16, marginHorizontal: 16, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, alignItems: 'flex-start',
  },
  completedCard: { opacity: 0.6 },
  statusButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statusIcon: { fontSize: 20 },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  completedTitle: { textDecorationLine: 'line-through', color: '#999' },
  description: { fontSize: 13, color: '#666', marginBottom: 8 },
  highlight: { backgroundColor: '#FFF3B0', color: '#1A1A2E', fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 11, fontWeight: '700', color: '#FFF', textTransform: 'capitalize' },
  metaText: { fontSize: 11, color: '#888' },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  labelChip: { backgroundColor: '#EDE7F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  labelText: { fontSize: 10, color: '#5E35B1', fontWeight: '600' },
  moreLabels: { fontSize: 10, color: '#999', alignSelf: 'center' },
});
