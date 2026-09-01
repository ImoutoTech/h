import type { ExternalProvider } from '@/entity/ExternalIdentity';

export const ACTIVITY_CATEGORIES = [
  'account',
  'identity',
  'oidc',
  'subapp',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_ACTIONS = [
  'login_succeeded',
  'login_failed',
  'profile_updated',
  'email_changed',
  'password_changed',
  'identity_bound',
  'identity_unbound',
  'consent_decided',
  'created',
  'updated',
  'status_changed',
  'deleted',
  'secret_created',
  'secret_status_changed',
  'secret_deleted',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityOutcome = 'success' | 'failure' | 'approved' | 'denied';
export type LoginMethod = 'password' | ExternalProvider;
export type AccountChange =
  | 'profile_updated'
  | 'email_changed'
  | 'password_changed';
export type SubappAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'deleted'
  | 'secret_created'
  | 'secret_status_changed'
  | 'secret_deleted';

export interface ActivityMetadata {
  method?: LoginMethod;
  provider?: ExternalProvider;
  changedFields?: Array<'avatar' | 'nickname'>;
  scopes?: string[];
  status?: number;
  secretEnabled?: boolean;
}

export type ActivityCommand =
  | {
      kind: 'account.login';
      actorUserId?: number;
      method: LoginMethod;
      outcome: 'success' | 'failure';
    }
  | {
      kind: 'account.changed';
      actorUserId: number;
      action: AccountChange;
      changedFields?: Array<'avatar' | 'nickname'>;
    }
  | {
      kind: 'identity.changed';
      actorUserId: number;
      provider: ExternalProvider;
      action: 'identity_bound' | 'identity_unbound';
    }
  | {
      kind: 'oidc.consent';
      actorUserId: number;
      appId: string;
      scopes: string[];
      outcome: 'approved' | 'denied';
      dedupeSource: string;
    }
  | {
      kind: 'oidc.login';
      actorUserId: number;
      appId: string;
      scopes: string[];
      authorizationCodeJti: string;
    }
  | {
      kind: 'subapp.changed';
      actorUserId: number;
      appId: string;
      appName: string;
      action: SubappAction;
      status?: number;
      secretEnabled?: boolean;
    };

export interface UserActivityProjection {
  id: string;
  category: ActivityCategory;
  action: ActivityAction;
  outcome: ActivityOutcome;
  summary: string;
  detail?: string;
  target?: {
    type: 'subapp' | 'identity';
    id?: string;
    name: string;
  };
  occurredAt: Date;
}
