import cloudbase from '@cloudbase/js-sdk';

// CloudBase configuration
const envId = import.meta.env.VITE_TCB_ENV_ID || '';

// Helper function to check if CloudBase is configured
export const isCloudBaseConfigured = (): boolean => {
  // Check if user explicitly chose local mode
  if (typeof window !== 'undefined' && localStorage.getItem('inkflow_use_local_mode') === 'true') {
    return false;
  }
  return Boolean(envId);
};

// Initialize CloudBase app
export const app = isCloudBaseConfigured()
  ? cloudbase.init({
      env: envId
    })
  : null;

// Get auth instance
export const auth = app ? app.auth({ persistence: 'local' }) : null;

// Get database instance
export const db = app ? app.database() : null;

// Custom user authentication using database
export const customAuth = {
  // Register new user
  async signUp(username: string, password: string) {
    if (!db || !auth) throw new Error('CloudBase not configured');

    try {
      console.log('开始注册流程...', { username });

      // Check if already logged in, if not, sign in anonymously
      let loginState = await auth.getLoginState();
      if (!loginState) {
        console.log('开始匿名登录...');
        await auth.signInAnonymously();
        loginState = await auth.getLoginState();
        if (!loginState) throw new Error('登录失败');
      }

      console.log('获取到用户ID:', loginState.user.uid);

      // Check if username already exists (case-insensitive)
      console.log('检查用户名是否存在...');
      const normalizedUsername = username.toLowerCase().trim();
      const existingUser = await db.collection('users')
        .where({ username: normalizedUsername })
        .limit(1)
        .get();

      console.log('查询结果:', existingUser);

      if (existingUser.data.length > 0) {
        throw new Error('用户名已存在');
      }

      // Hash password (simple hash for demo, use bcrypt in production)
      const hashedPassword = btoa(password); // Base64 encoding (NOT secure for production!)

      // Create user record in database with normalized username
      console.log('创建用户记录...');
      const addResult = await db.collection('users').add({
        username: normalizedUsername,
        password: hashedPassword,
        created_at: Date.now()
      });

      console.log('用户创建成功:', addResult);

      // Store custom user info
      localStorage.setItem('inkflow_custom_user', JSON.stringify({
        uid: addResult.id,
        username: normalizedUsername
      }));

      return { userId: addResult.id, username: normalizedUsername };
    } catch (error: any) {
      console.error('Sign up error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      // Extract meaningful error message
      const errorMessage = error.message || error.errMsg || error.toString();
      throw new Error(errorMessage);
    }
  },

  // Sign in existing user
  async signIn(username: string, password: string) {
    if (!db || !auth) throw new Error('CloudBase not configured');

    try {
      // Check if already logged in, if not, sign in anonymously
      let loginState = await auth.getLoginState();
      if (!loginState) {
        await auth.signInAnonymously();
        loginState = await auth.getLoginState();
        if (!loginState) throw new Error('登录失败');
      }

      // Hash password
      const hashedPassword = btoa(password);

      // Normalize username (case-insensitive)
      const normalizedUsername = username.toLowerCase().trim();

      // Find user in database
      const result = await db.collection('users')
        .where({ username: normalizedUsername, password: hashedPassword })
        .limit(1)
        .get();

      if (result.data.length === 0) {
        throw new Error('用户名或密码错误');
      }

      const user = result.data[0];

      // Store custom user info
      localStorage.setItem('inkflow_custom_user', JSON.stringify({
        uid: user._id,
        username: user.username
      }));

      return { userId: user._id, username: user.username };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Get current user
  async getCurrentUser() {
    const userStr = localStorage.getItem('inkflow_custom_user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Sign out
  async signOut() {
    if (!auth) return;

    localStorage.removeItem('inkflow_custom_user');
    await auth.signOut();
  }
};

// Helper function to get current user
export const getCurrentUser = async () => {
  if (!isCloudBaseConfigured()) return null;

  return await customAuth.getCurrentUser();
};

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};
