export const config = {
  hrmApiBaseUrl: process.env.HRM_API_BASE_URL ?? "https://hrm.brotecs.com/api",
  // Authentication credentials from environment
  credentials: {
    username: process.env.HRM_API_USERNAME ?? "",
    password: process.env.HRM_API_PASSWORD ?? "",
  },
  // Optional custom endpoints if your HRM differs
  endpoints: {
    login: process.env.HRM_ENDPOINT_LOGIN ?? "/auth/login/",
  },
};
