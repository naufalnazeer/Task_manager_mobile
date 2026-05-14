export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  TaskList: undefined;
  CreateTask: undefined;
  TaskDetail: { taskId: string };
};
