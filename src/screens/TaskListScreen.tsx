import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Task, TaskPriority, TaskStatus } from '../types/task';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { useNetworkStore } from '../stores/networkStore';
import { useDebounce } from '../hooks/useDebounce';
import { TaskCard } from '../components/TaskCard';
import { NetworkBanner } from '../components/NetworkBanner';
import { EmptyState } from '../components/EmptyState';
import { RootStackParamList } from '../navigation/types';
import { backgroundSync } from '../sync/BackgroundSync';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskList'>;
};

const STATUS_FILTERS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
];

const PRIORITY_FILTERS: { label: string; value: TaskPriority | 'all' }[] = [
  { label: 'Any Priority', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

export function TaskListScreen({ navigation }: Props) {
  const {
    tasks,
    searchResults,
    isLoading,
    isSearching,
    loadTasks,
    searchTasks,
    clearSearch,
    updateTask,
    pullFromServer,
  } = useTaskStore();
  const logout = useAuthStore(s => s.logout);
  const isConnected = useNetworkStore(s => s.isConnected);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>(
    'all',
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
    backgroundSync.start();

    if (isConnected) {
      pullFromServer();
    }

    return () => {
      backgroundSync.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchTasks(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, searchTasks, clearSearch]);

  // Determine which tasks to display
  const isActiveSearch = debouncedQuery.trim().length > 0;
  const displayTasks = isActiveSearch ? searchResults : tasks;

  // Apply local filters on top of search results
  const filteredTasks = useMemo(() => {
    return displayTasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [displayTasks, statusFilter, priorityFilter]);

  const handleToggleStatus = useCallback(
    (task: Task) => {
      const nextStatus: TaskStatus =
        task.status === 'completed' ? 'pending' : 'completed';
      updateTask(task.id, { status: nextStatus });
    },
    [updateTask],
  );

  const handleTaskPress = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetail', { taskId: task.id });
    },
    [navigation],
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
  };

  if (isLoading && tasks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NetworkBanner />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputWrapper,
            isSearchFocused && styles.searchInputFocused,
          ]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or description..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search tasks"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
              accessibilityRole="button">
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color="#6C63FF"
              style={styles.searchSpinner}
            />
          )}
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          accessibilityLabel="Logout"
          accessibilityRole="button">
          <Text style={styles.logoutText}>↪</Text>
        </TouchableOpacity>
      </View>

      {/* Search result count */}
      {isActiveSearch && (
        <View style={styles.resultCountContainer}>
          <Text style={styles.resultCountText}>
            {filteredTasks.length} result
            {filteredTasks.length !== 1 ? 's' : ''} for "{debouncedQuery}"
          </Text>
        </View>
      )}

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        {STATUS_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              statusFilter === filter.value && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(filter.value)}
            accessibilityLabel={`Filter by ${filter.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: statusFilter === filter.value }}>
            <Text
              style={[
                styles.filterChipText,
                statusFilter === filter.value && styles.filterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority Filter */}
      <View style={styles.filterContainer}>
        {PRIORITY_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterChip,
              priorityFilter === filter.value && styles.priorityChipActive,
            ]}
            onPress={() => setPriorityFilter(filter.value)}
            accessibilityLabel={`Filter by ${filter.label} priority`}
            accessibilityRole="button"
            accessibilityState={{ selected: priorityFilter === filter.value }}>
            <Text
              style={[
                styles.filterChipText,
                priorityFilter === filter.value &&
                  styles.filterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={handleTaskPress}
            onToggleStatus={handleToggleStatus}
            searchQuery={isActiveSearch ? debouncedQuery : undefined}
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            title={isActiveSearch ? 'No results found' : 'No tasks yet'}
            subtitle={
              isActiveSearch
                ? `No tasks match "${debouncedQuery}". Try a different search.`
                : 'Tap the + button to create your first task'
            }
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateTask')}
        accessibilityLabel="Create new task"
        accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInputFocused: {
    borderColor: '#6C63FF',
    shadowOpacity: 0.1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 18,
  },
  resultCountContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  resultCountText: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E8E8F0',
  },
  filterChipActive: {
    backgroundColor: '#6C63FF',
  },
  priorityChipActive: {
    backgroundColor: '#4ECDC4',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -2,
  },
});
