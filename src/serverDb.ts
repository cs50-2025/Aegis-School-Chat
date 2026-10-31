import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'aegis.db');
export const sqlite = new Database(DB_PATH);

// Enable WAL mode for high concurrency
sqlite.pragma('journal_mode = WAL');

// Initialize SQL Tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    status TEXT DEFAULT 'online',
    blur_profanity INTEGER DEFAULT 1,
    accent_color TEXT DEFAULT '#6366F1',
    bio TEXT DEFAULT '',
    servers TEXT DEFAULT '[]',
    friends TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    banner_color TEXT,
    owner_id TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    channels TEXT NOT NULL,
    roles TEXT NOT NULL,
    member_ids TEXT NOT NULL,
    member_roles TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dm_channels (
    id TEXT PRIMARY KEY,
    participant_ids TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT,
    dm_id TEXT,
    user_id TEXT NOT NULL,
    user_data TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'text',
    media_url TEXT,
    media_duration REAL,
    file_name TEXT,
    poll_data TEXT,
    reactions TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS read_receipts (
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  );
`);

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  avatar: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  blurProfanity: boolean;
  accentColor: string;
  bio?: string;
  servers: string[];
  friends: string[];
  createdAt: string;
}

export interface ServerRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  bannerColor: string;
  ownerId: string;
  inviteCode: string;
  channels: any[];
  roles: any[];
  memberIds: string[];
  memberRoles: Record<string, string[]>;
}

export interface FriendRow {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface DMRow {
  id: string;
  participantIds: string[];
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  channelId?: string;
  dmId?: string;
  userId: string;
  user: any;
  content: string;
  type: 'text' | 'voice' | 'image' | 'poll' | 'system';
  mediaUrl?: string;
  mediaDuration?: number;
  fileName?: string;
  poll?: any;
  reactions: Record<string, string[]>;
  createdAt: string;
}

// Transform DB row to User object
function parseUserRow(row: any): UserRow {
  let servers: string[] = [];
  let friends: string[] = [];
  try {
    servers = JSON.parse(row.servers || '[]');
  } catch {}
  try {
    friends = JSON.parse(row.friends || '[]');
  } catch {}

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.username, // Username is the display name
    avatar: row.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.username}`,
    status: row.status || 'online',
    blurProfanity: Boolean(row.blur_profanity),
    accentColor: row.accent_color || '#6366F1',
    bio: row.bio || '',
    servers,
    friends,
    createdAt: row.created_at,
  };
}

export const dbOps = {
  // --- User Operations ---
  getUserById(id: string): UserRow | null {
    const stmt = sqlite.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? parseUserRow(row) : null;
  },

  getUserByUsername(username: string): UserRow | null {
    const stmt = sqlite.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    const row = stmt.get(username.trim().toLowerCase()) as any;
    return row ? parseUserRow(row) : null;
  },

  getAllUsers(): UserRow[] {
    const stmt = sqlite.prepare('SELECT * FROM users ORDER BY created_at ASC');
    const rows = stmt.all() as any[];
    return rows.map(parseUserRow);
  },

  searchUsers(query: string, excludeUserId?: string): UserRow[] {
    const cleanQ = query.trim().toLowerCase();
    let rows: any[];
    if (cleanQ) {
      const stmt = sqlite.prepare(
        'SELECT * FROM users WHERE LOWER(username) LIKE ? AND (? IS NULL OR id != ?) ORDER BY username ASC'
      );
      rows = stmt.all(`%${cleanQ}%`, excludeUserId || null, excludeUserId || null) as any[];
    } else {
      const stmt = sqlite.prepare('SELECT * FROM users WHERE (? IS NULL OR id != ?) ORDER BY username ASC');
      rows = stmt.all(excludeUserId || null, excludeUserId || null) as any[];
    }
    return rows.map(parseUserRow);
  },

  insertUser(user: {
    id: string;
    username: string;
    passwordHash: string;
    avatar: string;
    status?: string;
    blurProfanity?: boolean;
    accentColor?: string;
    bio?: string;
    servers?: string[];
    friends?: string[];
    createdAt: string;
  }): UserRow {
    const stmt = sqlite.prepare(`
      INSERT INTO users (id, username, password_hash, name, avatar, status, blur_profanity, accent_color, bio, servers, friends, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.username.toLowerCase(),
      user.passwordHash,
      user.username.toLowerCase(), // Display name is username
      user.avatar,
      user.status || 'online',
      user.blurProfanity ? 1 : 0,
      user.accentColor || '#6366F1',
      user.bio || 'Excited to study and collaborate on Aegis!',
      JSON.stringify(user.servers || []),
      JSON.stringify(user.friends || []),
      user.createdAt
    );

    return this.getUserById(user.id)!;
  },

  updateUser(
    id: string,
    updates: Partial<{
      avatar: string;
      status: string;
      blurProfanity: boolean;
      accentColor: string;
      bio: string;
      servers: string[];
      friends: string[];
    }>
  ): UserRow | null {
    const current = this.getUserById(id);
    if (!current) return null;

    const newAvatar = updates.avatar !== undefined ? updates.avatar : current.avatar;
    const newStatus = updates.status !== undefined ? updates.status : current.status;
    const newBlur = updates.blurProfanity !== undefined ? (updates.blurProfanity ? 1 : 0) : (current.blurProfanity ? 1 : 0);
    const newAccent = updates.accentColor !== undefined ? updates.accentColor : current.accentColor;
    const newBio = updates.bio !== undefined ? updates.bio : current.bio;
    const newServers = updates.servers !== undefined ? JSON.stringify(updates.servers) : JSON.stringify(current.servers);
    const newFriends = updates.friends !== undefined ? JSON.stringify(updates.friends) : JSON.stringify(current.friends);

    const stmt = sqlite.prepare(`
      UPDATE users SET
        avatar = ?,
        status = ?,
        blur_profanity = ?,
        accent_color = ?,
        bio = ?,
        servers = ?,
        friends = ?
      WHERE id = ?
    `);

    stmt.run(newAvatar, newStatus, newBlur, newAccent, newBio, newServers, newFriends, id);
    return this.getUserById(id);
  },

  addServerToUser(userId: string, serverId: string): void {
    const user = this.getUserById(userId);
    if (user && !user.servers.includes(serverId)) {
      const nextServers = [...user.servers, serverId];
      this.updateUser(userId, { servers: nextServers });
    }
  },

  addFriendToUser(userId: string, friendId: string): void {
    const user = this.getUserById(userId);
    if (user && !user.friends.includes(friendId)) {
      const nextFriends = [...user.friends, friendId];
      this.updateUser(userId, { friends: nextFriends });
    }
  },

  // --- Server Operations ---
  getServerById(id: string): ServerRow | null {
    const stmt = sqlite.prepare('SELECT * FROM servers WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || '🏫',
      bannerColor: row.banner_color || 'from-indigo-600 to-violet-800',
      ownerId: row.owner_id,
      inviteCode: row.invite_code,
      channels: JSON.parse(row.channels || '[]'),
      roles: JSON.parse(row.roles || '[]'),
      memberIds: JSON.parse(row.member_ids || '[]'),
      memberRoles: JSON.parse(row.member_roles || '{}'),
    };
  },

  getServerByInviteCode(code: string): ServerRow | null {
    const stmt = sqlite.prepare('SELECT * FROM servers WHERE UPPER(invite_code) = UPPER(?)');
    const row = stmt.get(code.trim().toUpperCase()) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || '🏫',
      bannerColor: row.banner_color || 'from-indigo-600 to-violet-800',
      ownerId: row.owner_id,
      inviteCode: row.invite_code,
      channels: JSON.parse(row.channels || '[]'),
      roles: JSON.parse(row.roles || '[]'),
      memberIds: JSON.parse(row.member_ids || '[]'),
      memberRoles: JSON.parse(row.member_roles || '{}'),
    };
  },

  getUserServers(userId: string): ServerRow[] {
    const stmt = sqlite.prepare('SELECT * FROM servers');
    const rows = stmt.all() as any[];
    const result: ServerRow[] = [];
    for (const row of rows) {
      try {
        const memberIds = JSON.parse(row.member_ids || '[]');
        if (memberIds.includes(userId)) {
          result.push({
            id: row.id,
            name: row.name,
            description: row.description || '',
            icon: row.icon || '🏫',
            bannerColor: row.banner_color || 'from-indigo-600 to-violet-800',
            ownerId: row.owner_id,
            inviteCode: row.invite_code,
            channels: JSON.parse(row.channels || '[]'),
            roles: JSON.parse(row.roles || '[]'),
            memberIds,
            memberRoles: JSON.parse(row.member_roles || '{}'),
          });
        }
      } catch {}
    }
    return result;
  },

  insertServer(server: ServerRow): void {
    const stmt = sqlite.prepare(`
      INSERT INTO servers (id, name, description, icon, banner_color, owner_id, invite_code, channels, roles, member_ids, member_roles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      server.id,
      server.name,
      server.description,
      server.icon,
      server.bannerColor,
      server.ownerId,
      server.inviteCode,
      JSON.stringify(server.channels),
      JSON.stringify(server.roles),
      JSON.stringify(server.memberIds),
      JSON.stringify(server.memberRoles)
    );
  },

  updateServer(server: ServerRow): void {
    const stmt = sqlite.prepare(`
      UPDATE servers SET
        name = ?,
        description = ?,
        icon = ?,
        banner_color = ?,
        owner_id = ?,
        invite_code = ?,
        channels = ?,
        roles = ?,
        member_ids = ?,
        member_roles = ?
      WHERE id = ?
    `);
    stmt.run(
      server.name,
      server.description,
      server.icon,
      server.bannerColor,
      server.ownerId,
      server.inviteCode,
      JSON.stringify(server.channels),
      JSON.stringify(server.roles),
      JSON.stringify(server.memberIds),
      JSON.stringify(server.memberRoles),
      server.id
    );
  },

  // --- Friends Operations ---
  getFriendsRelations(userId: string): FriendRow[] {
    const stmt = sqlite.prepare('SELECT * FROM friends WHERE from_user_id = ? OR to_user_id = ?');
    const rows = stmt.all(userId, userId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  getFriendRelation(userId1: string, userId2: string): FriendRow | null {
    const stmt = sqlite.prepare(`
      SELECT * FROM friends
      WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
    `);
    const r = stmt.get(userId1, userId2, userId2, userId1) as any;
    if (!r) return null;
    return {
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      status: r.status,
      createdAt: r.created_at,
    };
  },

  insertFriendRequest(req: FriendRow): void {
    const stmt = sqlite.prepare(
      'INSERT INTO friends (id, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(req.id, req.fromUserId, req.toUserId, req.status, req.createdAt);
  },

  updateFriendStatus(id: string, status: 'accepted' | 'declined'): void {
    const stmt = sqlite.prepare('UPDATE friends SET status = ? WHERE id = ?');
    stmt.run(status, id);
  },

  deleteFriendRequest(id: string): void {
    const stmt = sqlite.prepare('DELETE FROM friends WHERE id = ?');
    stmt.run(id);
  },

  // --- DM Channels Operations ---
  getUserDMs(userId: string): DMRow[] {
    const stmt = sqlite.prepare('SELECT * FROM dm_channels ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    const result: DMRow[] = [];
    for (const r of rows) {
      try {
        const participantIds = JSON.parse(r.participant_ids || '[]');
        if (participantIds.includes(userId)) {
          result.push({
            id: r.id,
            participantIds,
            updatedAt: r.updated_at,
          });
        }
      } catch {}
    }
    return result;
  },

  getDMById(dmId: string): DMRow | null {
    const stmt = sqlite.prepare('SELECT * FROM dm_channels WHERE id = ?');
    const r = stmt.get(dmId) as any;
    if (!r) return null;
    return {
      id: r.id,
      participantIds: JSON.parse(r.participant_ids || '[]'),
      updatedAt: r.updated_at,
    };
  },

  findDMBetween(userId1: string, userId2: string): DMRow | null {
    const dms = this.getUserDMs(userId1);
    return dms.find((d) => d.participantIds.includes(userId1) && d.participantIds.includes(userId2)) || null;
  },

  insertDM(dm: DMRow): void {
    const stmt = sqlite.prepare(
      'INSERT INTO dm_channels (id, participant_ids, updated_at) VALUES (?, ?, ?)'
    );
    stmt.run(dm.id, JSON.stringify(dm.participantIds), dm.updatedAt);
  },

  updateDMTime(dmId: string, time: string): void {
    const stmt = sqlite.prepare('UPDATE dm_channels SET updated_at = ? WHERE id = ?');
    stmt.run(time, dmId);
  },

  // --- Messages Operations ---
  getChannelMessages(channelId: string): MessageRow[] {
    const stmt = sqlite.prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(channelId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      channelId: r.channel_id,
      userId: r.user_id,
      user: JSON.parse(r.user_data || '{}'),
      content: r.content || '',
      type: r.type || 'text',
      mediaUrl: r.media_url,
      mediaDuration: r.media_duration,
      fileName: r.file_name,
      poll: r.poll_data ? JSON.parse(r.poll_data) : undefined,
      reactions: JSON.parse(r.reactions || '{}'),
      createdAt: r.created_at,
    }));
  },

  getDMMessages(dmId: string): MessageRow[] {
    const stmt = sqlite.prepare('SELECT * FROM messages WHERE dm_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(dmId) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      dmId: r.dm_id,
      userId: r.user_id,
      user: JSON.parse(r.user_data || '{}'),
      content: r.content || '',
      type: r.type || 'text',
      mediaUrl: r.media_url,
      mediaDuration: r.media_duration,
      fileName: r.file_name,
      poll: r.poll_data ? JSON.parse(r.poll_data) : undefined,
      reactions: JSON.parse(r.reactions || '{}'),
      createdAt: r.created_at,
    }));
  },

  getMessageById(messageId: string): MessageRow | null {
    const stmt = sqlite.prepare('SELECT * FROM messages WHERE id = ?');
    const r = stmt.get(messageId) as any;
    if (!r) return null;
    return {
      id: r.id,
      channelId: r.channel_id,
      dmId: r.dm_id,
      userId: r.user_id,
      user: JSON.parse(r.user_data || '{}'),
      content: r.content || '',
      type: r.type || 'text',
      mediaUrl: r.media_url,
      mediaDuration: r.media_duration,
      fileName: r.file_name,
      poll: r.poll_data ? JSON.parse(r.poll_data) : undefined,
      reactions: JSON.parse(r.reactions || '{}'),
      createdAt: r.created_at,
    };
  },

  insertMessage(msg: MessageRow): void {
    const stmt = sqlite.prepare(`
      INSERT INTO messages (id, channel_id, dm_id, user_id, user_data, content, type, media_url, media_duration, file_name, poll_data, reactions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.id,
      msg.channelId || null,
      msg.dmId || null,
      msg.userId,
      JSON.stringify(msg.user),
      msg.content,
      msg.type,
      msg.mediaUrl || null,
      msg.mediaDuration || null,
      msg.fileName || null,
      msg.poll ? JSON.stringify(msg.poll) : null,
      JSON.stringify(msg.reactions || {}),
      msg.createdAt
    );
  },

  updatePoll(messageId: string, poll: any): void {
    const stmt = sqlite.prepare('UPDATE messages SET poll_data = ? WHERE id = ?');
    stmt.run(JSON.stringify(poll), messageId);
  },

  updateReactions(messageId: string, reactions: Record<string, string[]>): void {
    const stmt = sqlite.prepare('UPDATE messages SET reactions = ? WHERE id = ?');
    stmt.run(JSON.stringify(reactions), messageId);
  },

  // --- Read Receipts ---
  setReadReceipt(userId: string, channelId: string, messageId: string): void {
    const stmt = sqlite.prepare(`
      INSERT INTO read_receipts (user_id, channel_id, message_id)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, channel_id) DO UPDATE SET message_id = excluded.message_id
    `);
    stmt.run(userId, channelId, messageId);
  },

  getUserReadReceipts(userId: string): Record<string, string> {
    const stmt = sqlite.prepare('SELECT channel_id, message_id FROM read_receipts WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.channel_id] = r.message_id;
    }
    return result;
  },
};

// Migrate initial data from app-db.json if SQLite is empty
(function migrateFromLegacyJson() {
  const usersCount = (sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (usersCount > 0) return;

  const legacyJsonPath = path.join(DATA_DIR, 'app-db.json');
  if (!fs.existsSync(legacyJsonPath)) return;

  try {
    const content = fs.readFileSync(legacyJsonPath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        dbOps.insertUser({
          id: u.id,
          username: u.username,
          passwordHash: u.passwordHash,
          avatar: u.avatar,
          status: u.status,
          blurProfanity: u.blurProfanity,
          accentColor: u.accentColor,
          bio: u.bio,
          createdAt: u.createdAt || new Date().toISOString(),
        });
      }
    }

    if (Array.isArray(data.servers)) {
      for (const s of data.servers) {
        dbOps.insertServer(s);
        for (const mId of s.memberIds || []) {
          dbOps.addServerToUser(mId, s.id);
        }
      }
    }

    if (Array.isArray(data.friends)) {
      for (const f of data.friends) {
        dbOps.insertFriendRequest(f);
        if (f.status === 'accepted') {
          dbOps.addFriendToUser(f.fromUserId, f.toUserId);
          dbOps.addFriendToUser(f.toUserId, f.fromUserId);
        }
      }
    }

    if (Array.isArray(data.dmChannels)) {
      for (const dm of data.dmChannels) {
        dbOps.insertDM(dm);
      }
    }

    if (data.messages && typeof data.messages === 'object') {
      for (const [chanId, msgs] of Object.entries(data.messages)) {
        if (Array.isArray(msgs)) {
          for (const m of msgs as any[]) {
            dbOps.insertMessage({ ...m, channelId: chanId });
          }
        }
      }
    }

    if (data.dmMessages && typeof data.dmMessages === 'object') {
      for (const [dmId, msgs] of Object.entries(data.dmMessages)) {
        if (Array.isArray(msgs)) {
          for (const m of msgs as any[]) {
            dbOps.insertMessage({ ...m, dmId });
          }
        }
      }
    }

    console.log('[SQLite DB] Successfully initialized and migrated data to SQLite database.');
  } catch (err) {
    console.error('[SQLite DB] Migration failed:', err);
  }
})();
