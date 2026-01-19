/**
 * API Service for communicating with the backend
 */

import axios from 'axios';
import type {
  SessionInitRequest,
  SessionInitResponse,
  SAMPredictRequest,
  SAMPredictResponse,
  SaveLabelsRequest,
  SaveLabelsResponse,
  LoadLabelsResponse,
  ImageInfo,
} from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============ Session API ============

export async function initSession(request: SessionInitRequest): Promise<SessionInitResponse> {
  const response = await api.post<SessionInitResponse>('/session/init', request);
  return response.data;
}

export async function getSession(sessionId: string): Promise<SessionInitResponse> {
  const response = await api.get<SessionInitResponse>(`/session/${sessionId}`);
  return response.data;
}

// ============ Images API ============

export function getImageUrl(sessionId: string, imageId: string): string {
  return `${API_BASE}/images/${sessionId}/${imageId}`;
}

export async function getImageInfo(sessionId: string, imageId: string): Promise<ImageInfo> {
  const response = await api.get<ImageInfo>(`/images/${sessionId}/${imageId}/info`);
  return response.data;
}

export async function listImages(
  sessionId: string,
  offset: number = 0,
  limit: number = 100
): Promise<{ images: ImageInfo[]; total: number }> {
  const response = await api.get(`/images/${sessionId}/list`, {
    params: { offset, limit },
  });
  return response.data;
}

// ============ SAM API ============

export async function predictMask(
  sessionId: string,
  request: SAMPredictRequest
): Promise<SAMPredictResponse> {
  const response = await api.post<SAMPredictResponse>(
    `/sam/predict/${sessionId}`,
    request
  );
  return response.data;
}

export async function getSAMStatus(): Promise<{
  loaded: boolean;
  device: string;
  cache_size: number;
}> {
  const response = await api.get('/sam/status');
  return response.data;
}

// ============ Labels API ============

export async function saveLabels(
  sessionId: string,
  request: SaveLabelsRequest
): Promise<SaveLabelsResponse> {
  const response = await api.post<SaveLabelsResponse>(
    `/labels/save/${sessionId}`,
    request
  );
  return response.data;
}

export async function loadLabels(
  sessionId: string,
  imageId: string
): Promise<LoadLabelsResponse> {
  const response = await api.get<LoadLabelsResponse>(
    `/labels/load/${sessionId}/${imageId}`
  );
  return response.data;
}

export async function deleteLabels(
  sessionId: string,
  imageId: string
): Promise<{ success: boolean }> {
  const response = await api.delete(`/labels/delete/${sessionId}/${imageId}`);
  return response.data;
}

export default api;
