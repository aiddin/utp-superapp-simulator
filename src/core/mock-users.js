/**
 * Mock User Registry
 * 
 * Provides simulated user profiles for each role.
 * These mirror the values Flutter Shell injects via
 * window.__SUPERAPP_USER__, __SUPERAPP_TOKEN__, etc.
 */

export const MOCK_USERS = {
  student: {
    uuid:  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    id:    'S12345',
    name:  'Ahmad Zuhairi',
    role:  'student',
    email: 'ahmad@utp.edu.my',
    token: 'mock-scoped-jwt-student-v1',
    fcm:   null,
  },
  lecturer: {
    uuid:  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    id:    'L00891',
    name:  'Dr. Hafizuddin Ahmad',
    role:  'lecturer',
    email: 'hafizuddin@utp.edu.my',
    token: 'mock-scoped-jwt-lecturer-v1',
    fcm:   null,
  },
  staff: {
    uuid:  'c3d4e5f6-a7b8-9012-cdef-123456789012',
    id:    'ST0042',
    name:  'Nurul Ain Syahira',
    role:  'staff',
    email: 'nurulain@utp.edu.my',
    token: 'mock-scoped-jwt-staff-v1',
    fcm:   null,
  },
};

/**
 * Returns the initial letter of the user's name for avatar display.
 * @param {object} user 
 * @returns {string}
 */
export function getUserInitial(user) {
  return user.name.charAt(0).toUpperCase();
}

/**
 * Returns a display label like "Ahmad Zuhairi (Student)"
 * @param {object} user 
 * @returns {string}
 */
export function getUserDisplayName(user) {
  return `${user.name} (${user.role.charAt(0).toUpperCase()}${user.role.slice(1)})`;
}
