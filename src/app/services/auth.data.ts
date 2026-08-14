import { User } from '../models/user';

export interface DemoUser extends User {
  password: string;
}

export const DEMO_USERS: readonly DemoUser[] = [
  { id: 'user-padme', username: 'padme', displayName: 'Padmé Amidala', password: 'naboo' },
  { id: 'user-luke', username: 'luke', displayName: 'Luke Skywalker', password: 'tatooine' },
  { id: 'user-rey', username: 'rey', displayName: 'Rey Skywalker', password: 'jakku' },
];
