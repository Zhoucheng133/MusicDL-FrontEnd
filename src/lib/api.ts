import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

export interface ApiResponse<T> {
  ok: boolean
  message: T
}

const tokenExpiredMessage = 'Token 已过期'

export function getTokenHeader() {
  return {
    token: localStorage.getItem('token') ?? '',
  }
}

function withToken(config: AxiosRequestConfig = {}) {
  return {
    ...config,
    headers: {
      ...(config.headers as Record<string, string> | undefined),
      ...getTokenHeader(),
    },
  }
}

function isTokenExpired(data: unknown) {
  return (
    typeof data === 'object' &&
    data !== null &&
    'ok' in data &&
    'message' in data &&
    (data as ApiResponse<unknown>).ok === false &&
    (data as ApiResponse<unknown>).message === tokenExpiredMessage
  )
}

async function refreshToken() {
  const response = await axios.get<ApiResponse<string>>('/api/refresh', {
    headers: getTokenHeader(),
  })

  if (!response.data.ok || typeof response.data.message !== 'string') {
    throw new Error('Token refresh failed')
  }

  localStorage.setItem('token', response.data.message)
}

async function requestWithRefresh<T>(
  request: () => Promise<AxiosResponse<ApiResponse<T>>>,
  retry: () => Promise<AxiosResponse<ApiResponse<T>>>,
) {
  const response = await request()

  if (isTokenExpired(response.data)) {
    await refreshToken()
    return retry()
  }

  return response
}

export function apiGetWithRefresh<T>(url: string, config?: AxiosRequestConfig) {
  return requestWithRefresh<T>(
    () => axios.get<ApiResponse<T>>(url, withToken(config)),
    () => axios.get<ApiResponse<T>>(url, withToken(config)),
  )
}

export function apiPostWithRefresh<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return requestWithRefresh<T>(
    () => axios.post<ApiResponse<T>>(url, data, withToken(config)),
    () => axios.post<ApiResponse<T>>(url, data, withToken(config)),
  )
}

export function apiDeleteWithRefresh<T>(url: string, config?: AxiosRequestConfig) {
  return requestWithRefresh<T>(
    () => axios.delete<ApiResponse<T>>(url, withToken(config)),
    () => axios.delete<ApiResponse<T>>(url, withToken(config)),
  )
}

async function readBlobApiResponse(blob: Blob) {
  const text = await blob.text()

  try {
    return JSON.parse(text) as ApiResponse<unknown>
  } catch {
    return null
  }
}

export async function apiGetBlobWithRefresh(url: string, config?: AxiosRequestConfig) {
  const response = await axios.get<Blob>(url, {
    ...withToken(config),
    responseType: 'blob',
  })

  if (response.data.type.includes('json') || response.data.type.includes('text')) {
    const data = await readBlobApiResponse(response.data)

    if (isTokenExpired(data)) {
      await refreshToken()
      return axios.get<Blob>(url, {
        ...withToken(config),
        responseType: 'blob',
      })
    }
  }

  return response
}
