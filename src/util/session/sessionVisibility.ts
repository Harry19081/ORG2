const SUBAGENT_SESSION_ID_SEGMENT = ":subagent:";

interface SessionVisibilityInput {
  session_id: string;
  orgMemberId?: string;
  parentSessionId?: string;
  agentOrgId?: string;
}

export function isPrimarySessionListSession(
  session: SessionVisibilityInput
): boolean {
  const isChildSession =
    Boolean(session.parentSessionId) ||
    session.session_id.includes(SUBAGENT_SESSION_ID_SEGMENT);
  if (isChildSession) return false;
  return !session.orgMemberId || Boolean(session.agentOrgId);
}
