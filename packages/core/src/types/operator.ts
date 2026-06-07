export interface OperatorAction {
  actionType: string;
  targetId?: string;
  targetType?: string;
  payload: unknown;
  timestamp: string; // ISO 8601
  outcome: "queued" | "success" | "failure";
  error?: string;
}
