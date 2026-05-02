import axios from "axios";
import { config } from "../config";
import { getAuthHeader } from "../auth/tokenStore";

export const httpClient = axios.create({
  baseURL: config.hrmApiBaseUrl,
  timeout: 30000,
});

httpClient.interceptors.request.use((req) => {
  const auth = getAuthHeader();
  if (req.headers) {
    Object.assign(req.headers, auth);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.headers = auth as any;
  }
  return req;
});
