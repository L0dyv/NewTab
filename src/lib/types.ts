// Unified type definitions for QuickLinks and Groups

export interface QuickLink {
    id: string;
    name: string;
    url: string;
    icon?: string;
    enabled?: boolean;
    groupId?: string;
}

export interface QuickLinkGroup {
    id: string;
    name: string;
    order: number;
    collapsed?: boolean;
}

export const UNGROUPED_ID = '__ungrouped__';
