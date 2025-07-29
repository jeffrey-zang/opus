export interface WaitlistSubmission {
  email: string;
}

export interface WaitlistResponse {
  message: string;
  id: string;
}

export interface WaitlistError {
  error: string;
}

export interface WaitlistStats {
  totalEntries: number;
}

export type WaitlistApiResponse = WaitlistResponse | WaitlistError;
