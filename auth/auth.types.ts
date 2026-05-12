export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type RequestWithUser = {
  user: AuthenticatedUser;
};
