export type PermissionKey =
  | 'ADMINISTRATOR'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES'
  | 'MANAGE_MESSAGES'
  | 'SEND_MESSAGES'
  | 'SEND_ANNOUNCEMENTS'
  | 'ATTACH_FILES'
  | 'VOICE_SPEAK'
  | 'SCREEN_SHARE';

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  permissions: PermissionKey[];
  isDefault?: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  role?: 'student' | 'teacher' | 'moderator' | string;
  blurProfanity: boolean;
  accentColor: string;
  bio?: string;
  createdAt?: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'announcement';
  description?: string;
  topic?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // user IDs
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  creatorId: string;
  closed: boolean;
}

export interface Message {
  id: string;
  channelId?: string;
  dmId?: string;
  userId: string;
  user: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    role?: string;
    accentColor: string;
  };
  content: string;
  type: 'text' | 'voice' | 'image' | 'poll' | 'system';
  mediaUrl?: string;
  mediaDuration?: number;
  fileName?: string;
  poll?: Poll;
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface ServerData {
  id: string;
  name: string;
  description: string;
  icon: string;
  bannerColor: string;
  ownerId: string;
  inviteCode: string;
  channels: Channel[];
  roles: ServerRole[];
  memberIds: string[];
  memberRoles: Record<string, string[]>; // userId -> roleIds
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUser: User;
  toUserId: string;
  toUser: User;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface DMChannel {
  id: string;
  participantIds: string[];
  participants: User[];
  lastMessage?: Message;
  updatedAt: string;
}

export interface AISummaryData {
  overview: string;
  keyDecisions: string[];
  questionsRaised: string[];
  actionItems: string[];
  model?: string;
}

export interface RemoteControlState {
  isActive: boolean;
  controllerUserId: string | null;
  controllerName: string | null;
  cursorX: number;
  cursorY: number;
  isClicking: boolean;
  killSwitchTriggered: boolean;
}
