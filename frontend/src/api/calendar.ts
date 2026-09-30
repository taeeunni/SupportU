import { apiClient } from './client';

export interface CalendarEvent {
    cid: string;
    policyId: string;
    title: string;
    eventStartAt: string;
    eventEndAt: string;
    org: string;
    applyStatus: string;
}

export interface DeleteCalendarEventResponse {
    deleted: boolean;
}

export type CalendarApplyStatus = 'apply_now' | 'applied' | 'benefited';

export interface UpdateCalendarEventStatusRequest {
    cid: string;
    applyStatus: CalendarApplyStatus;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
    return apiClient.get<CalendarEvent[]>('/calendar/events');
}

export async function createCalendarEventFromPolicy(
    policyId: string,
): Promise<CalendarEvent> {
    return apiClient.post<CalendarEvent>(`/calendar/events/from-policy/${policyId}`);
}

export async function deleteCalendarEvent(cid: string): Promise<DeleteCalendarEventResponse> {
    return apiClient.delete<DeleteCalendarEventResponse>(`/calendar/events/${cid}`);
}

export async function updateCalendarEventStatus({
    cid,
    applyStatus,
}: UpdateCalendarEventStatusRequest): Promise<CalendarEvent> {
    return apiClient.put<CalendarEvent>(`/calendar/events/${cid}/status`, { applyStatus });
}
