import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Task } from '../types/task';

interface TaskCardProps {
  task: Task;
  onPress: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  searchQuery?: string;
}

const PRIORITY_COLORS = {
  low: '#4ECDC4',
  medium: '#FFB347',
  high: '#FF6B6B',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '○',
  'in-progress': '◐',
  completed: '●',
};

/**
 * Renders text with highlighted search matches.
 */
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
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
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
    parts.push({
      text: remaining.slice(matchIndex, matchIndex + query.length),
      isMatch: true,
    });
    remaining = remaining.slice(matchIndex + query.length);
    lowerRemaining = lowerRemaining.slice(matchIndex + query.length);
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.isMatch ? (
          <Text key={index} style={styles.highlight}>
            {part.text}
          </Text>
        ) : (
          <Text key={index}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

export function TaskCard({
  task,
  onPress,
  onToggleStatus,
  searchQuery,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed';

  return (
    <TouchableOpacity
      style={[styles.card, isCompleted && styles.completedCard]}
      onPress={() => onPress(task)}
      accessibilityLabel={`Task: ${task.title}, Priority: ${task.priority}, Status: ${task.status}`}
      accessibilityRole="button">
      <TouchableOpacity
        style={styles.statusButton}
        onPress={() => onToggleStatus(task)}
        accessibilityLabel={`Mark task as ${isCompleted ? 'pending' : 'completed'}`}
        accessibilityRole="button">
        <Text style={styles.statusIcon}>
          {STATUS_LABELS[task.status] || '○'}
        </Text>
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
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: PRIORITY_COLORS[task.priority] },
            ]}>
            <Text style={styles.priorityText}>{task.priority}</Text>
          </View>
          {task.dueDate && (
            <Text style={styles.dueDate}>
              📅 {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          )}
          {task.needsSync && <Text style={styles.syncIndicator}>⏳</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'flex-start',
  },
  completedCard: {
    opacity: 0.6,
  },
  statusButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  highlight: {
    backgroundColor: '#FFF3B0',
    color: '#1A1A2E',
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  dueDate: {
    fontSize: 12,
    color: '#888',
  },
  syncIndicator: {
    fontSize: 12,
  },
});
