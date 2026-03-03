
declare namespace chrome {
  namespace history {
    interface HistoryItem {
      id: string;
      url?: string;
      title?: string;
      lastVisitTime?: number;
      visitCount?: number;
      typedCount?: number;
    }

    interface SearchQuery {
      text: string;
      startTime?: number;
      endTime?: number;
      maxResults?: number;
    }

    function search(query: SearchQuery): Promise<HistoryItem[]>;
    function addUrl(details: { url: string }): Promise<void>;
  }

  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      parentId?: string;
      index?: number;
      url?: string;
      title: string;
      dateAdded?: number;
      dateGroupModified?: number;
      children?: BookmarkTreeNode[];
    }

    interface SearchQuery {
      query?: string;
      title?: string;
      url?: string;
    }

    function getTree(): Promise<BookmarkTreeNode[]>;
    function search(query: string | SearchQuery): Promise<BookmarkTreeNode[]>;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      url?: string;
      title?: string;
      favIconUrl?: string;
    }

    function create(createProperties: { url: string }): Promise<Tab>;
  }

  namespace runtime {
    function sendMessage<T = unknown>(
      message: unknown,
      responseCallback?: (response: T) => void
    ): void;
  }
}
