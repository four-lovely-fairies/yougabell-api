export type AuthenticatedUser = {
  id: string;
  email?: string;
  role?: string;
};

export type RequestWithUser = {
  user: AuthenticatedUser;
};
