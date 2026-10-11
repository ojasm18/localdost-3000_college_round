import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Role } from '../../../shared/types';

interface UserContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  switchUserById: (id: string) => void;
}

const DEFAULT_USERS: User[] = [
  { id: 'asha', name: 'Asha', role: 'DEVELOPER' },
  { id: 'kiran', name: 'Kiran', role: 'DEVELOPER' },
  { id: 'ravi', name: 'Ravi', role: 'REVIEWER' },
  { id: 'admin', name: 'Admin', role: 'ADMIN' },
];

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUserState] = useState<User>(() => {
    const saved = localStorage.getItem('patchwork_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_USERS[0];
  });

  useEffect(() => {
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: User[]) => {
        if (data && data.length > 0) {
          setUsers(data);
          const found = data.find((u) => u.id === currentUser.id);
          if (found) setCurrentUserState(found);
        }
      })
      .catch(() => {});
  }, []);

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
    localStorage.setItem('patchwork_user', JSON.stringify(user));
  };

  const switchUserById = (id: string) => {
    const found = users.find((u) => u.id === id);
    if (found) {
      setCurrentUser(found);
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, users, switchUserById }}>
      {children}
    </UserContext.Provider>
  );
};

export function useCurrentUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within UserProvider');
  }
  return context;
}
