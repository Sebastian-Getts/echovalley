export type BackendEnvironment = 'development' | 'production'

const ENVIRONMENT_KEY = '__backendEnvironment'
const TEST_ACCOUNTS = ['erin']

function envVersion(): 'develop' | 'trial' | 'release' {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion
  } catch (e) {
    return 'develop'
  }
}

function defaultEnvironment(): BackendEnvironment {
  return envVersion() === 'release' ? 'production' : 'development'
}

export function getBackendEnvironment(): BackendEnvironment {
  const saved = wx.getStorageSync(ENVIRONMENT_KEY)
  return saved === 'development' || saved === 'production' ? saved : defaultEnvironment()
}

export function setBackendEnvironment(environment: BackendEnvironment) {
  wx.setStorageSync(ENVIRONMENT_KEY, environment)
}

export function selectEnvironmentForLogin(username: string): BackendEnvironment {
  const normalizedUsername = username.trim().toLowerCase()
  const environment = envVersion() === 'release' && !TEST_ACCOUNTS.includes(normalizedUsername)
    ? 'production'
    : 'development'
  setBackendEnvironment(environment)
  return environment
}

export function restoreDefaultEnvironment() {
  setBackendEnvironment(defaultEnvironment())
}

export function isDevelopmentEnvironment() {
  return getBackendEnvironment() === 'development'
}

export function environmentStorageKey(name: string) {
  return `echovalley:${getBackendEnvironment()}:${name}`
}

export function getEnvironmentStorage(name: string) {
  return wx.getStorageSync(environmentStorageKey(name))
}

export function setEnvironmentStorage(name: string, value: any) {
  wx.setStorageSync(environmentStorageKey(name), value)
}

export function removeEnvironmentStorage(name: string) {
  wx.removeStorageSync(environmentStorageKey(name))
}

export function clearCurrentEnvironmentAuth() {
  const authKeys = ['isLoggedIn', 'username', 'studentId', 'studentDbId', 'token']
  authKeys.forEach(removeEnvironmentStorage)
}
