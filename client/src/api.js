import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const base = import.meta.env.VITE_API_ORIGIN || '';
const api = axios.create({
  baseURL: base + '/api/v1',
  withCredentials: true,
  headers: { 'X-Startlink': '1' },
});
let token;
let refresh;
let onSession = () => {};
export const setListener = (listener) => {
  onSession = listener;
};
export function setSession(session) {
  token = session?.accessToken;
  onSession(session || null);
}
api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
export function renew() {
  const rotate = () => api.post('/auth/refresh');
  refresh ??= (navigator.locks ? navigator.locks.request('startlink-refresh', rotate) : rotate())
    .then((response) => {
      setSession(response.data.data);
      return response.data.data;
    })
    .catch((error) => {
      setSession(null);
      throw error;
    })
    .finally(() => {
      refresh = null;
    });
  return refresh;
}
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      !config ||
      config.url.startsWith('/auth/') ||
      config.retried
    )
      throw error;
    config.retried = true;
    await renew();
    return api(config);
  },
);
export const request = async (path, method = 'get', data) =>
  (await api({ url: path, method, data })).data.data;
export async function downloadPrivate(reference) {
  const response = await api.get('/files/' + reference.slice(6), { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const element = document.createElement('a');
  element.href = objectUrl;
  element.download = response.headers['x-startlink-filename'] || 'attachment';
  element.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
export const errorText = (error) => {
  const info = error.response?.data?.error;
  return info?.fields?.length
    ? info.fields
        .map((field) => (field.field ? field.field + ': ' : '') + field.message)
        .join(' · ')
    : info?.message || 'Unable to reach STARTLINK. Please try again.';
};
export const useData = (path, enabled = true) =>
  useQuery({ queryKey: [path], queryFn: () => request(path), enabled, retry: false });
export function useAction() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'post', data }) => request(path, method, data),
    onSuccess: () => cache.invalidateQueries(),
    onError: (error) => toast.error(errorText(error)),
  });
}
export function search(path, params) {
  const values = Object.entries(params).filter(([, value]) => value !== '' && value !== undefined);
  return path + (values.length ? '?' + new URLSearchParams(values) : '');
}
