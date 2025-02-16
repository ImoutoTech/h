export const ENV_LIST = [
  '.env.production.local',
  '.env.development.local',
  '.env.production',
  '.env.development',
  '.env',
];

export const REDIS_CLIENT = 'h-redis-client';

export const LOGGER_PREFIX = '[h]';

export const PERMISSION_LIST = [
  {
    name: '新建子应用',
    description: '新建子应用',
    code: 'mwGSuMXj',
  },
  {
    name: '删除子应用',
    description: '删除子应用',
    code: 'qtNiAVBF',
  },
  {
    name: '修改子应用',
    description: '修改子应用',
    code: 'QffBvVPP',
  },
  {
    name: '查看子应用',
    description: '查看子应用',
    code: 'PeqSazMt',
  },
  {
    name: '查看所有子应用',
    description: '查看所有子应用',
    code: 'hZLbqmHh',
  },
  {
    name: '新建角色',
    description: '新建角色',
    code: 'YXoSxbuX',
  },
  {
    name: '删除角色',
    description: '删除角色',
    code: 'YSvHQoAP',
  },
  {
    name: '修改角色',
    description: '修改角色',
    code: 'wKCXLYZD',
  },
  {
    name: '查看角色',
    description: '查看角色',
    code: 'ipqXqrGn',
  },
  {
    name: '新建权限',
    description: '新建权限',
    code: 'EKajZHAS',
  },
  {
    name: '删除权限',
    description: '删除权限',
    code: 'bDjPzdgF',
  },
  {
    name: '修改权限',
    description: '修改权限',
    code: 'tJrACEgJ',
  },
  {
    name: '查看权限',
    description: '查看权限',
    code: 'cfqYFXaQ',
  },
  {
    name: '新建用户',
    description: '新建用户',
    code: 'UcysHdkT',
  },
  {
    name: '删除用户',
    description: '删除用户',
    code: 'AuVdoGwA',
  },
  {
    name: '修改用户',
    description: '修改用户',
    code: 'gnhNAwmj',
  },
  {
    name: '查看用户',
    description: '查看用户',
    code: 'pedimtLB',
  },
  {
    name: '查看所有用户',
    description: '查看所有用户',
    code: 'bJqZjnMW',
  },
];

export const PERMISSION_CODE_MAP = PERMISSION_LIST.reduce((acc, curr) => {
  acc[curr.name] = curr.code;
  return acc;
}, {});

export const ROLE_LIST = [
  {
    name: '管理员',
    permissions: PERMISSION_LIST.map((p) => p.code),
  },
  {
    name: '用户',
    permissions: [
      PERMISSION_CODE_MAP['新建子应用'],
      PERMISSION_CODE_MAP['删除子应用'],
      PERMISSION_CODE_MAP['修改子应用'],
      PERMISSION_CODE_MAP['查看子应用'],
      PERMISSION_CODE_MAP['修改角色'],
      PERMISSION_CODE_MAP['查看角色'],
    ],
  },
];
